#!/usr/bin/env python3
"""Find cuts whose picture has a hard black edge (a pan or reframe outside the zoom) on a render.

Usage: venv/bin/python edge_scan.py <cut_list.json> <render.mp4> [--first-frame RECORD]
cut_list.json = the gigstills cut list (items with record_in/record_out/angle/index); the render's frame 0 is
--first-frame (default: the first item's record_in). Samples 2 frames per cut at 480x270 and reports full-height or
full-width bands of exact black (<= 2/255): >= 10 px left/right, >= 8 px top/bottom.
Ignore bottom-only hits on a dark-floored Wide shot and split-screen panels covered by another track. Built after Jamazon
2026-10-05, where a keyframed pan from a 9:16 reel left 30 % of an audience cut black and GetProperty("Pan") read 0.
"""
import json, subprocess, sys
import numpy as np

def main():
    args = sys.argv[1:]
    first = None
    if "--first-frame" in args:
        i = args.index("--first-frame"); first = int(args[i + 1]); del args[i:i + 2]
    cl, render = args
    items = json.load(open(cl))["items"]
    first = items[0]["record_in"] if first is None else first
    tc = lambda f: "%02d:%02d:%02d:%02d" % (f // 90000, f // 1500 % 60, f // 25 % 60, f % 25)
    for c in items:
        for frac in (0.3, 0.7):
            rec = int(c["record_in"] + frac * (c["record_out"] - c["record_in"]))
            raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{(rec - first) / 25:.2f}", "-i", render, "-frames:v", "1",
                                  "-vf", "scale=480:270,format=gray", "-f", "rawvideo", "-"], capture_output=True).stdout
            if len(raw) < 480 * 270:
                continue
            F = np.frombuffer(raw, np.uint8).reshape(270, 480)
            col, row = F.max(0), F.max(1)
            L, R = int(np.argmax(col > 2)), int(np.argmax(col[::-1] > 2))
            T, B = int(np.argmax(row > 2)), int(np.argmax(row[::-1] > 2))
            if max(L, R) >= 10 or max(T, B) >= 8:
                print(c["index"], c.get("angle"), c["record_in"], tc(rec), "L R T B px:", L, R, T, B)
                break

if __name__ == "__main__":
    main()
