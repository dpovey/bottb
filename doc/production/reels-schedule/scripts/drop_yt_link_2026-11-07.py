#!/usr/bin/env python3
"""Dean dropped the YouTube Related video link on 7 Nov: replace the line in the review documents and report the batch. Run from the project directory."""
import glob, json, os
OLD, NEW = "Full song: tap the link under our channel name.", "Full song on our channel."
out = "data/review_fixes_2026-11-07b"
for f in sorted(glob.glob("data/reviews_2026-11-07c/reviews/*.json")):
    b = json.load(open(f))
    for part in ("copy", "final"):
        if b.get(part, {}).get("yt"):
            assert OLD in b[part]["yt"], f
            b[part]["yt"] = b[part]["yt"].replace(OLD, NEW)
    json.dump(b, open(f"{out}/{os.path.basename(f)}", "w"), ensure_ascii=False, indent=1)
    print(os.path.basename(f), b["confirmed"], NEW in b["final"]["yt"])
