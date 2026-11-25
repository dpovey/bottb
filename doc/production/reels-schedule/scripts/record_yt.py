#!/usr/bin/env python3
"""Record one scheduled YouTube Short in the ledger. Usage: record_yt.py <key> <youtube id> <iso slot>. Run from the repo root."""
import json, subprocess, sys
key, vid, slot = sys.argv[1:4]
D = "doc/production/reels-schedule/data/"
c = json.load(open(D + "yt_batch_2026-11-07.json"))[key]
r = {x["key"]: x for x in json.load(open(D + "mix_2026-11-07.json"))}[key]
BAND = {"g4u": "bandlassian-sydney-2026", "otr": "off-the-record-brisbane-2026", "nok": "epsonics-brisbane-2026", "sos": "total-loss-brisbane-2026", "v2voyagers": "v2-voyagers-sydney-2026", "amakazaam": "amakazaam-sydney-2026", "chain": "epsonics-brisbane-2026", "everlong": "the-shiprex-brisbane-2026", "sias": "jumbo-band-brisbane-2026", "cic": "the-shiprex-brisbane-2026"}
GROUP = {"g4u": "sydney-2026-bandlassian-good-4-u-reel", "otr": "brisbane-2026-off-the-record-all-coming-back-reel", "nok": "brisbane-2026-epsonics-no-one-knows-reel", "sos": "brisbane-2026-total-loss-sultans-reel", "v2voyagers": "sydney-2026-v2-voyagers-starships-ufo-reel", "amakazaam": "sydney-2026-amakazaam-under-pressure-reel", "chain": "brisbane-2026-epsonics-the-chain-reel", "everlong": "brisbane-2026-shiprex-everlong-reel", "sias": "brisbane-2026-jumbo-say-it-aint-so-reel", "cic": "brisbane-2026-shiprex-covered-in-chrome-reel"}
event = "sydney-2026" if r["city"] == "Sydney" else "brisbane-2026"
out = subprocess.run(["pnpm", "-s", "bottb", "post", "record", "--platform", "youtube", "--group", GROUP[key], "--external-id", vid, "--permalink", f"https://youtube.com/shorts/{vid}", "--status", "scheduled", "--content-type", "short", "--event", event, "--band", BAND[key], "--title", c["title"], "--caption", c["desc"], "--scheduled-for", slot, "--posted-via", "browser", "--notes", "2160x3840 upscale render, cover not set, no Related video (Dean dropped the link)"], capture_output=True, text=True)
print(key, out.stdout.strip().splitlines()[-1] if out.stdout.strip() else out.stderr.strip()[-200:])
