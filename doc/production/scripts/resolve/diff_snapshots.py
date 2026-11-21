# Compare two snapshot.py files: the "every track identical" check after an upgrade, a reopen or any write.
# Plain python3, no Resolve. Exit 0 only when nothing differs outside what you say you changed.
#   python3 diff_snapshots.py <before.json> <after.json> [--edit IN OUT TRACKS] [--ignore-markers COLOURS]
#     --edit IN OUT V1,V3   items lying wholly inside [IN, OUT) on those tracks may differ (the edit you made); printed, not failed
#     --ignore-markers Sand,Lavender   marker colours inside the edit range that may differ
# Track ENABLES and names are compared on every track, every time, and each change is printed on its own line
# ("TRACK ENABLE A2 off -> on"). You Oughta Know (2026-11-15): a post-upgrade check said "every track identical" while A2's
# desk scratch had gone from off to on, because it compared items only; found five days later (retro-video.md 1.1).
import json, sys
a = sys.argv[1:]; EDIT = None; IGN = set()
if "--edit" in a: i = a.index("--edit"); EDIT = (int(a[i + 1]), int(a[i + 2]), set(a[i + 3].split(","))); del a[i:i + 4]
if "--ignore-markers" in a: i = a.index("--ignore-markers"); IGN = set(a[i + 1].split(",")); del a[i:i + 2]
b, c = (json.load(open(x)) for x in a[:2]); bad = []
def onoff(v): return "on" if v else "off"
if b.get("timeline") != c.get("timeline"): print("NOTE timelines differ:", b.get("timeline"), "->", c.get("timeline"))
for t in sorted(set(b["tracks"]) | set(c["tracks"]), key=lambda k: (k[0] != "V", int(k[1:]))):
    x, y = b["tracks"].get(t), c["tracks"].get(t)
    if x is None or y is None: bad.append("TRACK %s %s" % (t, "added" if x is None else "removed")); continue
    if x["enabled"] != y["enabled"]: bad.append("TRACK ENABLE %s %s %s -> %s" % (t, x["name"], onoff(x["enabled"]), onoff(y["enabled"])))
    if x["name"] != y["name"]: bad.append("TRACK NAME %s %r -> %r" % (t, x["name"], y["name"]))
    edited = lambda i: EDIT and t in EDIT[2] and i["start"] >= EDIT[0] and i["end"] <= EDIT[1]
    xi, yi = [i for i in x["items"] if not edited(i)], [i for i in y["items"] if not edited(i)]
    if xi != yi:
        key = lambda i: json.dumps(i, sort_keys=True, default=str)
        kx, ky = set(map(key, xi)), set(map(key, yi))
        gone, new = [i for i in xi if key(i) not in ky], [i for i in yi if key(i) not in kx]
        bad.append("ITEMS %s %s: %d -> %d, %d changed or gone, %d changed or new" % (t, x["name"], len(xi), len(yi), len(gone), len(new)))
        for g in gone[:2]: print("  before", t, g)
        for n in new[:2]: print("  after ", t, n)
    if EDIT and t in EDIT[2]:
        print("EDITED %s inside [%d, %d): %d -> %d items" % (t, EDIT[0], EDIT[1], len(x["items"]) - len(xi), len(y["items"]) - len(yi)))
inedit = lambda f, m: EDIT and EDIT[0] <= int(f) < EDIT[1] and m.get("color") in IGN
mb = {f: m for f, m in b["markers"].items() if not inedit(f, m)}; mc = {f: m for f, m in c["markers"].items() if not inedit(f, m)}
if mb != mc: bad.append("MARKERS %d -> %d, differing frames %s" % (len(mb), len(mc), sorted(set(mb) ^ set(mc) | {f for f in set(mb) & set(mc) if mb[f] != mc[f]})[:8]))
if b.get("inout") != c.get("inout"): bad.append("IN/OUT %s -> %s" % (b.get("inout"), c.get("inout")))
for x in bad: print(x)
n = len(b["tracks"]); print("RESULT", "IDENTICAL" if not bad else "DIFFERENT", "(%d tracks, enables and names included, %d differences)" % (n, len(bad)))
raise SystemExit(1 if bad else 0)
