#!/usr/bin/env python3
"""Record one reel's scheduled post in the ledger from data/social_batch_2026-11-07.json.
Usage: record_social.py <key> <tiktok|linkedin|facebook|instagram> [external id]. Run from the repo root."""
import json, subprocess, sys

key, platform = sys.argv[1:3]
ext = sys.argv[3] if len(sys.argv) > 3 else None
r = {x["key"]: x for x in json.load(open("doc/production/reels-schedule/data/social_batch_2026-11-07.json"))}[key]
FIELD = {"tiktok": "tt", "linkedin": "li", "facebook": "fb", "instagram": "ig"}
NOTES = {"tiktok": "Studio; agent attached the file; cover from report/covers", "linkedin": "Mentions verified by urn; auto captions off; cover from report/covers" + ("; first comment to post after publish" if r["li_arm"] == "comment" else ""), "facebook": "Business Suite; Story share on; auto captions off; cover from report/covers", "instagram": "Business Suite; collaborators to add after publish; cover from report/covers"}
LINK = {"tiktok": "https://www.tiktok.com/@bottb0/video/{}", "facebook": "https://www.facebook.com/reel/{}"}
cmd = ["pnpm", "-s", "bottb", "post", "record", "--platform", platform, "--group", r["group"], "--status", "scheduled", "--content-type", "short", "--event", r["event"], "--band", r["band_slug"], "--caption", r[FIELD[platform]], "--scheduled-for", r["slots_sydney_iso"][platform], "--posted-via", "browser", "--notes", NOTES[platform]]
if ext:
    cmd += ["--external-id", ext]
    if platform in LINK:
        cmd += ["--permalink", LINK[platform].format(ext)]
out = subprocess.run(cmd, capture_output=True, text=True)
print(key, platform, out.stdout.strip().splitlines()[-1] if out.stdout.strip() else out.stderr.strip()[-300:])
