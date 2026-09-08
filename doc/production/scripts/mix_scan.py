#!/usr/bin/env python3
"""Per-song mix scan for live multitrack stem exports.

Streams every stem once, storing per-second third-octave energy + RMS, then reports
per song: stem balance, tonal balance vs a reference mix, and drum/snare diagnostics.

    mix_scan.py <stems_dir> [--ref-stems DIR] [--ref-mix WAV] [--out out.json]
                [--songs "s1:e1,s2:e2,..."] [--label NAME]

Stem names are matched loosely ("Snare Top_1.wav" -> "snare top"). Bus/aux stems
(Drums, VOX, GTRS, MIDRANGE, Crowd) are detected and excluded from the leaf sum so
they are not double counted.
"""
import argparse, json, math, os, re, subprocess, sys
import numpy as np

SR = 48000
FRAME = SR  # 1 s analysis frames

# Third-octave centres 25 Hz .. 16 kHz
TO_CENTRES = np.array([25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500,
                       630, 800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300,
                       8000, 10000, 12500, 16000], dtype=float)
TO_EDGES = np.concatenate([[TO_CENTRES[0] / 2 ** (1 / 6)], TO_CENTRES * 2 ** (1 / 6)])

# Named diagnostic regions ("the usual places")
REGIONS = [
    ("rumble",    20,    40,   "subsonic rumble / stage thumps"),
    ("weight",    40,    80,   "kick + bass fundamentals"),
    ("body",      80,   160,   "low body, snare/guitar weight"),
    ("mud",      160,   300,   "mud / boom"),
    ("box",      300,   500,   "boxiness"),
    ("honk",     500,   800,   "honk"),
    ("nasal",    800,  1500,   "nasal / midrange congestion"),
    ("presence",1500,  4000,   "presence, attack, intelligibility"),
    ("edge",    4000,  8000,   "edge / sibilance / cymbal bite"),
    ("air",     8000, 16000,   "air"),
]

BUS_NAMES = {"drums", "vox", "gtrs", "midrange", "crowd", "mix", "stereo out", "master"}


def stem_key(path):
    n = os.path.basename(path)
    n = re.sub(r"\.wav$", "", n, flags=re.I)
    n = re.sub(r"_\d+$", "", n)
    n = re.sub(r"^\d+\s+", "", n)
    return n.strip()


def probe(path):
    out = subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries",
         "stream=sample_rate,channels,duration_ts", "-of", "csv=p=0", path]).decode().strip()
    sr, ch, dts = out.split(",")[:3]
    return int(sr), int(ch), int(dts)


def stream_frames(path):
    """Yield 1 s mono float64 frames (channels summed to mono)."""
    p = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-i", path, "-af", "aformat=channel_layouts=mono",
         "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
        stdout=subprocess.PIPE, bufsize=FRAME * 4 * 8)
    buf = b""
    need = FRAME * 4
    while True:
        chunk = p.stdout.read(need - len(buf))
        if not chunk:
            break
        buf += chunk
        if len(buf) == need:
            yield np.frombuffer(buf, dtype=np.float32).astype(np.float64)
            buf = b""
    p.stdout.close(); p.wait()


def scan_stem(path):
    """-> dict(rms_db[n], to_db[n, 29], peak_db)"""
    win = np.hanning(FRAME)
    fr = np.fft.rfftfreq(FRAME, 1 / SR)
    idx = [np.where((fr >= lo) & (fr < hi))[0] for lo, hi in zip(TO_EDGES[:-1], TO_EDGES[1:])]
    rms, tob, peak = [], [], 0.0
    for x in stream_frames(path):
        peak = max(peak, float(np.max(np.abs(x))) if len(x) else 0.0)
        rms.append(np.sqrt(np.mean(x * x)))
        P = np.abs(np.fft.rfft(x * win)) ** 2
        tob.append([P[i].sum() if len(i) else 0.0 for i in idx])
    rms = np.array(rms); tob = np.array(tob)
    return {
        "rms_db": 20 * np.log10(rms + 1e-12),
        "to_db": 10 * np.log10(tob + 1e-20),
        "peak_db": 20 * math.log10(peak + 1e-12),
        "n": len(rms),
    }


def active_mask(rms_db, floor_rel=25.0):
    """Seconds where the stem is within floor_rel dB of its 90th percentile."""
    if len(rms_db) == 0:
        return np.zeros(0, bool)
    ref = np.percentile(rms_db, 90)
    return rms_db > (ref - floor_rel)


def regions_from_to(to_db_mean):
    """Group mean third-octave dB into the named regions (energy sum)."""
    out = {}
    lin = 10 ** (to_db_mean / 10)
    for name, lo, hi, _ in REGIONS:
        sel = (TO_CENTRES >= lo) & (TO_CENTRES < hi)
        out[name] = 10 * math.log10(lin[sel].sum() + 1e-20) if sel.any() else -200.0
    return out


