#!/usr/bin/env python3
"""Turn measured placements into AppendToTimeline operations for a multicam sync timeline.

Usage:
  multicam_plan.py placements.json corrections.json --tracks tracks.json [--splits 2290 3830 ...]
                   [--tc0-ref 2.8025625] [--tc0-frame 90000] [--fps 25] > plan.json

placements.json  as picture_sync.py: clips with name, dur_s, a (REF s of source 0, audio-aligned), b_ppm.
corrections.json {name: ms}  picture correction: the clip's picture lands this many ms LATE at the audio
                 placement, so it is moved EARLIER by that much (picture_sync lag, made absolute to the anchor
                 camera chosen as picture-true).
tracks.json      {name_prefix: track_index}, e.g. {"3O1A": 1, "1O0A": 2, ...}.

Timeline frame of REF time T = tc0_frame + (T - tc0_ref) * fps. A clip with b_ppm != 0 is split at the --splits
(REF s, put them in changeovers) and each piece is placed at the drift-corrected offset at its middle, so the
error inside a piece is <= drift x half its length. Pieces of one clip never overlap: a piece that would start
on or before the previous piece's last frame is trimmed at its head.
Output: [{"name", "track", "startFrame", "endFrame", "recordFrame", "offset_s"}], endFrame exclusive.
"""
import argparse
import json
import math


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("placements")
    ap.add_argument("corrections")
    ap.add_argument("--tracks", required=True)
    ap.add_argument("--splits", type=float, nargs="*", default=[])
    ap.add_argument("--tc0-ref", type=float, default=2.8025625)
    ap.add_argument("--tc0-frame", type=int, default=90000)
    ap.add_argument("--fps", type=int, default=25)
    a = ap.parse_args()
    clips = json.load(open(a.placements))["clips"]
    corr = json.load(open(a.corrections))
    tracks = json.load(open(a.tracks))
    ops = []
    for c in clips:
        track = next(v for k, v in tracks.items() if c["name"].startswith(k))
        n_frames = int(math.floor(c["dur_s"] * a.fps + 1e-6))
        a0 = c["a"] - corr.get(c["name"], 0.0) / 1000.0
        b = c.get("b_ppm", 0.0) * 1e-6
        # piece boundaries in source frames
        bounds = [0]
        if b:
            for s in a.splits:
                k = int(round((s - a0) * a.fps))
                if 0 < k < n_frames:
                    bounds.append(k)
        bounds.append(n_frames)
        prev_end = None
        for k0, k1 in zip(bounds[:-1], bounds[1:]):
            mid_t = (k0 + k1) / 2 / a.fps
            off = a0 + b * mid_t  # REF s of source 0 for this piece
            rec0 = int(round(a.tc0_frame + (off - a.tc0_ref) * a.fps))  # timeline frame of source frame 0
            rec = rec0 + k0
            if prev_end is not None and rec < prev_end:
                k0 += prev_end - rec
                rec = prev_end
            if k1 <= k0:
                continue
            ops.append({"name": c["name"], "track": track, "startFrame": k0, "endFrame": k1,
                        "recordFrame": rec, "offset_s": round(off, 4)})
            prev_end = rec + (k1 - k0)
    ops.sort(key=lambda o: (o["track"], o["recordFrame"]))
    # overlap check per track (different clips of one camera must not overlap either)
    for t in sorted({o["track"] for o in ops}):
        tr = [o for o in ops if o["track"] == t]
        for x, y in zip(tr, tr[1:]):
            end = x["recordFrame"] + x["endFrame"] - x["startFrame"]
            if y["recordFrame"] < end:
                raise SystemExit(f"overlap on track {t}: {x['name']} ends {end} > {y['name']} starts {y['recordFrame']}")
    print(json.dumps(ops, indent=1))


if __name__ == "__main__":
    main()
