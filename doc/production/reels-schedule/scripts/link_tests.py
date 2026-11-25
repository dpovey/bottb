#!/usr/bin/env python3
"""Do captions with a link do worse? Facebook and LinkedIn, plus LinkedIn by format and hour. Run from the project directory."""
import glob, json, random, statistics as st
from datetime import datetime, timedelta, timezone

rows = json.load(open(sorted(glob.glob("data/links_*.json"))[-1]))
Z = timezone(timedelta(hours=10))
def when(r): return datetime.fromisoformat(r["posted_at"].replace("+00", "+00:00")).astimezone(Z)
def perm(a, b, n=20000, seed=1):
    random.seed(seed); obs = abs(st.median(a) - st.median(b)); p = a + b; k = 0
    for _ in range(n):
        random.shuffle(p)
        if abs(st.median(p[:len(a)]) - st.median(p[len(a):])) >= obs: k += 1
    return k / n
def cmp(name, a, b):
    print(f"{name}: with link median {st.median(a) if a else None} (n={len(a)}), without {st.median(b) if b else None} (n={len(b)})" + (f", p={perm(a,b):.2f}" if len(a) > 1 and len(b) > 1 else ""))

print("== Facebook video, since 14 Sep (Meta app published)")
fb = [r for r in rows if r["platform"] == "facebook" and r["content_type"] in ("video", "reel") and when(r) >= datetime(2026, 9, 14, tzinfo=Z) and r["views"] is not None]
cmp("views", [r["views"] for r in fb if r["has_link"]], [r["views"] for r in fb if not r["has_link"]])
for r in sorted(fb, key=when): print(" ", when(r).strftime("%m-%d %H:%M"), r["content_type"], "link" if r["has_link"] else "-", r["views"], (r["label"] or "")[:45].replace("\n", " "))

print("== LinkedIn, every post with impressions")
li = sorted([r for r in rows if r["platform"] == "linkedin" and r["impressions"]], key=when)
for r in li: print(" ", when(r).strftime("%m-%d %a %H:%M"), r["content_type"], "link" if r["has_link"] else "-", "imp", r["impressions"], "views", r["views"], "clicks", r["clicks"], "likes", r["likes"], (r["label"] or "")[:40].replace("\n", " "))
cmp("impressions, all", [r["impressions"] for r in li if r["has_link"]], [r["impressions"] for r in li if not r["has_link"]])
vid = [r for r in li if r["content_type"] in ("video", "reel")]
cmp("impressions, video", [r["impressions"] for r in vid if r["has_link"]], [r["impressions"] for r in vid if not r["has_link"]])
print("median impressions video", st.median([r["impressions"] for r in vid]) if vid else None, "photo/carousel", st.median([r["impressions"] for r in li if r["content_type"] in ("photo", "carousel")]))
print("newest LinkedIn metric", max(r["captured_at"] for r in li))
print("LinkedIn posts by year-month without impressions", sum(1 for r in rows if r["platform"] == "linkedin" and not r["impressions"]))
print("== Facebook link posts per month, last 6 months")
from collections import Counter
c = Counter(when(r).strftime("%Y-%m") for r in rows if r["platform"] == "facebook" and r["has_link"])
print(sorted(c.items())[-8:])

print("== Checks on the ledger's captions")
for p in ("facebook", "linkedin"):
    rs = [r for r in rows if r["platform"] == p and r["content_type"] in ("video", "reel") and when(r) >= datetime(2026, 8, 25, tzinfo=Z)]
    print(p, "video rows", len(rs), "blank caption", sum(1 for r in rs if not r["cap_len"]), "with link", sum(1 for r in rs if r["has_link"]))
print("== Facebook, comparing like with like: captions present, by length of clip (from the Business Suite labels)")
import csv
psv = sorted(glob.glob("data/meta_video_90d_*.psv"))[-1]
kinds = [(datetime.strptime(m["published_brisbane_time"], "%Y-%m-%d %H:%M").replace(tzinfo=Z), m["kind"], int(m["views"]), m["label"]) for m in csv.DictReader(open(psv), delimiter="|") if m["platform"] == "FB"]
out = {}
for t, k, v, l in kinds:
    near = [r for r in fb if abs((when(r) - t).total_seconds()) < 3 * 3600 and r["cap_len"]]
    if near:
        out.setdefault((k, near[0]["has_link"]), []).append((v, l))
for key in sorted(out, key=str): print(" ", key, "median", st.median(v for v, _ in out[key]), "n", len(out[key]), [l for _, l in out[key]][:8])
