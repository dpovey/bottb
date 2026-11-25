#!/usr/bin/env python3
"""Slot and spacing evidence from the Business Suite and TikTok Studio scrapes in data/. Run from the project directory.
Times in the scrapes are Brisbane (UTC+10). Facebook rows before 14 Sep are dropped: the Meta app was unpublished until
then, so those reels were hidden (runbook, facebook-instagram.md). Rows younger than MIN_AGE days are listed, not tested."""
import csv, glob, random, statistics as st
from datetime import datetime, timedelta

MIN_AGE = 7
NOW = datetime(2026, 11, 7, 9, 0)
random.seed(7)


def load(pattern):
    return list(csv.DictReader(open(sorted(glob.glob(pattern))[-1]), delimiter="|"))


def band(h):
    return "08-12" if h < 12 else "13-17 (to 16:59)" if h < 17 else "17-19" if h < 20 else "21-01" if h >= 21 or h < 2 else "other"


def perm_p(a, b, n=20000):
    """Two-sided permutation test on the difference of medians."""
    obs = abs(st.median(a) - st.median(b))
    pool = a + b
    hit = 0
    for _ in range(n):
        random.shuffle(pool)
        if abs(st.median(pool[: len(a)]) - st.median(pool[len(a) :])) >= obs:
            hit += 1
    return hit / n


def boot_ratio(a, b, n=5000):
    rs = sorted(st.median(random.choices(a, k=len(a))) / st.median(random.choices(b, k=len(b))) for _ in range(n))
    return rs[int(0.05 * n)], rs[int(0.95 * n)]


def summ(name, rows, key="views"):
    v = [r[key] for r in rows]
    print(f"  {name:22} n={len(v):2} median {st.median(v):6.0f}  range {min(v)}-{max(v)}")


meta = load("data/meta_video_90d_*.psv")
for r in meta:
    r["t"] = datetime.strptime(r["published_brisbane_time"], "%Y-%m-%d %H:%M")
    r["views"] = int(r["views"])
    r["age"] = (NOW - r["t"]).days

ig = [r for r in meta if r["platform"] == "IG"]
fb = [r for r in meta if r["platform"] == "FB" and r["t"] >= datetime(2026, 9, 14)]
print("Instagram, views by Brisbane hour (rows at least", MIN_AGE, "days old)")
ig_old = [r for r in ig if r["age"] >= MIN_AGE]
for b in ("08-12", "13-17 (to 16:59)", "17-19", "21-01"):
    summ(b, [r for r in ig_old if band(r["t"].hour) == b])
print("  too young to compare:", [(r["label"], r["views"], f"{r['age']} d") for r in ig if r["age"] < MIN_AGE])
am = [r["views"] for r in ig_old if band(r["t"].hour) == "08-12"]
pm = [r["views"] for r in ig_old if band(r["t"].hour) in ("13-17 (to 16:59)", "17-19")]
print(f"  afternoon+evening (13-19) vs morning (08-12): {st.median(pm):.0f} vs {st.median(am):.0f}, ratio {st.median(pm)/st.median(am):.2f}, 90% interval {boot_ratio(pm, am)}, permutation p={perm_p(pm, am):.3f}, n={len(pm)} and {len(am)}")
am_no = [v for v in am if v != 1912]
print(f"  same, without the Jamazon outlier: morning median {st.median(am_no):.0f}, p={perm_p(pm, am_no):.3f}")
print(f"  IG short vs full: {st.median([r['views'] for r in ig_old if r['kind']=='short']):.0f} (n={sum(r['kind']=='short' for r in ig_old)}) vs {st.median([r['views'] for r in ig_old if r['kind']=='full']):.0f} (n={sum(r['kind']=='full' for r in ig_old)})")
s = [r for r in ig_old if r["kind"] == "short"]
print("  IG shorts only: 18:00 week after a show", [r["views"] for r in s if r["t"].hour == 18], "; 08-09 countdown", [r["views"] for r in s if r["t"].hour in (8, 9)])

print("Instagram, by weekday (13-19 only, to hold the hour still)")
for d in ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"):
    v = [r["views"] for r in ig_old if band(r["t"].hour) in ("13-17 (to 16:59)", "17-19") and r["t"].strftime("%a") == d]
    if v:
        print(f"  {d} n={len(v)} {sorted(v)}")

print("Instagram, spacing: days since the previous video on IG (feed order)")
seq = sorted(ig, key=lambda r: r["t"])
gaps = []
for p, r in zip(seq, seq[1:]):
    g = (r["t"] - p["t"]).total_seconds() / 86400
    if r["age"] >= MIN_AGE:
        gaps.append((g, r["views"], r["label"]))
for lo, hi, n in ((0, 1.5, "under 1.5 d"), (1.5, 4, "1.5-4 d"), (4, 99, "4 d or more")):
    v = [x[1] for x in gaps if lo <= x[0] < hi]
    print(f"  {n:12} n={len(v):2} median {st.median(v):.0f} {sorted(v)}")
print("  same-day runs:", [(x[2], x[1], round(x[0], 2)) for x in gaps if x[0] < 0.6])

print("Facebook, views by Brisbane hour (from 14 Sep; app was unpublished before)")
fb_old = [r for r in fb if r["age"] >= MIN_AGE]
for b in ("08-12", "13-17 (to 16:59)", "17-19"):
    summ(b, [r for r in fb_old if band(r["t"].hour) == b])
print("  young:", [(r["label"], r["views"], f"{r['age']} d") for r in fb if r["age"] < MIN_AGE])
print("Facebook vs Instagram, same posts from 14 Sep: FB median", st.median([r["views"] for r in fb_old]), "IG median", st.median([r["views"] for r in ig_old if r["t"] >= datetime(2026, 9, 14)]))

tt = load("data/tiktok_studio_*.psv")
for r in tt:
    r["t"] = datetime.strptime(r["published_brisbane_time"], "%Y-%m-%d %H:%M")
    r["views"] = int(r["views"])
    m, sec = r["duration"].split(":")
    r["secs"] = int(m) * 60 + int(sec)
    r["age"] = (NOW - r["t"]).days
tt_old = [r for r in tt if r["age"] >= MIN_AGE]
print("TikTok")
short = [r for r in tt_old if r["secs"] <= 60]
full = [r for r in tt_old if r["secs"] >= 180]
summ("up to 60 s", short)
summ("3 min or more", full)
print(f"  p={perm_p([r['views'] for r in full], [r['views'] for r in short]):.4f}")
print("  share of posts reaching 600 views: up to 60 s", sum(r["views"] >= 600 for r in short), "of", len(short), "; 3 min or more", sum(r["views"] >= 600 for r in full), "of", len(full))
print("  under 60 s, by hour:")
for lab, f in (("07-10", lambda h: 7 <= h < 11), ("11-16", lambda h: 11 <= h < 17), ("17-20", lambda h: 17 <= h < 21)):
    v = [r["views"] for r in short if f(r["t"].hour)]
    print(f"   {lab}: n={len(v)} median {st.median(v) if v else 0:.0f} {sorted(v)}")
print("  3 min or more, by hour:")
for lab, f in (("07-10", lambda h: 7 <= h < 11), ("11-16", lambda h: 11 <= h < 17), ("17-20", lambda h: 17 <= h < 21)):
    v = [r["views"] for r in full if f(r["t"].hour)]
    print(f"   {lab}: n={len(v)} median {st.median(v) if v else 0:.0f} {sorted(v)}")
print("  young:", [(r["label"], r["views"], f"{r['age']} d") for r in tt if r["age"] < MIN_AGE])
