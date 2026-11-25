#!/usr/bin/env python3
"""Facebook video views with and without a link in the caption, using Graph API captions and Business Suite views. Run from the project directory."""
import csv, glob, json, random, statistics as st
from datetime import datetime, timedelta, timezone
Z = timezone(timedelta(hours=10))
caps = json.load(open(sorted(glob.glob("data/fb_captions_*.json"))[-1]))
for c in caps: c["w"] = datetime.strptime(c["t"], "%Y-%m-%dT%H:%M:%S%z").astimezone(Z)
rows = [m for m in csv.DictReader(open(sorted(glob.glob("data/meta_video_90d_*.psv"))[-1]), delimiter="|") if m["platform"] == "FB"]
out = []
for m in rows:
    t = datetime.strptime(m["published_brisbane_time"], "%Y-%m-%d %H:%M").replace(tzinfo=Z)
    if t < datetime(2026, 9, 14, tzinfo=Z): continue
    near = sorted(caps, key=lambda c: abs((c["w"] - t).total_seconds()))[0]
    gap = abs((near["w"] - t).total_seconds()) / 60
    out.append((t, m["kind"], int(m["views"]), near["link"] if gap < 15 else None, m["label"], round(gap)))
for o in sorted(out): print(o[0].strftime("%m-%d %H:%M"), o[1], o[2], {True: "link", False: "no link", None: "UNMATCHED"}[o[3]], o[4], f"gap {o[5]} min")
def perm(a, b, n=20000):
    random.seed(1); obs = abs(st.median(a) - st.median(b)); p = a + b; k = 0
    for _ in range(n):
        random.shuffle(p); k += abs(st.median(p[:len(a)]) - st.median(p[len(a):])) >= obs
    return k / n
for kind in ("full", "short", None):
    a = [o[2] for o in out if o[3] is True and (kind is None or o[1] == kind)]
    b = [o[2] for o in out if o[3] is False and (kind is None or o[1] == kind)]
    print(kind or "all", "link", st.median(a) if a else None, len(a), "no link", st.median(b) if b else None, len(b), f"p={perm(a,b):.2f}" if len(a) > 1 and len(b) > 1 else "")
