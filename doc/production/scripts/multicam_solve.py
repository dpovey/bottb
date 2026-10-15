#!/usr/bin/env python3
"""Piecewise picture sync: audio placement + picture_sync windows -> AppendToTimeline plan.

Usage:
  multicam_solve.py placements.json pgrid*.json --anchor 3O1A7144 --truth C1362 C1363 C1364 C1365
                    --tracks tracks.json [--set-splits 2290 3830 5900 8020] [--min-r 0.5] > plan.json

Why piecewise (Sydney 2026, 2026-10-13): against picture, cameras step by about one frame now and then
relative to their own audio (the files hold every frame, so the camera re-syncs internally). The anchor
(Static Desk) stepped at ~5900 s and ~8640 s, seen together by every other camera; Stage Right stepped
once at ~4450 s, Desk Tracking once at ~7000 s. One offset per clip cannot be frame-accurate all night.

Model
  L(c, w)  picture_sync lag of clip c vs the anchor in window w (ms; + = c's picture lands later).
  G(T)     the anchor's picture error at REF time T, taken from the TRUTH camera (drum cam: its mic is beside
           the kit, so its audio placement is picture-true to a few ms): G = L(truth, w), piecewise.
  N(c, w)  = L(c, w) - G(T_w): how many ms to move c EARLIER. The anchor itself gets N = -G.
  Runs: consecutive good windows (r >= min_r) whose N agrees within +/-15 ms; a lone window that disagrees
  with both neighbours is dropped as an outlier (the one-frame alias seen in ~1 window in 8). Run boundaries
  sit midway between the last window of one run and the first of the next. Clips with no good window take
  their camera's median N (printed as 'camera median').
  Pieces: each clip is split at its run boundaries (and at --set-splits for clips with b_ppm, the drift
  fit), each piece placed at audio-model offset at its middle minus N/1000.
"""
import argparse
import json
import math

import numpy as np


def runs_of(ws, tol=15.0):
    """ws: list of (T, val). Returns list of (T_first, T_last, median) runs, outliers dropped."""
    ws = sorted(ws)
    keep = []
    for i, (T, v) in enumerate(ws):
        prev = ws[i - 1][1] if i > 0 else None
        nxt = ws[i + 1][1] if i + 1 < len(ws) else None
        neigh = [x for x in (prev, nxt) if x is not None]
        if len(neigh) == 2 and all(abs(v - x) > tol for x in neigh) and abs(prev - nxt) <= tol:
            continue  # lone alias between two agreeing neighbours
        keep.append((T, v))
    out = []
    for T, v in keep:
        if out and abs(v - np.median(out[-1][2])) <= tol:
            out[-1][1] = T
            out[-1][2].append(v)
        else:
            out.append([T, T, [v]])
    return [(a, b, float(np.median(vals)), len(vals)) for a, b, vals in out]


