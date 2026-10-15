#!/usr/bin/env python3
"""Picture-to-picture sync check: stage-light changes reach every camera at the same instant.

Usage:
  picture_sync.py placements.json --anchor NAME [--windows 3] [--win-s 90] [--sets sets.json] --cache DIR [--out out.json]

placements.json: {"clips": [{"name": "3O1A7144", "path": "/Volumes/.../3O1A7144.MP4", "dur_s": 9725.44,
                              "a": 1.091, "b_ppm": 8.07}, ...]}
  A clip's audio-aligned position: REF time of source time t = a + t * (1 + b_ppm * 1e-6) ... approximately a + t
  + b_ppm*1e-6*t (drift of the camera clock against REF).
--sets: [[start_s, end_s], ...] REF ranges where bands play (windows are taken only inside them).

For each clip (other than the anchor) it takes up to N windows of win_s seconds inside a set and inside
the anchor, decodes both at 64x36 grey (VideoToolbox, ~0.65 GB peak per ffmpeg, one at a time), and
cross-correlates the frame-to-frame change of log mean luma on a 1 ms grid (+/-200 ms). Output per window:
lag_ms (positive = the clip's picture events land LATER than the anchor's at the audio-aligned placement,
so move the clip EARLIER by lag_ms) and r.

Proven 2026-10-13 on Sydney 2026 (Killing in the Name, 5 cameras): pairwise lags closed within 2 ms
(A-B + B-C = A-C), r 0.47-0.85. Audio alignment leaves FOH cameras ~32 ms early vs the drum cam
(sound travel) and a roaming camera anywhere; this measures what audio cannot.
"""
import argparse
import json
import math
import os
import subprocess

import numpy as np

FPS = 25


def ref_time(c, t):
    return c["a"] + t + c.get("b_ppm", 0.0) * 1e-6 * t


def src_time(c, T):
    k = 1 + c.get("b_ppm", 0.0) * 1e-6
    return (T - c["a"]) / k


def luma(c, T0, dur, cache):
    """Decoded log-mean-luma per frame from REF time T0; returns (ref time of each frame, values)."""
    ss = max(0.0, src_time(c, T0))
    fn = os.path.join(cache, f"{c['name']}_{ss:.3f}_{dur:.0f}.gray")
    if not os.path.exists(fn):
        part = f"{fn}.{os.getpid()}.part"
        subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-hwaccel", "videotoolbox", "-ss", f"{ss:.3f}",
                        "-i", c["path"], "-t", f"{dur}", "-vf", "scale=64:36,format=gray", "-f", "rawvideo",
                        "-y", part], check=True, stderr=subprocess.DEVNULL)
        os.replace(part, fn)
    x = np.fromfile(fn, np.uint8).reshape(-1, 36, 64).astype(float)
    k0 = math.ceil(ss * FPS - 1e-6)
    t = np.array([ref_time(c, (k0 + i) / FPS) for i in range(len(x))])
    return t, np.log(x.mean(axis=(1, 2)) + 1)


def change_signal(t, m, grid):
    d = np.diff(m)
    td = (t[1:] + t[:-1]) / 2
    return np.interp(grid, td, d, left=0, right=0)


def lag_ms(a, b, maxms=200):
    best = (-2, 0)
    na, nb = np.linalg.norm(a), np.linalg.norm(b)
    for L in range(-maxms, maxms + 1):
        c = np.dot(a[L:], b[:len(b) - L]) if L >= 0 else np.dot(a[:L], b[-L:])
        best = max(best, (c / (na * nb + 1e-12), L))
    # parabolic refinement is pointless at 1 ms; rolling shutter limits accuracy to a few ms
    return best[1], best[0]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("placements")
    ap.add_argument("--anchor", required=True, nargs="+", help="anchor clip name(s); first that covers the window is used")
    ap.add_argument("--windows", type=int, default=3)
    ap.add_argument("--win-s", type=float, default=90)
    ap.add_argument("--sets")
    ap.add_argument("--cache", required=True)
    ap.add_argument("--only", nargs="*")
    ap.add_argument("--grid", type=float, help="windows at fixed REF times every GRID s inside each set (shared anchor decodes); overrides --windows")
    ap.add_argument("--min-r", type=float, default=0.5)
    ap.add_argument("--out")
    a = ap.parse_args()
    os.makedirs(a.cache, exist_ok=True)
    clips = {c["name"]: c for c in json.load(open(a.placements))["clips"]}
    sets = json.load(open(a.sets)) if a.sets else [[-1e9, 1e9]]
    out = {}
    for name, c in clips.items():
        if name in a.anchor or (a.only and name not in a.only):
            continue
        lo, hi = ref_time(c, 0) + 2, ref_time(c, c["dur_s"]) - 2
        res = []
        for an in a.anchor:
            ac = clips[an]
            alo, ahi = ref_time(ac, 0) + 2, ref_time(ac, ac["dur_s"]) - 2
            spans = [(max(lo, alo, s0), min(hi, ahi, s1)) for s0, s1 in sets]
            spans = [(s0, s1) for s0, s1 in spans if s1 - s0 >= min(a.win_s, 20)]
            if not spans:
                continue
            if a.grid:
                picks = []
                for gs0, gs1 in sets:
                    T = gs0 + 5
                    while T + a.win_s <= gs1:
                        if any(s0 <= T and T + a.win_s <= s1 for s0, s1 in spans):
                            picks.append((T, a.win_s))
                        T += a.grid
                if not picks:  # short clip: one window inside it
                    s0, s1 = max(spans, key=lambda x: x[1] - x[0])
                    w = min(a.win_s, s1 - s0)
                    picks = [(s0, w)]
            else:
                picks = []
            total = sum(s1 - s0 for s0, s1 in spans)
            # spread N windows over the covered set-time
            for q in ([] if a.grid else np.linspace(0, total, a.windows + 2)[1:-1]):
                for s0, s1 in spans:
                    if q <= s1 - s0:
                        w = min(a.win_s, s1 - s0)
                        picks.append((max(s0, s0 + q - w / 2), w)) if s0 + q - w / 2 + w <= s1 else picks.append((s1 - w, w))
                        break
                    q -= s1 - s0
            for T0, w in picks:
                tc, mc = luma(c, T0, w, a.cache)
                ta, ma = luma(ac, T0, w, a.cache)
                grid = np.arange(T0 + 0.5, T0 + w - 0.5, 0.001)
                L, r = lag_ms(change_signal(tc, mc, grid), change_signal(ta, ma, grid))
                res.append({"T0": round(T0, 2), "win_s": w, "anchor": an, "lag_ms": L, "r": round(float(r), 3)})
            break
        out[name] = res
        good = np.array([x["lag_ms"] for x in res if x["r"] >= a.min_r])
        if len(good):
            med = float(np.median(good)); mad = float(1.4826 * np.median(np.abs(good - med)))
            print(f"{name:10} median {med:+5.0f} ms  MAD {mad:4.0f}  n {len(good):2d}/{len(res):2d}  lags {sorted(int(g) for g in good)}", flush=True)
        else:
            print(f"{name:10} NO WINDOW r>={a.min_r}  ({len(res)} tried)", flush=True)
    if a.out:
        json.dump(out, open(a.out, "w"), indent=1)


if __name__ == "__main__":
    main()
