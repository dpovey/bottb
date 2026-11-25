#!/usr/bin/env python3
"""Seeded, constrained shuffle of reels onto Mon/Wed/Fri slots. Add new reels to data/reels.json and list keys whose order is settled, in order, under "kept"; only the rest gets reshuffled. A reel marked "held" stays out until its file arrives. Run from the project directory."""
import json, random
from datetime import date, timedelta

cfg = json.load(open("data/reels.json"))
reels = cfg["reels"]
SEED, GAP, RUN = cfg["seed"], cfg["min_slots_between_same_band"], cfg["max_same_city_in_a_row"]


def slots(start, n):
    d, out = date.fromisoformat(start), []
    while len(out) < n:
        if d.weekday() in (0, 2, 4):
            out.append(d)
        d += timedelta(days=1)
    return out


SKIP = set(cfg.get("skip_slots", []))
calendar = slots(cfg["start"], len(reels) + len(SKIP))
open_slots = [i for i, d in enumerate(calendar) if d.isoformat() not in SKIP]


def ok(order):
    for pos, r in enumerate(order):
        i = open_slots[pos]
        if i < r.get("not_before_slot", 0):
            return False
        if any(o["band"] == r["band"] and i - open_slots[q] < GAP for q, o in enumerate(order[:pos])):
            return False
        # An open slot breaks a run of one city.
        if pos >= RUN and open_slots[pos] - open_slots[pos - RUN] == RUN and len({o["city"] for o in order[pos - RUN:pos + 1]}) == 1:
            return False
    return order[0]["ready"]


rng = random.Random(SEED)
by_key = {r["key"]: r for r in reels}
kept = [by_key[k] for k in cfg.get("kept", [])]
free, tries = [r for r in reels if r["key"] not in cfg.get("kept", []) and not r.get("held")], 0
while True:
    tries += 1
    rng.shuffle(free)
    pool = kept + free
    if ok(pool):
        break
    if tries > 200000:
        raise SystemExit("no order meets the limits; change kept, skip_slots or the limits")
# LinkedIn test: each consecutive pair of slots gets one of each arm. Arms belong to the slot, so a rerun never changes a booked one.
arm_rng, arms = random.Random(SEED + 1), []
while len(arms) < len(calendar):
    arms += arm_rng.sample(["post", "comment"], 2)
out = [dict(r, date=calendar[i].isoformat(), weekday=calendar[i].strftime("%a"), li_arm=arms[i]) for r, i in zip(pool, open_slots)]
json.dump(out, open("data/mix_2026-11-07.json", "w"), indent=1)
print("seed", SEED, "tries", tries)
for o in out:
    print(o["weekday"], o["date"], o["city"], o["band"], "|", o["song"], "| ready" if o["ready"] else "| review", "| LinkedIn link in", o["li_arm"])
