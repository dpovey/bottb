"""Build per-band USB-derived stem sets and verify them against the Reaper renders."""
import subprocess, json, os, re, sys, numpy as np
from scipy.signal import butter, sosfiltfilt, fftconvolve, correlate

SRC = "/Users/deapovey/Downloads/BOTTB@Triffid"
DST = "/Volumes/Extreme SSD/bottb/events/2026/Brisbane/01_Media"
BANDS = {"1_Off The Record": "Off The Record", "2_Epsonics": "Epsonics",
         "4_Jumbo": "Jumbo", "5_Total Loss": "Total Loss"}  # ShipRex already done
if len(sys.argv) > 1:
    BANDS = {k: v for k, v in BANDS.items() if v in sys.argv[1:]}

def run(cmd):
    return subprocess.check_output(cmd)

def load(path, start=0, dur=None, sr=4000, pan="c0"):
    cmd = ["ffmpeg", "-v", "error", "-ss", str(start)] + (["-t", str(dur)] if dur else []) + \
          ["-i", path, "-af", f"pan=mono|c0={pan}", "-f", "f32le", "-ac", "1", "-ar", str(sr), "-"]
    return np.frombuffer(run(cmd), dtype=np.float32).astype(np.float64)

def bp(x, sr, lo=100, hi=1500):
    return sosfiltfilt(butter(4, [lo, hi], btype="band", fs=sr, output="sos"), x)

def nsamples(path):
    return int(run(["ffprobe", "-v", "error", "-show_entries", "stream=duration_ts", "-of", "csv=p=0", path]).decode().strip().split(",")[0])

def clean(name):
    name = name.strip()
    fixes = {"Kck IN": "Kick In", "Kck Out": "Kick Out", "Snr T": "Snare Top", "Hi-Hat": "Hi-Hats",
             "Rck 1": "Tom 1", "Rck 2": "Tom 2", "Flr": "Floor Tom", "OHDs": "OH", "Room": "Room"}
    return fixes.get(name, name)

