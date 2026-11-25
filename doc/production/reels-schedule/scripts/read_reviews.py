#!/usr/bin/env python3
"""Summarise Dean's review documents: status, cover, fact answers and caption edits as a diff against the drafts. Usage: read_reviews.py <dir of reviews/*.json>. Run from the project directory."""
import difflib, json, os, re, sys
sys.path.insert(0, "scripts")
from page_content import REELS
d = sys.argv[1]
KEY = {"Facebook": "fb", "Instagram": "ig", "YouTube Shorts": "yt", "TikTok": "tt", "LinkedIn first": "li_comment", "LinkedIn": "li"}
for r in REELS:
    b = json.load(open(f"{d}/{r['key']}.json"))
    b = b.get("data", b)
    print(f"=== {r['meta'][:12]} {r['name']} | confirmed={b.get('confirmed')} at={b.get('confirmed_at')} | cover={b.get('cover')}")
    for k, v in (b.get("facts") or {}).items():
        print("  fact", k, "=", v.get("answer"), "|", v.get("note") or "")
    drafts = {}
    for t, x in r["copy"]:
        k = next(v for p, v in KEY.items() if t.startswith(p))
        drafts[k] = x
        if k == "yt":
            drafts["yt_title"] = t.split(" · ", 1)[1]
    for k, v in (b.get("copy") or {}).items():
        print(f"  EDIT {k}:")
        for line in difflib.ndiff(re.split(r"(?<=[.!?\n]) ?", drafts.get(k, "")), re.split(r"(?<=[.!?\n]) ?", v)):
            if line[0] in "+-":
                print("    ", line.rstrip())
    final = b.get("final") or {}
    print("  final fields:", ",".join(final), "| final differs from draft+edits:", [k for k in final if final[k] != (b.get("copy") or {}).get(k, drafts.get(k))])