def find_songs(mix_rms_db, min_len=60, gap=6, drop=14):
    ref = np.percentile(mix_rms_db, 85)
    playing = mix_rms_db > (ref - drop)
    playing = np.convolve(playing.astype(int), np.ones(3), mode="same") > 0
    segs, i, n = [], 0, len(playing)
    while i < n:
        if playing[i]:
            j = i
            while j < n and playing[j]:
                j += 1
            segs.append([i, j]); i = j
        else:
            i += 1
    merged = []
    for s, e in segs:
        if merged and s - merged[-1][1] < gap:
            merged[-1][1] = e
        else:
            merged.append([s, e])
    return [(s, e) for s, e in merged if e - s >= min_len]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("stems_dir")
    ap.add_argument("--ref-stems", default=None, help="reference stem dir (an approved mix)")
    ap.add_argument("--ref-mix", default=None, help="reference stereo master")
    ap.add_argument("--songs", default=None, help="explicit song ranges 'start:end,...' in seconds")
    ap.add_argument("--label", default=None)
    ap.add_argument("--out", default=None)
    a = ap.parse_args()

    files = sorted(f for f in os.listdir(a.stems_dir)
                   if f.lower().endswith((".wav", ".aif", ".aiff", ".flac")) and not f.startswith("._"))
    stems = {}
    for f in files:
        p = os.path.join(a.stems_dir, f)
        try:
            sr, ch, dts = probe(p)
        except Exception:
            continue
        if dts <= 0:
            print(f"  ! skipping {f}: empty", file=sys.stderr); continue
        stems[stem_key(f)] = p
    print(f"{len(stems)} stems in {a.stems_dir}", file=sys.stderr)

    scans = {}
    for k, p in stems.items():
        print(f"  scanning {k} …", file=sys.stderr)
        scans[k] = scan_stem(p)
    n = min(s["n"] for s in scans.values())
    for s in scans.values():
        s["rms_db"] = s["rms_db"][:n]; s["to_db"] = s["to_db"][:n]

    leaves = [k for k in scans if k.lower() not in BUS_NAMES]
    buses = [k for k in scans if k.lower() in BUS_NAMES]

    # Approximate mix = power sum of leaf stems (pre master bus)
    lin = np.zeros((n, len(TO_CENTRES)))
    mix_pow = np.zeros(n)
    for k in leaves:
        lin += 10 ** (scans[k]["to_db"] / 10)
        mix_pow += 10 ** (scans[k]["rms_db"] / 10)
    mix_to = 10 * np.log10(lin + 1e-20)
    mix_rms = 10 * np.log10(mix_pow + 1e-20)

    if a.songs:
        songs = [tuple(int(round(float(v))) for v in part.split(":")) for part in a.songs.split(",")]
    else:
        songs = find_songs(mix_rms)

    # Reference tonal balance
    ref_regions = None
    if a.ref_stems:
        rfiles = [f for f in sorted(os.listdir(a.ref_stems))
                  if f.lower().endswith(".wav") and not f.startswith("._")
                  and stem_key(f).lower() not in BUS_NAMES]
        rlin = None
        for f in rfiles:
            sc = scan_stem(os.path.join(a.ref_stems, f))
            v = 10 ** (sc["to_db"] / 10)
            rlin = v.sum(axis=0) if rlin is None else rlin + v.sum(axis=0)
        ref_to = 10 * np.log10(rlin + 1e-20)
        ref_regions = regions_from_to(ref_to)
    elif a.ref_mix:
        sc = scan_stem(a.ref_mix)
        m = active_mask(sc["rms_db"])
        ref_regions = regions_from_to(sc["to_db"][m].mean(axis=0))

    result = {"label": a.label or os.path.basename(a.stems_dir.rstrip("/")),
              "stems_dir": a.stems_dir, "seconds": n,
              "leaves": leaves, "buses": buses,
              "regions": [{"name": r[0], "lo": r[1], "hi": r[2], "what": r[3]} for r in REGIONS],
              "reference": {"stems": a.ref_stems, "mix": a.ref_mix, "regions": ref_regions},
              "songs": []}

    for si, (s, e) in enumerate(songs, 1):
        sl = slice(s, e)
        mrms = mix_rms[sl]
        m_to = mix_to[sl].mean(axis=0)
        m_reg = regions_from_to(m_to)
        tot = 10 * math.log10(sum(10 ** (v / 10) for v in m_reg.values()) + 1e-20)
        song = {"index": si, "start_s": s, "end_s": e, "len_s": e - s,
                "mix_regions_rel": {k: round(v - tot, 2) for k, v in m_reg.items()},
                "stems": {}}
        if ref_regions:
            rtot = 10 * math.log10(sum(10 ** (v / 10) for v in ref_regions.values()) + 1e-20)
            song["vs_reference"] = {k: round((m_reg[k] - tot) - (ref_regions[k] - rtot), 2)
                                    for k in m_reg}
        mixlvl = 10 * math.log10(np.mean(10 ** (mrms / 10)) + 1e-20)
        for k in scans:
            r = scans[k]["rms_db"][sl]
            act = active_mask(r)
            if act.sum() < 3:
                song["stems"][k] = {"active_pct": round(100 * act.mean(), 1), "silent": True}
                continue
            lvl = 10 * math.log10(np.mean(10 ** (r[act] / 10)) + 1e-20)
            # compare against the mix over the SAME seconds - otherwise an
            # intermittent source (a tom heard only in fills) is measured at its
            # loudest against the song's quiet average.
            mixlvl_act = 10 * math.log10(np.mean(10 ** (mrms[act] / 10)) + 1e-20)
            reg = regions_from_to(scans[k]["to_db"][sl][act].mean(axis=0))
            rtot = 10 * math.log10(sum(10 ** (v / 10) for v in reg.values()) + 1e-20)
            song["stems"][k] = {
                "level_db": round(lvl, 1),
                "rel_mix_db": round(lvl - mixlvl_act, 1),
                "rel_mix_song_db": round(lvl - mixlvl, 1),
                "active_pct": round(100 * act.mean(), 1),
                "floor_db": round(float(np.percentile(r, 10)), 1),
                "peak_db": round(scans[k]["peak_db"], 1),
                "regions_rel": {kk: round(vv - rtot, 2) for kk, vv in reg.items()},
                "silent": False,
            }
        result["songs"].append(song)

    js = json.dumps(result, indent=1)
    if a.out:
        open(a.out, "w").write(js)
        print(f"wrote {a.out}", file=sys.stderr)
    else:
        print(js)


if __name__ == "__main__":
    main()
