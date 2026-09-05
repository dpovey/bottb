#!/usr/bin/env python3
"""Per-hit drum identification and bleed measurement for live multitrack drum mics.

Every close mic on a live kit contains the whole kit. This tool answers three
questions that follow from that, all of them per hit rather than per track:

    identify    for each detected hit, WHICH drum was struck -- decided by which
                mic leads after each mic's own bleed floor is subtracted, not by
                which mic is loudest
    separation  how far below the direct hit each mic's bleed floor sits, which
                is what decides whether a region can be time-shifted safely
    delay       inter-channel arrival delay, phase-whitened and bounded by the
                physical geometry

    drum_hit_id.py identify   <stems_dir> --start S --end E [--mics kick=01\\ Kick\\ In.wav ...]
    drum_hit_id.py separation <stems_dir> --start S --end E
    drum_hit_id.py delay      <stems_dir> --start S --end E --from kick --to oh

Mic files are matched loosely from the BOTTB naming ("01 Kick In.wav" -> "kick in")
unless --mics is given. Stereo files are summed to mono.

------------------------------------------------------------------------------
Three rules this encodes, each of which cost a wrong finding on BOTTB Brisbane 2026
------------------------------------------------------------------------------

1. SUBTRACT A PRE-HIT WINDOW IN THE POWER DOMAIN before comparing two mics.
   Raw hit spectra compare the mics' bleed floors as much as their sources. The
   windows used here are [-75,-20] ms for the floor and [0,+30] ms for the hit,
   the same ones that corrected a "snare 6 dB darker" finding that was entirely
   the hat content of a different band's snare mic.

2. A CORRELATION RESULT PINNED TO ITS SEARCH BOUNDARY IS NOT A MEASUREMENT.
   If the peak lands on the first or last lag in the window, the true peak is
   outside it. Report "no result", never the boundary value. `gcc_phat()` below
   returns None in that case rather than a number.

3. USE PHASE WHITENING WITH A GEOMETRY-BOUNDED SEARCH for any inter-channel delay.
   Plain cross-correlation on a low-frequency source cycle-slips by whole periods
   of its fundamental and returns a confident, reproducible, tight-IQR answer that
   is exactly one period wrong. A 60 Hz kick did this at 780 samples (16.25 ms,
   one period) on this project, to two independent sessions on the same day.
   Bound max_lag by what the geometry allows -- about +-5 ms within a drum kit,
   +-30 ms across a stage -- and treat any plain-correlation answer near a
   multiple of the source's fundamental period as a cycle slip until GCC-PHAT
   confirms it.

Measured on Epsonics (Brisbane 2026), song 6 chorus, as a sanity reference:

    mic          direct dB   pre-hit dB   separation   slip safe?
    Snare Top        -23.2       -55.9        +32.7       yes, +-0.20 dB
    Kick In          -23.7       -54.6        +30.9       yes, +-0.24 dB
    Kick Out         -24.7       -55.5        +30.8       yes, +-0.25 dB
    OH               -26.4       -42.1        +15.8       marginal
    Hi-Hats          -26.8       -41.0        +14.2       marginal
    Floor Tom        -26.7       -40.2        +13.5       marginal
    Tom 1            -42.2       -50.6         +8.4       no
    Tom 2            -40.7       -46.4         +5.6       no
    Room             -30.5       -31.9         +1.4       no

Reproduce with:
    drum_hit_id.py separation "01_Media/Epsonics" --start 1711 --end 1736

Separation decides whether a close mic can be slip-edited. Moving a region whose
bleed sits X dB below its direct signal combs that bleed against the same source
in the overheads by 20*log10(1 +- 10**(-X/20)): +-0.25 dB at 31 dB of separation
(inaudible, slip freely), +2.5/-3.6 dB at 9 dB (audible, do not).
"""
import argparse
import glob
import os
import re
import sys

import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt, hilbert

SR_DEFAULT = 48000
FLOOR_WIN = (-0.075, -0.020)   # pre-hit bleed floor
HIT_WIN = (0.0, 0.030)         # direct hit


def stem_key(path):
    n = re.sub(r"\.(wav|aif|aiff)$", "", os.path.basename(path), flags=re.I)
    n = re.sub(r"_\d+$", "", n)
    n = re.sub(r"^\d+\s+", "", n)
    return n.strip().lower()


def load(path, start, end):
    """Mono float64 for [start, end) seconds."""
    info = sf.info(path)
    sr = info.samplerate
    x, _ = sf.read(path, start=int(start * sr), stop=int(end * sr), dtype="float32")
    return (x.mean(1) if x.ndim > 1 else x).astype(np.float64), sr


