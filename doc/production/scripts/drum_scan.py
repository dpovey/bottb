#!/usr/bin/env python3
"""Drum-kit diagnostics for a live multitrack stem export.

    drum_scan.py <stems_dir> [--ref-stems DIR] [--windows "300:320,900:920"] [--out J]

Checks, per window:
  * polarity + arrival lag: snare top vs OH, snare bottom vs snare top, kick in vs kick out
  * snare tone in mix context: body (150-250) vs crack (2-5k) vs ring, against a reference kit
  * snare-bottom trigger health: do sampler hits line up with real snare hits?
  * kit tonal balance (drum bus or summed kit) against a reference kit
  * stereo width of OH / Room (dual-mono detection)
"""
import argparse, json, math, os, re, subprocess, sys
import numpy as np
from scipy.signal import correlate, butter, sosfiltfilt, find_peaks

SR = 48000


def load(path, start, dur, pan="0.5*c0+0.5*c1"):
    ch = int(subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "stream=channels", "-of", "csv=p=0", path]
    ).decode().strip().split(",")[0])
    af = f"pan=mono|c0={pan}" if ch > 1 else "aformat=channel_layouts=mono"
    cmd = ["ffmpeg", "-v", "error", "-ss", str(start), "-t", str(dur), "-i", path,
           "-af", af, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"]
    return np.frombuffer(subprocess.check_output(cmd), dtype=np.float32).astype(np.float64)


def bp(x, lo, hi):
    return sosfiltfilt(butter(4, [lo, hi], btype="band", fs=SR, output="sos"), x)


def env(x, hz=400):
    """Onset envelope: rectified, band-limited, smoothed."""
    e = np.abs(bp(x, 100, 8000))
    w = int(SR / hz)
    return np.convolve(e, np.ones(w) / w, mode="same")


def onsets(x, thresh_rel=0.25, min_gap_ms=60):
    e = env(x)
    if e.max() <= 0:
        return np.array([], int)
    pk, _ = find_peaks(e, height=thresh_rel * np.percentile(e, 99.5),
                       distance=int(SR * min_gap_ms / 1000))
    return pk


def polarity_lag(a, b, band, maxlag_ms=25):
    """Return (lag_samples, corr) of a vs b; lag<0 => a arrives earlier."""
    A = bp(a, *band); B = bp(b, *band)
    A = A / (np.std(A) + 1e-12); B = B / (np.std(B) + 1e-12)
    ml = int(SR * maxlag_ms / 1000)
    c = correlate(A, B, mode="full", method="fft") / len(A)
    mid = len(A) - 1
    seg = c[mid - ml: mid + ml + 1]
    k = int(np.argmax(np.abs(seg)))
    return k - ml, float(seg[k])


def band_db(x, lo, hi):
    X = np.abs(np.fft.rfft(x * np.hanning(len(x)))) ** 2
    fr = np.fft.rfftfreq(len(x), 1 / SR)
    sel = (fr >= lo) & (fr < hi)
    return 10 * math.log10(X[sel].sum() + 1e-20)


def snare_tone(snare, hits, pre=0.002, post=0.20):
    """Average spectrum shape around snare hits -> body/crack/ring numbers."""
    if len(hits) == 0:
        return None
    segs = []
    for h in hits:
        a = int(h - pre * SR); b = int(h + post * SR)
        if a < 0 or b > len(snare):
            continue
        segs.append(snare[a:b])
    if not segs:
        return None
    L = min(len(s) for s in segs)
    seg = np.mean([s[:L] for s in segs], axis=0)
    tot = band_db(seg, 60, 16000)
    out = {"hits": len(segs)}
    for name, lo, hi in (("low", 60, 150), ("body", 150, 250), ("mid", 250, 800),
                         ("ring", 800, 2000), ("crack", 2000, 5000), ("sizzle", 5000, 12000)):
        out[name] = round(band_db(seg, lo, hi) - tot, 2)
    out["body_minus_crack"] = round(out["body"] - out["crack"], 2)
    return out


def stem_map(d):
    m = {}
    for f in sorted(os.listdir(d)):
        if not f.lower().endswith((".wav", ".aif", ".aiff", ".flac")) or f.startswith("._"):
            continue
        k = re.sub(r"_\d+$", "", re.sub(r"\.wav$", "", f, flags=re.I))
        k = re.sub(r"^\d+\s+", "", k).strip().lower()
        m[k] = os.path.join(d, f)
    return m


def kit_regions(paths, start, dur):
    """Summed-kit tonal balance (relative dB per region)."""
    lin = None
    for p in paths:
        x = load(p, start, dur)
        X = np.abs(np.fft.rfft(x * np.hanning(len(x)))) ** 2
        lin = X if lin is None else lin + X
    fr = np.fft.rfftfreq(len(x), 1 / SR)
    tot = 10 * math.log10(lin.sum() + 1e-20)
    out = {}
    for name, lo, hi in (("weight", 40, 80), ("body", 80, 160), ("mud", 160, 300),
                         ("box", 300, 500), ("honk", 500, 800), ("nasal", 800, 1500),
                         ("presence", 1500, 4000), ("edge", 4000, 8000), ("air", 8000, 16000)):
        sel = (fr >= lo) & (fr < hi)
        out[name] = round(10 * math.log10(lin[sel].sum() + 1e-20) - tot, 2)
    return out


def analyse(d, start, dur, label):
    m = stem_map(d)
    r = {"label": label, "window": [start, start + dur], "stems_found": sorted(m)}

    def g(*names):
        for n in names:
            if n in m:
                return m[n]
        return None

    snare = g("snare top"); sbot = g("snare bottom"); oh = g("oh")
    kin = g("kick in"); kout = g("kick out"); room = g("room")

    sig = {}
    for nm, p in (("snare", snare), ("sbot", sbot), ("oh", oh), ("kin", kin), ("kout", kout)):
        if p:
            sig[nm] = load(p, start, dur)

    # polarity / lag
    r["alignment"] = {}
    if "snare" in sig and "oh" in sig:
        lag, c = polarity_lag(sig["snare"], sig["oh"], (120, 1500))
        r["alignment"]["snare_vs_oh"] = {"lag_smp": lag, "lag_ms": round(lag / 48, 2),
                                         "corr": round(c, 3),
                                         "polarity": "SAME" if c > 0 else "INVERTED"}
    if "sbot" in sig and "snare" in sig:
        lag, c = polarity_lag(sig["sbot"], sig["snare"], (150, 4000))
        r["alignment"]["sbot_vs_snare"] = {"lag_smp": lag, "lag_ms": round(lag / 48, 2),
                                           "corr": round(c, 3),
                                           "polarity": "SAME" if c > 0 else "INVERTED"}
    if "kin" in sig and "kout" in sig:
        lag, c = polarity_lag(sig["kin"], sig["kout"], (40, 400))
        r["alignment"]["kickin_vs_kickout"] = {"lag_smp": lag, "lag_ms": round(lag / 48, 2),
                                               "corr": round(c, 3),
                                               "polarity": "SAME" if c > 0 else "INVERTED"}

    # snare-bottom trigger health
    if "snare" in sig and "sbot" in sig:
        ht = onsets(sig["snare"]); hb = onsets(sig["sbot"])
        matched, offs = 0, []
        for h in hb:
            if len(ht) == 0:
                break
            j = int(np.argmin(np.abs(ht - h)))
            dt = (h - ht[j]) / SR
            if abs(dt) < 0.05:
                matched += 1; offs.append(dt * 1000)
        r["snare_bottom_trigger"] = {
            "snare_hits": int(len(ht)), "sampler_hits": int(len(hb)),
            "matched_pct": round(100 * matched / max(1, len(hb)), 1),
            "median_offset_ms": round(float(np.median(offs)), 1) if offs else None,
            "level_rel_snare_db": round(20 * math.log10((np.std(sig["sbot"]) + 1e-12) /
                                                        (np.std(sig["snare"]) + 1e-12)), 1),
        }

    # snare tone, in isolation and in kit context
    if "snare" in sig:
        ht = onsets(sig["snare"])
        r["snare_tone"] = snare_tone(sig["snare"], ht)
        kit_paths = [p for p in (kin, kout, snare, sbot, g("hi-hats"), g("tom 1"), g("tom 2"),
                                 g("floor tom"), oh, room) if p]
        if kit_paths:
            r["kit_regions"] = kit_regions(kit_paths, start, dur)
        dbus = g("drums")
        if dbus:
            r["drum_bus_regions"] = kit_regions([dbus], start, dur)

    # stereo width of OH / Room
    r["width"] = {}
    for nm, p in (("oh", oh), ("room", room)):
        if not p:
            continue
        ch = int(subprocess.check_output(
            ["ffprobe", "-v", "error", "-show_entries", "stream=channels", "-of", "csv=p=0", p]
        ).decode().strip().split(",")[0])
        if ch < 2:
            r["width"][nm] = {"channels": ch, "note": "mono file"}
            continue
        L = load(p, start, dur, "c0"); R = load(p, start, dur, "c1")
        r["width"][nm] = {
            "channels": ch,
            "corr": round(float(np.corrcoef(L, R)[0, 1]), 3),
            "side_over_mid": round(float(np.std(L - R) / (np.std(L + R) + 1e-12)), 3),
            "L_db": round(20 * math.log10(np.std(L) + 1e-12), 1),
            "R_db": round(20 * math.log10(np.std(R) + 1e-12), 1),
        }
    return r


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("stems_dir")
    ap.add_argument("--ref-stems", default=None)
    ap.add_argument("--windows", default=None, help="'start:end,...' seconds; default = loudest 20 s")
    ap.add_argument("--ref-window", default=None, help="'start:end' for the reference dir")
    ap.add_argument("--out", default=None)
    a = ap.parse_args()

    wins = ([tuple(float(v) for v in w.split(":")) for w in a.windows.split(",")]
            if a.windows else None)
    if wins is None:
        m = stem_map(a.stems_dir)
        p = m.get("oh") or list(m.values())[0]
        dur = float(subprocess.check_output(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p]
        ).decode().strip())
        best, bl = 0, -1e9
        for t in np.arange(30, dur - 40, 30):
            x = load(p, t, 5)
            lv = 20 * math.log10(np.std(x) + 1e-12)
            if lv > bl:
                bl, best = lv, t
        wins = [(best, best + 20)]

    out = {"stems_dir": a.stems_dir, "windows": []}
    for s, e in wins:
        print(f"  window {s:.0f}-{e:.0f}s …", file=sys.stderr)
        out["windows"].append(analyse(a.stems_dir, s, e - s, f"{s:.0f}-{e:.0f}s"))
    if a.ref_stems:
        rs, re_ = ([float(v) for v in a.ref_window.split(":")] if a.ref_window else (60, 80))
        print(f"  reference {rs:.0f}-{re_:.0f}s …", file=sys.stderr)
        out["reference"] = analyse(a.ref_stems, rs, re_ - rs, "reference")

    js = json.dumps(out, indent=1)
    if a.out:
        open(a.out, "w").write(js); print(f"wrote {a.out}", file=sys.stderr)
    else:
        print(js)


if __name__ == "__main__":
    main()