report = {}
for key, band in BANDS.items():
    usb = f"{SRC}/Direct to USB Renders/{key}"
    rp = f"{SRC}/Reaper Renders/{key}"
    out = f"{DST}/{band}"
    os.makedirs(out, exist_ok=True)
    rep = {"band": band, "notes": []}
    print(f"\n===== {band}")

    # --- channel map: desk number -> (usb file, reaper name or None)
    usb_files = {}
    for f in sorted(os.listdir(usb)):
        m = re.match(r"(\d\d) (.+)\.flac$", f)
        if m: usb_files[int(m.group(1))] = (f, m.group(2))
    reaper = {}
    for f in sorted(os.listdir(rp)):
        m = re.match(r"(\d\d)(?:&\d\d)?_(.*)\.wav$", f)
        if m: reaper[int(m.group(1))] = (f, m.group(2))

    # --- offset: reaper OH (c0) inside USB OHD L, two probes
    U_oh = f"{usb}/09 OHD L.flac"; R_oh = f"{rp}/{reaper[9][0]}"
    u = bp(load(U_oh), 4000); u /= np.std(u)
    r_len = nsamples(R_oh) / 48000
    starts = []
    for off in (2, min(600, int(r_len) - 40)):
        s = bp(load(R_oh, off, 30), 4000); s /= np.std(s)
        c = fftconvolve(u, s[::-1], mode="valid") / len(s); k = int(np.argmax(np.abs(c)))
        starts.append(k / 4000 - off)
        print(f"  probe @{off}s: corr {c[k]:+.3f} ({abs(c[k])/np.std(c):.0f}x) -> reaper start = usb {k/4000-off:.3f}s")
    if abs(starts[0] - starts[1]) > 0.01:
        rep["notes"].append(f"probe disagreement {starts}"); print("  !! probes disagree")
    coarse = starts[0]
    # refine at 48k on kick in
    a = load(f"{rp}/{reaper[1][0]}", 10, 20, 48000)
    b = load(f"{usb}/{usb_files[1][0]}", coarse + 10 - 0.05, 20.1, 48000)
    c = correlate(b, a, mode="valid"); k = int(np.argmax(c)); lag = k - 2400
    start_s = coarse + lag / 48000; start_smp = int(round(start_s * 48000))
    ba = b[k:k + len(a)]; g = np.dot(ba, a) / np.dot(ba, ba); resid = np.std(a - g * ba) / np.std(a)
    print(f"  refined: reaper start = usb sample {start_smp} ({start_s:.6f}s), gain {20*np.log10(g):+.2f} dB, residual {resid*100:.2f}%")
    rep.update(reaper_start_usb_sample=start_smp, reaper_start_usb_s=round(start_s, 6),
               identity_gain_db=round(20 * np.log10(g), 3), identity_residual_pct=round(resid * 100, 3))

    # --- coverage: per-second RMS of USB LineL (desk mix) around reaper start and end
    usb_len = nsamples(f"{usb}/LineL Track.flac") / 48000
    r_end = start_s + r_len
    line = load(f"{usb}/LineL Track.flac")
    sec = np.array([20*np.log10(np.sqrt(np.mean(line[i*4000:(i+1)*4000]**2)) + 1e-12) for i in range(int(len(line)//4000))])
    playing = sec > (np.percentile(sec, 90) - 12)  # within 12 dB of loud level
    # first/last playing second
    first_play = int(np.argmax(playing)); last_play = len(playing) - 1 - int(np.argmax(playing[::-1]))
    missed_head = max(0.0, start_s - first_play); missed_tail = max(0.0, last_play - r_end)
    print(f"  USB {usb_len:.0f}s; music from {first_play}s to {last_play}s; reaper covers {start_s:.1f}s..{r_end:.1f}s")
    print(f"  -> reaper missed {missed_head:.1f}s at the head, {missed_tail:.1f}s at the tail")
    rep.update(usb_len_s=round(usb_len, 3), music_first_s=first_play, music_last_s=last_play,
               reaper_missed_head_s=round(missed_head, 1), reaper_missed_tail_s=round(missed_tail, 1))

    # --- convert: full USB length, pairs merged
    plan = []
    for n in range(1, 21):
        if n in (10, 14): continue
        uf, uname = usb_files[n]
        rname = reaper.get(n, (None, ""))[1]
        if n == 9: name, inputs = "OH", [usb_files[9][0], usb_files[10][0]]
        elif n == 13: name, inputs = "Keys", [usb_files[13][0], usb_files[14][0]]
        else:
            name = clean(rname) if rname else uname.title()
            inputs = [uf]
            if rname and uname.lower().replace(" ", "") not in rname.lower().replace(" ", "") and \
               rname.lower().replace(" ", "") not in uname.lower().replace(" ", "") and n > 14:
                rep["notes"].append(f"ch{n:02d}: desk label '{uname}' vs Reaper label '{rname}' -> used Reaper")
        plan.append((n, name, inputs))
    plan.append((21, "Room", ["LineL Track.flac", "LineR Track.flac"]))
    rep["files"] = []
    for n, name, inputs in plan:
        dst = f"{out}/{n:02d} {name}.wav"
        if os.path.exists(dst) and nsamples(dst) == nsamples(f"{usb}/{inputs[0]}"):
            rep["files"].append(os.path.basename(dst)); continue
        if len(inputs) == 1:
            cmd = ["ffmpeg", "-v", "error", "-y", "-i", f"{usb}/{inputs[0]}", "-c:a", "pcm_s24le", "-ar", "48000", dst]
        else:
            cmd = ["ffmpeg", "-v", "error", "-y", "-i", f"{usb}/{inputs[0]}", "-i", f"{usb}/{inputs[1]}",
                   "-filter_complex", "[0:a][1:a]amerge=inputs=2", "-c:a", "pcm_s24le", "-ar", "48000", dst]
        subprocess.check_call(cmd); rep["files"].append(os.path.basename(dst)); print(f"  wrote {os.path.basename(dst)}")

    # --- verify a few outputs against reaper at the offset (skip reaper's first second: fade-in)
    checks = {}
    for n, rf_pan in ((1, "c0"), (9, "c1"), (15, "c0"), (21, "c1")):
        dst = [f for f in rep["files"] if f.startswith(f"{n:02d} ")][0]
        rf = f"{rp}/{reaper[n][0]}" if n != 21 else f"{rp}/{reaper[21][0]}"
        a = load(f"{out}/{dst}", start_s + 60, 10, 48000, pan=rf_pan if n in (9, 21) else "c0")
        b = load(rf, 60, 10, 48000, pan=rf_pan)
        c = correlate(a[4800:48000*9], b[4800-200:48000*9+200], mode="valid"); kk = int(np.argmax(c)) - 200
        aa = np.roll(a, -kk)[4800:48000*9]; bb = b[4800:48000*9]
        gg = np.dot(aa, bb) / np.dot(aa, aa); rr = np.std(bb - gg * aa) / np.std(bb)
        checks[dst] = {"lag_samples": kk, "gain_db": round(20*np.log10(abs(gg)), 2), "residual_pct": round(rr*100, 2)}
        print(f"  verify {dst}: lag {kk:+d}, gain {20*np.log10(abs(gg)):+.2f} dB, residual {rr*100:.2f}%")
    rep["verify"] = checks
    rep["all_identical"] = all(v["residual_pct"] < 1.0 and abs(v["gain_db"]) < 0.1 for v in checks.values())
    report[band] = rep
    json.dump(report, open(f"{os.path.dirname(os.path.abspath(__file__))}/media_report.json", "w"), indent=1)
print("\nDONE")