def instrument_of(key):
    """Group mics that are on the same drum: 'kick in'/'kick out' -> 'kick'.

    Without this, identification compares two mics on ONE drum against each
    other, they tie, and every kick reads as ambiguous.
    """
    k = key.lower()
    for inst in ("kick", "snare", "hi-hat", "hat", "floor tom", "tom", "oh",
                 "overhead", "room"):
        if k.startswith(inst) or k == inst:
            return "hat" if inst == "hi-hat" else ("oh" if inst == "overhead" else inst)
    return k


def discover(stems_dir, mics):
    if mics:
        return {k: os.path.join(stems_dir, v) for k, v in mics.items()}
    out = {}
    for f in sorted(glob.glob(os.path.join(stems_dir, "*.wav")) +
                    glob.glob(os.path.join(stems_dir, "*.aif*"))):
        k = stem_key(f)
        if any(w in k for w in ("kick", "snare", "hat", "tom", "oh", "overhead", "room")):
            out[k] = f
    return out


def onsets(x, sr, thr_pct=97.0, min_sep_s=0.06, rise=3.0):
    """Absolute-threshold onsets, calibrated on the loud part of the passage.

    A *relative* threshold finds bleed transients wherever the drum is not
    playing and then scores the mic's correct silence as a miss. Calibrating on
    a high percentile of the whole passage avoids that.
    """
    env = np.abs(hilbert(x))
    thr = np.percentile(env, thr_pct)
    min_sep = int(min_sep_s * sr)
    out, last = [], -10 ** 9
    look = max(1, int(0.004 * sr))
    for i in range(look, len(env) - int(0.05 * sr), max(1, look // 4)):
        if env[i] > thr and env[i] > env[i - look] * rise and i - last > min_sep:
            out.append(i)
            last = i
    return np.array(out, dtype=int)


def hit_levels(x, sr, idx):
    """(direct dB, pre-hit floor dB, bleed-corrected direct dB) for one hit."""
    h0, h1 = int(idx + HIT_WIN[0] * sr), int(idx + HIT_WIN[1] * sr)
    f0, f1 = int(idx + FLOOR_WIN[0] * sr), int(idx + FLOOR_WIN[1] * sr)
    if f0 < 0 or h1 > len(x):
        return None
    hit = float((x[h0:h1] ** 2).mean())
    flo = float((x[f0:f1] ** 2).mean())
    clean = max(hit - flo, hit * 0.05)      # never below -13 dB of the raw hit
    to_db = lambda v: 10 * np.log10(v + 1e-30)
    return to_db(hit), to_db(flo), to_db(clean)


def gcc_phat(a, b, sr, max_lag_ms, whiten=True):
    """Delay of b relative to a, in samples, or None if the peak pins the boundary.

    Positive means b is later than a. Returns None rather than a boundary value:
    a peak on the edge of the search window means the true peak is outside it.
    """
    a = a - a.mean()
    b = b - b.mean()
    n = 1 << int(np.ceil(np.log2(len(a) + len(b))))
    A, B = np.fft.rfft(a, n), np.fft.rfft(b, n)
    X = A * np.conj(B)
    if whiten:
        X = X / (np.abs(X) + 1e-12)
    c = np.fft.irfft(X, n)
    m = int(max_lag_ms * sr / 1000.0)
    c = np.concatenate([c[-m:], c[:m + 1]])
    i = int(np.argmax(np.abs(c)))
    if i == 0 or i == len(c) - 1:
        return None, 0.0                      # rule 2: boundary-pinned is no result
    # Sign verified against a synthetic +100-sample delay: the raw argmax runs
    # the other way, so negate. Positive return = b arrives LATER than a.
    return -(i - m), float(np.abs(c[i]) / (np.abs(c).max() + 1e-30))


def cmd_separation(args):
    mics = discover(args.stems_dir, args.mics)
    print(f"Per-hit bleed vs direct, {args.start}-{args.end} s. "
          f"floor {FLOOR_WIN[0]*1000:+.0f}..{FLOOR_WIN[1]*1000:+.0f} ms, "
          f"hit {HIT_WIN[0]*1000:+.0f}..{HIT_WIN[1]*1000:+.0f} ms, medians over hits.\n")
    print("%-16s %6s %11s %11s %11s   %s" %
          ("mic", "hits", "direct dB", "pre-hit dB", "separation", "slip safe?"))
    for name, path in mics.items():
        x, sr = load(path, args.start, args.end)
        idx = onsets(x, sr)
        rows = [hit_levels(x, sr, i) for i in idx]
        rows = [r for r in rows if r]
        if len(rows) < 5:
            print("%-16s %6d   (too few hits to measure)" % (name, len(rows)))
            continue
        d = np.median([r[0] for r in rows])
        f = np.median([r[1] for r in rows])
        sep = d - f
        ripple = 20 * np.log10(1 + 10 ** (-sep / 20))
        verdict = ("yes, comb ripple +-%.2f dB" % ripple if sep >= 25 else
                   "marginal, +-%.1f dB" % ripple if sep >= 12 else
                   "NO, +-%.1f dB" % ripple)
        print("%-16s %6d %11.1f %11.1f %11.1f   %s" % (name, len(rows), d, f, sep, verdict))


def cmd_identify(args):
    mics = discover(args.stems_dir, args.mics)
    data = {}
    sr = None
    for name, path in mics.items():
        data[name], sr = load(path, args.start, args.end)
    n = min(len(v) for v in data.values())
    cands = set()
    for name, x in data.items():
        for i in onsets(x[:n], sr):
            cands.add(int(i))
    merged = []
    for c in sorted(cands):
        if merged and c - merged[-1] <= int(0.025 * sr):
            continue
        merged.append(c)
    names = list(data)
    print(f"{len(merged)} candidate hits in {args.start}-{args.end} s. "
          "Levels are bleed-corrected (hit window minus pre-hit floor, power domain).\n")
    groups = {}
    for k in names:
        groups.setdefault(instrument_of(k), []).append(k)
    print("grouped as: " + ", ".join(f"{g} <- {'+'.join(v)}" for g, v in groups.items()) + "\n")
    print("%10s " % "t (s)" + "".join("%11s" % k[:10] for k in names) + "   verdict")
    for i in merged:
        lv = {}
        for k in names:
            r = hit_levels(data[k], sr, i)
            lv[k] = (r[2] - r[1]) if r else -99.0
        # compare instruments, not mics: two mics on one drum must not compete
        gl = {g: max(lv[k] for k in v) for g, v in groups.items()}
        best = max(gl, key=gl.get)
        second = sorted(gl.values())[-2] if len(gl) > 1 else -99.0
        verdict = best.upper() if gl[best] - second >= args.margin else "ambiguous"
        print("%10.3f " % (args.start + i / sr) +
              "".join("%11.1f" % lv[k] for k in names) + "   " + verdict)


def cmd_delay(args):
    mics = discover(args.stems_dir, args.mics)
    if args.src not in mics or args.dst not in mics:
        sys.exit(f"--from/--to must be among: {', '.join(sorted(mics))}")
    a, sr = load(mics[args.src], args.start, args.end)
    b, _ = load(mics[args.dst], args.start, args.end)
    print(f"Delay of {args.dst} relative to {args.src}, "
          f"search bounded to +-{args.max_lag_ms} ms (rule 3).\n")
    for whiten, label in ((True, "GCC-PHAT"), (False, "plain xcorr")):
        lag, conf = gcc_phat(a, b, sr, args.max_lag_ms, whiten=whiten)
        if lag is None:
            print("  %-12s  NO RESULT (peak pinned to the search boundary)" % label)
        else:
            print("  %-12s  %+5d samples = %+7.2f ms   (peak ratio %.2f)"
                  % (label, lag, lag / sr * 1000, conf))
    print("\nIf the two disagree and the plain figure is near a multiple of the source's\n"
          "fundamental period, the plain figure is a cycle slip. Trust GCC-PHAT.")


def kv(s):
    k, _, v = s.partition("=")
    return k.strip(), v.strip()


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    for name, fn in (("identify", cmd_identify), ("separation", cmd_separation), ("delay", cmd_delay)):
        s = sub.add_parser(name)
        s.add_argument("stems_dir")
        s.add_argument("--start", type=float, required=True, help="seconds")
        s.add_argument("--end", type=float, required=True, help="seconds")
        s.add_argument("--mics", type=kv, nargs="*", default=None,
                       help='name=file.wav, repeatable; default is loose matching')
        if name == "identify":
            s.add_argument("--margin", type=float, default=6.0,
                           help="dB the leading mic must beat the next by (default 6)")
        if name == "delay":
            s.add_argument("--from", dest="src", required=True)
            s.add_argument("--to", dest="dst", required=True)
            s.add_argument("--max-lag-ms", type=float, default=5.0,
                           help="bound by geometry: ~5 within a kit, ~30 across a stage")
        s.set_defaults(func=fn)
    a = p.parse_args()
    if a.mics:
        a.mics = dict(a.mics)
    a.func(a)


if __name__ == "__main__":
    main()
