#!/usr/bin/env python3
"""How big a link effect could a split of the coming reels detect? Uses the spread of our own views. Run from the project directory."""
import csv, glob, math, random, statistics as st
rows = list(csv.DictReader(open(sorted(glob.glob("data/meta_video_90d_*.psv"))[-1]), delimiter="|"))
sets = {"Facebook, all video": [int(r["views"]) for r in rows if r["platform"] == "FB"], "Instagram, all video": [int(r["views"]) for r in rows if r["platform"] == "IG"], "LinkedIn impressions, 5 videos": [514, 1261, 217, 399, 25]}
random.seed(7)
for name, v in sets.items():
    sd = st.stdev(math.log(x) for x in v if x > 0)
    for n in (6, 9, 15):
        for eff in (0.8, 0.5):
            hit = 0
            for _ in range(4000):
                a = [random.gauss(math.log(eff), sd) for _ in range(n)]; b = [random.gauss(0, sd) for _ in range(n)]
                t = (st.mean(b) - st.mean(a)) / math.sqrt(st.variance(a) / n + st.variance(b) / n)
                hit += t > 1.645
            print(f"{name}: log sd {sd:.2f}, {n} v {n} posts, true views x{eff}: found {hit/4000:.0%} of the time (5% false alarm one-sided)")