def piecewise(runs, T):
    """Value of the run covering T (boundaries midway between runs; ends extend)."""
    if not runs:
        return None
    for i, (a, b, v, _) in enumerate(runs):
        lo = -math.inf if i == 0 else (runs[i - 1][1] + a) / 2
        hi = math.inf if i == len(runs) - 1 else (b + runs[i + 1][0]) / 2
        if lo <= T < hi:
            return v
    return runs[-1][2]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("placements")
    ap.add_argument("pgrids", nargs="+")
    ap.add_argument("--anchor", required=True)
    ap.add_argument("--truth", nargs="+", required=True)
    ap.add_argument("--tracks", required=True)
    ap.add_argument("--set-splits", type=float, nargs="*", default=[2290, 3830, 5900, 8020])
    ap.add_argument("--min-r", type=float, default=0.5)
    ap.add_argument("--tc0-ref", type=float, default=2.8025625)
    ap.add_argument("--tc0-frame", type=int, default=90000)
    ap.add_argument("--fps", type=int, default=25)
    a = ap.parse_args()
    clips = {c["name"]: c for c in json.load(open(a.placements))["clips"]}
    tracks = json.load(open(a.tracks))
    lag = {}
    for p in a.pgrids:
        for n, ws in json.load(open(p)).items():
            for w in ws:  # one entry per window time across all files (a short clip can repeat its only window)
                if w["r"] >= a.min_r and round(w["T0"]) not in {round(x["T0"]) for x in lag.get(n, [])}:
                    lag.setdefault(n, []).append(w)
    # G(T) from the truth camera's windows (each window: T0 centre)
    g_ws = [(w["T0"] + w["win_s"] / 2, w["lag_ms"]) for n in a.truth for w in lag.get(n, [])]
    G = runs_of(g_ws)
    log = {"G_runs": [(round(x, 0), round(y, 0), round(v, 1), k) for x, y, v, k in G]}
    # N runs per clip
    Nr = {}
    for n in clips:
        if n == a.anchor:
            Nr[n] = [(x, y, -v, k) for x, y, v, k in G]
            continue
        if n in a.truth:
            Nr[n] = [(-math.inf, math.inf, 0.0, 0)]
            continue
        ws = [(w["T0"] + w["win_s"] / 2, w["lag_ms"] - piecewise(G, w["T0"] + w["win_s"] / 2)) for w in lag.get(n, [])]
        Nr[n] = runs_of(ws)
    # single-window runs on short clips (< 120 s) are not trusted: one changeover window, few light events
    for n in list(Nr):
        if clips[n]["dur_s"] < 120 and n not in a.truth and n != a.anchor:
            Nr[n] = [r for r in Nr[n] if r[3] >= 2]
    # fallback: the same camera's nearest-in-time measured run (anchor's camera includes the anchor's runs)
    cam_runs = {}
    for n, r in Nr.items():
        if n in a.truth:
            continue
        for x, y, v, k in r:
            if k > 0:
                cam_runs.setdefault(n[:4], []).append(((x + y) / 2, v, n))
    ops, notes = [], {}
    for n, c in clips.items():
        track = next(v for k, v in tracks.items() if n.startswith(k))
        runs = Nr.get(n) or []
        if not runs:
            mid = c["a"] + c["dur_s"] / 2
            cand = cam_runs.get(n[:4], [])
            if cand:
                T, v, src = min(cand, key=lambda q: abs(q[0] - mid))
                notes[n] = f"no trusted window: nearest same-camera run ({src} @ {T:.0f}s) N {v:+.0f} ms"
            else:
                v = 0.0
                notes[n] = "no trusted window and no camera run: audio placement only"
            runs = [(-math.inf, math.inf, v, 0)]
        else:
            notes[n] = " | ".join(f"{x:.0f}-{y:.0f}s N{v:+.0f}ms(n{k})" for x, y, v, k in runs)
        n_frames = int(math.floor(c["dur_s"] * a.fps + 1e-6))
        b = c.get("b_ppm", 0.0) * 1e-6
        # boundaries in REF time: run boundaries + set splits for drifting clips
        bT = [(runs[i][1] + runs[i + 1][0]) / 2 for i in range(len(runs) - 1)]
        if b:
            bT += a.set_splits
        bounds = sorted({0, n_frames} | {int(round((T - c["a"]) * a.fps)) for T in bT if 0 < (T - c["a"]) * a.fps < n_frames})
        prev_end = None
        for k0, k1 in zip(bounds[:-1], bounds[1:]):
            t_mid = (k0 + k1) / 2 / a.fps
            T_mid = c["a"] + t_mid + b * t_mid
            Nms = piecewise(runs, T_mid) if runs[0][0] != -math.inf else runs[0][2]
            off = c["a"] + b * t_mid - Nms / 1000.0
            rec = int(round(a.tc0_frame + (off - a.tc0_ref) * a.fps)) + k0
            if prev_end is not None and rec < prev_end:
                k0 += prev_end - rec
                rec = prev_end
            if k1 <= k0:
                continue
            ops.append({"name": n, "track": track, "startFrame": k0, "endFrame": k1, "recordFrame": rec,
                        "offset_s": round(off, 4), "N_ms": round(Nms, 1)})
            prev_end = rec + (k1 - k0)
    ops.sort(key=lambda o: (o["track"], o["recordFrame"]))
    for t in sorted({o["track"] for o in ops}):
        tr = [o for o in ops if o["track"] == t]
        for x, y in zip(tr, tr[1:]):
            end = x["recordFrame"] + x["endFrame"] - x["startFrame"]
            if y["recordFrame"] < end:
                # trim the later piece's head (different clips of one camera overlapping by a frame or two)
                cut = end - y["recordFrame"]
                if cut > 5:
                    raise SystemExit(f"overlap {cut} frames on track {t}: {x['name']} / {y['name']}")
                y["startFrame"] += cut
                y["recordFrame"] = end
    log["notes"] = notes
    print(json.dumps({"log": log, "ops": ops}, indent=1))


if __name__ == "__main__":
    main()
