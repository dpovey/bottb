# READ-ONLY: the state of the current timeline over [IN, OUT], to diff before and after a write (diff_snapshots.py):
# every track's name and ENABLE, every item overlapping the range (start, end, left offset, name, enabled, colour, zoom, DZ,
# node LUTs), timeline markers in the range (absolute frames), In/Out (absolute). Promoted from You Oughta Know (2026-11-21).
# Track enables read False on a timeline that isn't current (runbook, 21.1), so this reads the current timeline only.
# Usage: rr.sh resolve/snapshot.py IN OUT <out.json> [--timeline "<name>"]   (--timeline: refuse if another timeline is current)
import sys, json
import DaVinciResolveScript as dvr
a = sys.argv[1:]; WANT = None
if "--timeline" in a: i = a.index("--timeline"); WANT = a[i + 1]; del a[i:i + 2]
IN, OUT, PATH = int(a[0]), int(a[1]), a[2]
p = dvr.scriptapp("Resolve").GetProjectManager().GetCurrentProject(); tl = p.GetCurrentTimeline()
assert not p.IsRenderingInProgress(), "a render is running: reads come back empty"
if WANT: assert tl.GetName() == WANT, (tl.GetName(), WANT)
st = tl.GetStartFrame(); out = {"timeline": tl.GetName(), "range": [IN, OUT], "tracks": {}, "markers": {}, "inout": None}
for kind in ("video", "audio"):
    for n in range(1, tl.GetTrackCount(kind) + 1):
        rows = []
        for x in tl.GetItemListInTrack(kind, n) or []:
            if x.GetEnd() <= IN or x.GetStart() > OUT: continue
            r = {"start": x.GetStart(), "end": x.GetEnd(), "left": x.GetLeftOffset(), "name": x.GetName()}
            try: r["enabled"] = x.GetClipEnabled()
            except Exception: pass
            if kind == "video":
                r["color"] = x.GetClipColor()
                for k in ("ZoomX", "ZoomY", "Pan", "Tilt", "DynamicZoomEnabled", "DynamicZoomEase"):
                    r[k] = x.GetProperty(k)
                g = x.GetNodeGraph()
                r["luts"] = [g.GetLUT(k) or "" for k in range(1, (g.GetNumNodes() or 0) + 1)] if g else []
            rows.append(r)
        out["tracks"]["%s%d" % (kind[0].upper(), n)] = {"name": tl.GetTrackName(kind, n), "enabled": tl.GetIsTrackEnabled(kind, n), "items": rows}
for f, m in (tl.GetMarkers() or {}).items():
    af = int(f) + st
    if IN <= af <= OUT: out["markers"][str(af)] = m
mio = tl.GetMarkInOut() or {}
out["inout"] = {k: v + st for k, v in mio.get("video", {}).items()}
json.dump(out, open(PATH, "w"), indent=1, default=str)
print("tracks", {k: (len(v["items"]), "on" if v["enabled"] else "OFF") for k, v in out["tracks"].items()}, "markers", len(out["markers"]), "inout", out["inout"])
