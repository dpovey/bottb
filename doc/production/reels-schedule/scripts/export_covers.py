#!/usr/bin/env python3
"""Write each reel's chosen cover at 1080x1920 to report/covers/<key>.jpg, from Dean's review documents. Usage: export_covers.py <dir of reviews/*.json>. Run from the project directory."""
import json, os, subprocess, sys
sys.path.insert(0, "scripts")
from page_content import REELS
R = os.path.expanduser("~/src/personal/gigstills/runs/sydney26_reels/report/")
T = "/Volumes/BOTTB/Renders/Thumbnails/"
EARLIER = {"canvanauts": None, "v2voyagers": "StarshipsUFO/v2-voyagers-starships-ufo-instagram", "sos": "SultansOfSwing/total-loss-sultans-of-swing-instagram", "nok": "NoOneKnows/epsonics-no-one-knows-instagram", "sias": "SayItAintSo/jumbo-band-say-it-aint-so-instagram", "otr": "ItsAllComingBackToMeNow/off-the-record-it-s-all-coming-back-to-me-now-instagram", "everlong": "Everlong/shiprex-everlong-instagram", "g4u": "Good4U/bandlassian-good-4-u-instagram"}
files = {r["key"]: r["file"] for r in json.load(open("data/reels.json"))["reels"]}
os.makedirs("report/covers", exist_ok=True)
for r in REELS:
    k = r["key"]
    cover = json.load(open(f"{sys.argv[1]}/{k}.json")).get("cover")
    out = f"report/covers/{k}.jpg"
    if cover == "O":
        src = EARLIER.get(k)
        if src:
            subprocess.run(["cp", T + src + ".jpg", out], check=True)
            print(k, "O", src)
        else:
            print(k, "O: find the earlier cover by hand")
        continue
    if cover in (None, "default"):
        print(k, "no cover file:", cover)
        continue
    t = 0.0 if cover == "first" else 5.5 + (r["d"] - 7) * (int(cover) - 1) / 9
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{t:.2f}", "-i", R + files[k], "-frames:v", "1", "-q:v", "2", out], check=True)
    print(k, cover, f"{t:.2f}s", os.path.getsize(out))
