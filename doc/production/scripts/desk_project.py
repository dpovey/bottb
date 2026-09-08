#!/usr/bin/env python3
"""Recover the FOH engineer's balance by projecting the desk mix onto known stems.

    desk_project.py --sources DIR --desk WAV --mixed DIR --songs "a:b,..." [--out J]

The desk mix literally contains each stem (the stems are the console's direct
outs), so for a time-aligned, band-limited stem s and desk mix d the least-squares
gain

    g = <d, s> / <s, s>

is the gain that source has in the PA, with the other instruments acting as
(largely uncorrelated) noise. That is far better conditioned than solving for all
sources at once, which is hopeless when everything plays the same music.

`explained` is the fraction of the stem's own energy that the fit accounts for -
it is the confidence: a source that is buried or heavily re-EQ'd by the desk
scores low and its gain should not be trusted.

Each song is re-aligned to the sample before fitting.
"""
import argparse, json, math, os, re, subprocess, sys
import numpy as np
from scipy.signal import correlate, butter, sosfiltfilt

SR = 48000

# band each source is measured in - chosen where that source dominates
BANDS = {
    "kick in": (45, 120), "kick out": (45, 120), "bass di": (50, 200),
    "snare top": (150, 400), "hi-hats": (4000, 11000),
    "tom 1": (80, 300), "tom 2": (80, 300), "floor tom": (60, 250),
    "oh": (3000, 11000), "room": (300, 3000),
    "gtr 2 di": (400, 3000), "gtr 2": (400, 3000),
    "keys": (300, 3000), "keytar": (300, 3000),
    "vox 1": (300, 3000), "vox 2 lead": (300, 3000),
    "vox 3": (300, 3000), "vox 4": (300, 3000),
}


def key(f):
    n = re.sub(r"\.(wav|aif|aiff|flac)$", "", f, flags=re.I)
    n = re.sub(r"_\d+$", "", n)
    return re.sub(r"^\d+\s+", "", n).strip().lower()


def smap(d):
    return {key(f): os.path.join(d, f) for f in sorted(os.listdir(d))
            if f.lower().endswith((".wav", ".aif", ".aiff", ".flac")) and not f.startswith("._")}


def load(path, start, dur):
    ch = int(subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "stream=channels", "-of", "csv=p=0", path]
    ).decode().strip().split(",")[0])
    af = "pan=mono|c0=0.5*c0+0.5*c1" if ch > 1 else "aformat=channel_layouts=mono"
    raw = subprocess.check_output(
        ["ffmpeg", "-v", "error", "-ss", str(start), "-t", str(dur), "-i", path,
         "-af", af, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"])
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def bp(x, lo, hi):
    hi = min(hi, SR / 2 - 500)
    return sosfiltfilt(butter(4, [lo, hi], btype="band", fs=SR, output="sos"), x)


def align(desk, stem, maxlag_ms=60):
    a = bp(desk, 200, 3000); b = bp(stem, 200, 3000)
    a = a / (np.std(a) + 1e-12); b = b / (np.std(b) + 1e-12)
    ml = int(SR * maxlag_ms / 1000)
    c = correlate(a, b, mode="full", method="fft") / len(a)
    mid = len(a) - 1
    seg = c[mid - ml: mid + ml + 1]
    k = int(np.argmax(np.abs(seg)))
    return k - ml, float(seg[k])


def project(d, s):
    """g and the fraction of d explained by s, both band-limited already."""
    ss = float(np.dot(s, s))
    if ss <= 0:
        return 0.0, 0.0
    g = float(np.dot(d, s)) / ss
    resid = d - g * s
    expl = 1.0 - float(np.var(resid)) / (float(np.var(d)) + 1e-20)
    return g, max(0.0, expl)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sources", required=True)
    ap.add_argument("--desk", required=True)
    ap.add_argument("--mixed", required=True)
    ap.add_argument("--songs", required=True)
    ap.add_argument("--win", type=float, default=40.0, help="seconds analysed per song")
    ap.add_argument("--out", default=None)
    a = ap.parse_args()

    src, mix = smap(a.sources), smap(a.mixed)
    songs = [tuple(float(v) for v in s.split(":")) for s in a.songs.split(",")]
    out = {"desk": a.desk, "songs": []}

    for si, (s0, e0) in enumerate(songs, 1):
        mid = (s0 + e0) / 2
        st = max(s0 + 5, mid - a.win / 2)
        dur = min(a.win, e0 - st - 5)
        print(f"  song {si}: fitting {st:.0f}-{st+dur:.0f}s", file=sys.stderr)
        desk = load(a.desk, st, dur)

        # sample-accurate alignment using a full-band source (the kit)
        ref = src.get("oh") or src.get("snare top")
        lag, lc = align(desk, load(ref, st, dur))
        rec = {"index": si, "window": [round(st, 1), round(st + dur, 1)],
               "align_lag_smp": lag, "align_corr": round(lc, 3), "stems": {}}

        for k, p in src.items():
            if k not in BANDS:
                continue
            lo, hi = BANDS[k]
            x = load(p, st, dur)
            n = min(len(desk), len(x))
            xs = np.roll(x[:n], lag)
            dsk = bp(desk[:n], lo, hi)
            stm = bp(xs, lo, hi)
            if np.std(stm) < 1e-7:
                continue
            g, expl = project(dsk, stm)
            foh_contrib = 20 * math.log10(abs(g) * np.std(stm) + 1e-12)
            rec["stems"][k] = {
                "band": [lo, hi],
                "gain_db": round(20 * math.log10(abs(g) + 1e-12), 1),
                "foh_contrib_db": round(foh_contrib, 1),
                "explained": round(expl, 3),
                "stem_level_db": round(20 * math.log10(np.std(stm) + 1e-12), 1),
            }
            if k in mix:
                y = load(mix[k], st, dur)
                ym = bp(y[:min(len(y), n)], lo, hi)
                rec["stems"][k]["studio_contrib_db"] = round(
                    20 * math.log10(np.std(ym) + 1e-12), 1)

        # normalise both balances so only the *relative* picture is compared
        foh = {k: v["foh_contrib_db"] for k, v in rec["stems"].items() if v["explained"] >= 0.02}
        stu = {k: v["studio_contrib_db"] for k, v in rec["stems"].items()
               if "studio_contrib_db" in v and v["explained"] >= 0.02}
        if foh and stu:
            fo = 10 * math.log10(sum(10 ** (v / 10) for v in foh.values()) + 1e-20)
            so = 10 * math.log10(sum(10 ** (v / 10) for v in stu.values()) + 1e-20)
            for k in rec["stems"]:
                if k in foh and k in stu:
                    rec["stems"][k]["foh_share_db"] = round(foh[k] - fo, 1)
                    rec["stems"][k]["studio_share_db"] = round(stu[k] - so, 1)
                    rec["stems"][k]["delta_db"] = round((stu[k] - so) - (foh[k] - fo), 1)
        out["songs"].append(rec)

    js = json.dumps(out, indent=1)
    if a.out:
        open(a.out, "w").write(js); print(f"wrote {a.out}", file=sys.stderr)
    else:
        print(js)


if __name__ == "__main__":
    main()
