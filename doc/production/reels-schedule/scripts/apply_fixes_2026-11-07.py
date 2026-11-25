#!/usr/bin/env python3
"""Apply the wording fixes Dean approved on 7 Nov to his review documents; write the changed documents to data/review_fixes_2026-11-07/. Run from the project directory."""
import json, os, re, sys
from datetime import datetime, timezone
sys.path.insert(0, "scripts")
from page_content import REELS
SRC, OUT = "data/reviews_2026-11-07b/reviews", "data/review_fixes_2026-11-07"
os.makedirs(OUT, exist_ok=True)
KEY = {"Facebook": "fb", "Instagram": "ig", "YouTube Shorts": "yt", "TikTok": "tt", "LinkedIn first": "li_comment", "LinkedIn": "li"}
FIXES = {
    "nok": [("ig", "psilon's band", "Epsilon's band", True), ("li", "@Espilon's band", "@Epsilon's band", False)],
    "otr": [("tt", 'Off the Record\'s performance of Celine Dion\'s "It\'s All Coming Back to Me Now"🎤. Celine Dion\'s "It\'s All Coming Back to Me Now" at The Triffid.', 'Off the Record\'s performance of Celine Dion\'s "It\'s All Coming Back to Me Now" at The Triffid 🎤.', False), ("fb", "\n\nFull song:", "\nFull song:", False)],
    "canvanauts": [("li", ", black hat and bow tie centre stage", "", False)],
    "chain": [(f, "finish  from", "finish from", False) for f in ("fb", "ig", "li", "yt")],
    "g4u": [("fb", "\n\nFull song:", "\nFull song:", False)],
}
for r in REELS:
    k = r["key"]
    if k not in FIXES:
        continue
    b = json.load(open(f"{SRC}/{k}.json"))
    drafts = {}
    for t, x in r["copy"]:
        drafts[next(v for p, v in KEY.items() if t.startswith(p))] = x
        if t.startswith("YouTube"):
            drafts["yt_title"] = t.split(" · ", 1)[1]
    for f, old, new, whole_word in FIXES[k]:
        v = b["copy"][f]
        pat = (r"(?<![A-Za-z])" + re.escape(old)) if whole_word else re.escape(old)
        assert len(re.findall(pat, v)) == 1, (k, f, old)
        b["copy"][f] = re.sub(pat, lambda _: new, v)
    if k == "g4u":
        b["confirmed"], b["was_confirmed"], b["confirmed_at"] = True, False, datetime.now(timezone.utc).isoformat()
    b["final"] = {f: b["copy"].get(f, d) for f, d in drafts.items()}
    json.dump(b, open(f"{OUT}/{k}.json", "w"), ensure_ascii=False, indent=1)
    print(k, "confirmed", b["confirmed"], sorted(b["final"]))
