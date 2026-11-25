#!/usr/bin/env python3
"""Posting-slot evidence from the ledger. Usage: analyse_slots.py data/history_<date>.json
Takes the latest metric snapshot per post, at a post age of at least MIN_AGE_D days, and prints median outcome by
platform and hour/day (Sydney time), with n. Trivially small input (one row per snapshot, under a few thousand)."""
import json, sys, statistics as st, collections as c
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

SYD = ZoneInfo("Australia/Sydney")
MIN_AGE_D = 7
OUTCOME = {"youtube": "views", "facebook": "views", "instagram": "likes", "tiktok": "views", "linkedin": "impressions"}
VIDEO = {"reel", "short", "video"}


def ts(s):
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


rows = json.load(open(sys.argv[1]))
posts = {}
for r in rows:
    p = posts.setdefault(r["id"], {**{k: r[k] for k in ("platform", "content_type", "group_key", "event_id", "posted_at", "label", "posted_via")}, "snaps": []})
    if r["captured_at"]:
        p["snaps"].append(r)

recs = []
for p in posts.values():
    t = ts(p["posted_at"]).astimezone(SYD)
    key = OUTCOME[p["platform"]]
    snaps = [s for s in p["snaps"] if s[key] is not None and (ts(s["captured_at"]) - ts(p["posted_at"])).days >= MIN_AGE_D]
    if not snaps:
        continue
    s = max(snaps, key=lambda s: s["captured_at"])
    recs.append({**p, "t": t, "v": s[key], "age": (ts(s["captured_at"]) - ts(p["posted_at"])).days, "likes": s["likes"], "views": s["views"], "comments": s["comments"], "shares": s["shares"]})

json.dump([{k: (str(v) if k == "t" else v) for k, v in r.items() if k != "snaps"} for r in recs], open(sys.argv[1].replace("history", "slot_recs"), "w"))


def table(name, rs, keyf, order=None):
    g = c.defaultdict(list)
    for r in rs:
        g[keyf(r)].append(r["v"])
    print(f"  {name}: " + "  ".join(f"{k}: med {st.median(v):.0f} (n={len(v)})" for k, v in sorted(g.items(), key=lambda kv: (order or sorted(g)).index(kv[0]))))


def band(h):
    return "00-06" if h < 6 else "06-10" if h < 10 else "10-14" if h < 14 else "14-17" if h < 17 else "17-21" if h < 21 else "21-24"


DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
for era_name, since in (("ALL history", "2000"), ("since 2026-08-20 (scripted era)", "2026-08-20")):
    print("==", era_name)
    for pf, key in OUTCOME.items():
        rs = [r for r in recs if r["platform"] == pf and r["content_type"] in VIDEO and r["posted_at"] >= since]
        if not rs:
            continue
        print(f"{pf} ({key}) n={len(rs)} median age {st.median(r['age'] for r in rs):.0f} d, median {st.median(r['v'] for r in rs):.0f}")
        table("slot", rs, lambda r: band(r["t"].hour))
        table("day", rs, lambda r: r["t"].strftime("%a"), DAYS)
        table("type", rs, lambda r: r["content_type"])
        table("event", rs, lambda r: r["event_id"] or "none")

print("== every video since 2026-08-20 by platform")
for pf in OUTCOME:
    print(pf)
    for r in sorted([r for r in recs if r["platform"] == pf and r["content_type"] in VIDEO and r["posted_at"] >= "2026-08-20"], key=lambda r: r["t"]):
        print(f"  {r['t']:%m-%d %a %H:%M} {r['content_type']:5} age {r['age']:3} v={r['v']:6} likes={r['likes']} {r['label'][:46]}")
