# Place one gigsteady stabilised clip over a Dynamic Zoom original on V2 of the CURRENT timeline (V2 must be the "gigsteady" overlay track):
# append video-only at the original's record range (handle offset), copy the grade, set the angle transform, then turn
# Dynamic Zoom on with the original's ease. Resolve gives a new DZ its DEFAULT rectangles (0.8 -> 1.0, centred), so only
# originals whose decoded rectangles equal the default match; check with drp DZ decode + a render. One clip per run.
# Usage: rr.sh resolve/place_dz.py <name e.g. SD_rec152595> <manifest.json> <zoom> <rotation>
import sys, json, DaVinciResolveScript as d
NAME, MAN, Z, ROT = sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4])
r = d.scriptapp("Resolve"); p = r.GetProjectManager().GetCurrentProject(); tl = p.GetCurrentTimeline(); mp = p.GetMediaPool()
assert tl.GetTrackName("video", 2) == "gigsteady" and not p.IsRenderingInProgress(), (tl.GetName(), tl.GetTrackName("video", 2))
m = [x for x in json.load(open(MAN)) if x["name"] == NAME][0]
orig = [i for i in tl.GetItemListInTrack("video", 1) if (i.GetStart(), i.GetEnd()) == (m["record_start"], m["record_end"])]
assert len(orig) == 1 and orig[0].GetName().endswith(m["angle"]); orig = orig[0]
op = orig.GetProperty(); assert op.get("DynamicZoomEnabled"), "original has no DZ"
busy = [i for i in tl.GetItemListInTrack("video", 2) if i.GetStart() < m["record_end"] and i.GetEnd() > m["record_start"]]
assert not busy, "V2 already occupied: %s" % [(i.GetName(), i.GetStart()) for i in busy]
def find(folder):
    for c in folder.GetClipList():
        if c.GetClipProperty("File Path") == m["output"]: return c
    for f in folder.GetSubFolderList():
        c = find(f)
        if c: return c
mpi = find(mp.GetRootFolder()); assert mpi, "bin clip not found for " + m["output"]
io = tl.GetMarkInOut(); ph = tl.GetCurrentTimecode()
it = mp.AppendToTimeline([{"mediaPoolItem": mpi, "startFrame": m["place_start"], "endFrame": m["place_end"],
                           "recordFrame": m["record_start"], "trackIndex": 2, "mediaType": 1}])[0]
print("placed", it.GetName(), it.GetStart(), it.GetEnd(), it.GetLeftOffset(), "want", m["record_start"], m["record_end"], m["place_start"])
assert (it.GetStart(), it.GetEnd(), it.GetLeftOffset()) == (m["record_start"], m["record_end"], m["place_start"])
orig.CopyGrades([it]); og, ng = orig.GetNodeGraph(), it.GetNodeGraph()
print("grade", og.GetNumNodes(), og.GetLUT(1), "->", ng.GetNumNodes(), ng.GetLUT(1))
assert og.GetNumNodes() == ng.GetNumNodes() and og.GetLUT(1) == ng.GetLUT(1)
want = {"ZoomX": Z, "ZoomY": Z, "RotationAngle": ROT, "DynamicZoomEnabled": True}
if op.get("DynamicZoomEase") is not None: want["DynamicZoomEase"] = op["DynamicZoomEase"]
for k, v in want.items(): assert it.SetProperty(k, v), ("SetProperty refused", k, v)
np_ = it.GetProperty()
for k, v in want.items():
    got = np_.get(k); assert (abs(float(got) - float(v)) < 1e-3) if not isinstance(v, bool) else bool(got) == v, ("read-back", k, got, v)
print("orig", {k: op.get(k) for k in ("ZoomX", "RotationAngle", "DynamicZoomEnabled", "DynamicZoomEase")})
print("new ", {k: np_.get(k) for k in ("ZoomX", "RotationAngle", "DynamicZoomEnabled", "DynamicZoomEase")}, "uid", it.GetUniqueId())
if tl.GetMarkInOut() != io and io.get("video"): tl.SetMarkInOut(io["video"]["in"], io["video"]["out"], "all")
tl.SetCurrentTimecode(ph)
