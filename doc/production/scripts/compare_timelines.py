# Read-only (switches the current timeline and back): compare two timelines item by item outside an absolute range.
# Tracks are matched by INDEX, video and audio, never by name: several tracks can share a name (three "gigsteady" tracks on
# You Oughta Know's adopted timeline), and a name-keyed dict silently kept one of them, so whole tracks went uncompared
# (2026-11-21). Track names and enables are compared as data. When B is A plus one inserted video track (a gigsteady
# duplicate), pass --insert N: A's V(t) is compared with B's V(t) below N and V(t+1) from N up, and B's VN is reported.
# Usage: rr.sh compare_timelines.py "<timeline A>" "<timeline B>" <skip_in> <skip_out_excl> <out.json> [--insert N]
# Exit 1 when anything differs, so a runner can't read a mismatch as a pass.
import collections, sys, json, DaVinciResolveScript as d
a_ = sys.argv[1:]; INS = None
if "--insert" in a_: i = a_.index("--insert"); INS = int(a_[i + 1]); del a_[i:i + 2]
A, B, S0, S1, J = a_[0], a_[1], int(a_[2]), int(a_[3]), a_[4]
p = d.scriptapp("Resolve").GetProjectManager().GetCurrentProject()
tls = {p.GetTimelineByIndex(i).GetName(): p.GetTimelineByIndex(i) for i in range(1, p.GetTimelineCount() + 1)}
cur = p.GetCurrentTimeline().GetName()
def snap(name):
    tl = tls[name]; p.SetCurrentTimeline(tl); out = {"video": {}, "audio": {}, "markers": []}
    for kind in ("video", "audio"):
        for t in range(1, tl.GetTrackCount(kind) + 1):
            out[kind][t] = {"name": tl.GetTrackName(kind, t), "enabled": bool(tl.GetIsTrackEnabled(kind, t)),
                            "items": sorted((i.GetStart(), i.GetEnd(), i.GetName(), i.GetLeftOffset(), bool(i.GetClipEnabled()))
                                            for i in tl.GetItemListInTrack(kind, t) or [] if not (i.GetStart() < S1 and i.GetEnd() > S0))}
    st = tl.GetStartFrame()
    out["markers"] = sorted((f + st, m["color"], m["name"], m["duration"]) for f, m in tl.GetMarkers().items() if not S0 <= f + st < S1)
    return out
try: a, b = snap(A), snap(B)
finally: p.SetCurrentTimeline(tls[cur])  # always switch back, even if a snap fails
def label(kind, t, side): return "%s%d %s" % (kind[0].upper(), t, side[kind][t]["name"]) if t in side[kind] else "%s%d (none)" % (kind[0].upper(), t)
diffs = []
for kind in ("video", "audio"):
    bmap = {t: (t if INS is None or kind == "audio" or t < INS else t + 1) for t in a[kind]}
    for ta, tb in sorted(bmap.items()):
        va, vb = a[kind][ta], b[kind].get(tb)
        where = "%s -> %s" % (label(kind, ta, a), label(kind, tb, b))
        if vb is None: diffs.append((kind, where, "missing in B")); continue
        for k in ("name", "enabled"):
            if va[k] != vb[k]: diffs.append((kind, where, k, va[k], vb[k]))
        if va["items"] != vb["items"]:
            sa, sb = set(va["items"]), set(vb["items"])
            diffs.append((kind, where, "items", len(va["items"]), len(vb["items"]), "only A", sorted(sa - sb)[:5], "only B", sorted(sb - sa)[:5]))
    extra = sorted(set(b[kind]) - set(bmap.values()))
    for tb in extra:
        if kind == "video" and tb == INS: continue  # the inserted track is expected; reported below
        diffs.append((kind, "only in B: " + label(kind, tb, b), len(b[kind][tb]["items"])))
if a["markers"] != b["markers"]:
    diffs.append(("markers", "only A", sorted(set(a["markers"]) - set(b["markers"]))[:8], "only B", sorted(set(b["markers"]) - set(a["markers"]))[:8]))
dup = {s: [n for n, c in collections.Counter(v["name"] for v in x["video"].values()).items() if c > 1] for s, x in (("A", a), ("B", b))}
res = {"A": A, "B": B, "skip": [S0, S1], "insert": INS, "diffs": diffs, "duplicate_video_track_names": dup,
       "inserted_track": ({"track": INS, "name": b["video"][INS]["name"], "items": len(b["video"][INS]["items"])} if INS and INS in b["video"] else None)}
json.dump(res, open(J, "w"), indent=1, default=str)
for x in diffs: print(x)
print("tracks A video", [label("video", t, a) for t in a["video"]], "B", [label("video", t, b) for t in b["video"]])
if any(dup.values()): print("duplicate video track names (compared by index, so all are covered):", dup)
if INS: print("inserted B track", res["inserted_track"])
print("items A", sum(len(v["items"]) for v in a["video"].values()), "B", sum(len(v["items"]) for v in b["video"].values()),
      "diffs", len(diffs), "current restored", p.GetCurrentTimeline().GetName())
print("RESULT", "SAME" if not diffs else "DIFFERENT")
if diffs: raise SystemExit(1)
