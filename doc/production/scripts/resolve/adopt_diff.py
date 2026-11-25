# Read-only semantic diff (adoption gate): a main timeline vs its stabilised/edited copy, OUTSIDE the song range [LO, HI). Makes each timeline
# current in turn to read track enables (they read False when not current), then leaves the copy current. Items are compared clipped
# to the outside spans: start, end, name, media path, source offset at the clipped start, item properties (transform, zoom, DZ,
# composite, opacity, crop), clip enabled, clip colour, and every grade node: enabled, tools, LUT, CDL. Tracks matched by name.
# Markers compared by frame/name/note/colour/duration. A byte diff of a .drp export is useless for this: every item blob carries a
# per-timeline id (Barracuda, 2026-11-25). usage: rr.sh resolve/adopt_diff.py <main_id> <copy_id> <lo> <hi_excl> <out.json>
# Then the copy is current. Proven on Barracuda 2026-11-25: 1 difference (a stabilised overlay tail past the Out), 45 s for a 328k-frame show.
import sys, json, DaVinciResolveScript as d
MAIN, COPY, LO, HI, OUT = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), sys.argv[5]
p = d.scriptapp("Resolve").GetProjectManager().GetCurrentProject()
assert not p.IsRenderingInProgress()
print("project", p.GetName())
tls = {p.GetTimelineByIndex(i).GetUniqueId(): p.GetTimelineByIndex(i) for i in range(1, p.GetTimelineCount() + 1)}
PROPS = ("ZoomX", "ZoomY", "Pan", "Tilt", "RotationAngle", "AnchorPointX", "AnchorPointY", "Pitch", "Yaw", "FlipX", "FlipY",
         "CropLeft", "CropRight", "CropTop", "CropBottom", "Opacity", "CompositeMode", "DynamicZoomEnabled", "DynamicZoomEase",
         "RetimeProcess", "Scaling", "ResizeFilter")
def grade(it):
    g = it.GetNodeGraph()
    if not g: return None
    out = []
    for n in range(1, (g.GetNumNodes() or 0) + 1):
        c = it.GetCDL(n) if callable(getattr(it, "GetCDL", None)) else None
        out.append((n, g.GetNodeEnabled(n), g.GetToolsInNode(n), g.GetLUT(n), c))
    return out
def read(tl):
    p.SetCurrentTimeline(tl); assert p.GetCurrentTimeline().GetUniqueId() == tl.GetUniqueId()
    res = {"tracks": {}, "markers": {str(k): v for k, v in (tl.GetMarkers() or {}).items()}, "start": tl.GetStartFrame()}
    for kind in ("video", "audio"):
        for t in range(1, tl.GetTrackCount(kind) + 1):
            name = tl.GetTrackName(kind, t); rows = []
            for it in tl.GetItemListInTrack(kind, t) or []:
                st, en = it.GetStart(), it.GetEnd()
                for a, b in ((-10**9, LO), (HI, 10**9)):
                    s, e = max(st, a), min(en, b)
                    if s >= e: continue
                    mp = it.GetMediaPoolItem(); path = mp.GetClipProperty("File Path") if mp else ""
                    pr = it.GetProperty() or {} if kind == "video" else {}
                    rows.append({"s": s, "e": e, "name": it.GetName(), "path": path, "src": (it.GetLeftOffset() or 0) + (s - st),
                                 "props": {k: pr.get(k) for k in PROPS if k in pr}, "enabled": it.GetClipEnabled(),
                                 "colour": it.GetClipColor(), "grade": grade(it) if kind == "video" else None})
            res["tracks"]["%s:%s" % (kind, name)] = {"enabled": tl.GetIsTrackEnabled(kind, t), "items": rows}
    return res
a, b = read(tls[MAIN]), read(tls[COPY])
p.SetCurrentTimeline(tls[COPY])
diffs = []
for k in sorted(set(a["tracks"]) | set(b["tracks"])):
    ta, tb = a["tracks"].get(k), b["tracks"].get(k)
    if ta is None or tb is None:
        if (ta or tb)["items"]: diffs.append({"track": k, "only_in": "copy" if tb else "main", "items": len((ta or tb)["items"])})
        continue
    if ta["enabled"] != tb["enabled"]: diffs.append({"track": k, "enabled": [ta["enabled"], tb["enabled"]]})
    ka = {(r["s"], r["e"]): r for r in ta["items"]}; kb = {(r["s"], r["e"]): r for r in tb["items"]}
    for key in sorted(set(ka) | set(kb)):
        ra, rb = ka.get(key), kb.get(key)
        if ra != rb:
            diffs.append({"track": k, "range": key, "main": ra, "copy": rb})
ma = {k: v for k, v in a["markers"].items() if not LO <= int(float(k)) < HI}; mb = {k: v for k, v in b["markers"].items() if not LO <= int(float(k)) < HI}
if ma != mb: diffs.append({"markers": {"main_only": sorted(set(ma) - set(mb)), "copy_only": sorted(set(mb) - set(ma)),
                                       "changed": sorted(k for k in set(ma) & set(mb) if ma[k] != mb[k])}})
json.dump({"diffs": diffs, "counts": {k: len(v["items"]) for k, v in a["tracks"].items()}}, open(OUT, "w"), indent=1, default=str)
print("tracks main", {k: len(v["items"]) for k, v in a["tracks"].items()})
print("DIFFS", len(diffs))
for x in diffs[:25]: print(json.dumps(x, default=str)[:400])
