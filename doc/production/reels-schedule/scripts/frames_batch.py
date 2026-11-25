#!/usr/bin/env python3
"""Run seam_and_frames.sh for each final reel not yet framed, from data/reels.json, and write a contact strip per reel. Run from the project directory."""
import json, os, subprocess, sys
R = os.path.expanduser("~/src/personal/gigstills/runs/sydney26_reels/report/")
strip_dir = sys.argv[1]
log = open("data/seam_2026-11-07.txt", "a")
for r in json.load(open("data/reels.json"))["reels"]:
    if not r["ready"] or os.path.exists(f"report/frames/{r['key']}/c1.jpg"):
        continue
    out = subprocess.run(["zsh", "scripts/seam_and_frames.sh", r["key"], R + r["file"]], capture_output=True, text=True)
    log.write(out.stdout); print(out.stdout.strip(), out.stderr.strip()[-200:])
    ins = sum((["-i", f"report/frames/{r['key']}/c{i}.jpg"] for i in (1, 3, 5, 6, 8, 10)), [])
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *ins, "-filter_complex", "hstack=inputs=6", f"{strip_dir}/sheet_{r['key']}.jpg"], check=True)
