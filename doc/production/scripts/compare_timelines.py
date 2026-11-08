# Read-only (switches the current timeline and back): compare two timelines item by item outside an absolute range.
# Video tracks are matched by NAME (layouts may differ), audio by index. Prints differences and a summary.
# Usage: rr.sh compare_timelines.py "<timeline A>" "<timeline B>" <skip_in> <skip_out_excl> <out.json>
import sys, json, DaVinciResolveScript as d
A, B, S0, S1, J = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), sys.argv[5]
p = d.scriptapp("Resolve").GetProjectManager().GetCurrentProject()
tls = {p.GetTimelineByIndex(i).GetName(): p.GetTimelineByIndex(i) for i in range(1, p.GetTimelineCount() + 1)}
cur = p.GetCurrentTimeline().GetName()
def snap(name):
    tl = tls[name]; p.SetCurrentTimeline(tl); out = {"video": {}, "audio": {}, "markers": []}
    for kind in ("video", "audio"):
        for t in range(1, tl.GetTrackCount(kind) + 1):
            key = tl.GetTrackName(kind, t) if kind == "video" else "A%d %s" % (t, tl.GetTrackName(kind, t))
            out[kind][key] = sorted((i.GetStart(), i.GetEnd(), i.GetName(), i.GetLeftOffset(), bool(i.GetClipEnabled()))
                                    for i in tl.GetItemListInTrack(kind, t) or [] if not (i.GetStart() < S1 and i.GetEnd() > S0))
            out[kind][key + " (enabled)"] = tl.GetIsTrackEnabled(kind, t)
    st = tl.GetStartFrame()
    out["markers"] = sorted((f + st, m["color"], m["name"], m["duration"]) for f, m in tl.GetMarkers().items() if not S0 <= f + st < S1)
    return out
try: a, b = snap(A), snap(B)
finally: p.SetCurrentTimeline(tls[cur])  # always switch back, even if a snap fails
diffs = []
for kind in ("video", "audio"):
    for k in sorted(set(a[kind]) | set(b[kind])):
        if a[kind].get(k) != b[kind].get(k):
            va, vb = a[kind].get(k), b[kind].get(k)
            if isinstance(va, list) and isinstance(vb, list):
                diffs.append((kind, k, "only A", sorted(set(map(tuple, va)) - set(map(tuple, vb)))[:5], "only B", sorted(set(map(tuple, vb)) - set(map(tuple, va)))[:5]))
            else: diffs.append((kind, k, va if not isinstance(va, list) else len(va), vb if not isinstance(vb, list) else len(vb)))
if a["markers"] != b["markers"]:
    diffs.append(("markers", "only A", sorted(set(a["markers"]) - set(b["markers"]))[:8], "only B", sorted(set(b["markers"]) - set(a["markers"]))[:8]))
json.dump({"A": A, "B": B, "skip": [S0, S1], "diffs": diffs}, open(J, "w"), indent=1, default=str)
for x in diffs: print(x)
print("tracks A video", list(k for k in a["video"] if "(enabled)" not in k), "B", list(k for k in b["video"] if "(enabled)" not in k))
print("items A", sum(len(v) for k, v in a["video"].items() if isinstance(v, list)), "B", sum(len(v) for k, v in b["video"].items() if isinstance(v, list)), "diffs", len(diffs), "current restored", p.GetCurrentTimeline().GetName())
