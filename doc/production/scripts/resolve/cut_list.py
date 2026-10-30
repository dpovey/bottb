# READ-ONLY: write a gigstills cut_list.json for the V1 cuts of a range on the Sydney 2026 final cut.
# Run outside the MCP: <rr.sh wrapper with the atexit guard> cut_list.py <IN_abs> <OUT_abs_inclusive> <set name> <out.json> [render ...]
# Format = the Under Pressure / Canvanauts Sydney 2026 cut lists: record frames ABSOLUTE, record_out exclusive,
# first/last items clipped to the range, angle from the item name "Sydney 2026 Multicam - <Angle>",
# multicam_frame = GetLeftOffset() + (clipped start - item start). Refuses while a render runs (property reads are empty).
import json, sys
import DaVinciResolveScript as dvr
IN, OUT, SET, PATH = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3], sys.argv[4]
renders = sys.argv[5:]
p = dvr.scriptapp("Resolve").GetProjectManager().GetCurrentProject(); tl = p.GetCurrentTimeline()
if p.IsRenderingInProgress():
    raise SystemExit("render in progress: ZoomX/DynamicZoom reads are empty until it ends")
assert tl.GetName() == "BOTTB Sydney 2026 - final cut", tl.GetName()
items = []
for x in tl.GetItemListInTrack("video", 1) or []:
    if x.GetEnd() <= IN or x.GetStart() > OUT:
        continue
    n = x.GetName(); s = max(x.GetStart(), IN); e = min(x.GetEnd(), OUT + 1)
    mpi = x.GetMediaPoolItem()
    kind = mpi.GetClipProperty("Type") if mpi else None
    items.append({"index": len(items) + 1, "record_in": s, "record_out": e, "name": n,
                  "media_type": "Multicam" if n.startswith("Sydney 2026 Multicam") else kind,
                  "clip_color": x.GetClipColor() or None,
                  "angle": n.split(" - ", 1)[1] if n.startswith("Sydney 2026 Multicam - ") else None,
                  "source_clip": None if n.startswith("Sydney 2026 Multicam") else n, "source_in_frame": None,
                  "multicam_frame": x.GetLeftOffset() + (s - x.GetStart()),
                  "file_path": None if n.startswith("Sydney 2026 Multicam") else (mpi.GetClipProperty("File Path") if mpi else None),
                  "track": "V1", "zoom_x": round(float(x.GetProperty("ZoomX") or 1), 4),
                  "dynamic_zoom": bool(x.GetProperty("DynamicZoomEnabled")),
                  "nodes": x.GetNumNodes() if callable(getattr(x, "GetNumNodes", None)) else None,
                  "color_group": (x.GetColorGroup().GetName() if x.GetColorGroup() else None), "set": SET})
d = {"fps": 25, "timeline_start_tc": "00:53:00:00", "levels": "video",
     "notes": ("%s, BOTTB Sydney 2026 (show 2026-10-08). Project 'BOTTB Sydney 2026 Full Show', timeline 'BOTTB Sydney 2026 - final cut' "
               "(start frame 79500 = 00:53:00:00), 3840x2160 25p, DaVinci YRGB Color Managed v2: input Canon Cinema Gamut/Canon Log 3 "
               "(drum S-Log3 via its group), timeline DaVinci WG / DaVinci Intermediate, output Rec.709 Gamma 2.4, video levels. "
               "record_in/out are ABSOLUTE timeline frames, record_out exclusive; range %d-%d inclusive, first/last items clipped to it. "
               "Look on the V2 Adjustment Clip, cards on V3. Angle from the item name; multicam_frame = left offset at record_in." % (SET, IN, OUT)),
     "renders": [{"path": r, "record_in": IN, "record_out": OUT + 1, "set": SET} for r in renders], "items": items}
json.dump(d, open(PATH, "w"), indent=1)
assert all(items[i]["record_out"] == items[i + 1]["record_in"] for i in range(len(items) - 1)), "gap/overlap on V1"
from collections import Counter
print(len(items), "cuts", items[0]["record_in"], items[-1]["record_out"], dict(Counter(i["angle"] for i in items)),
      "zoomed", sum(1 for i in items if i["dynamic_zoom"] or i["zoom_x"] >= 1.3),
      "graded(nodes>1)", sum(1 for i in items if (i["nodes"] or 1) > 1), "types", dict(Counter(i["media_type"] for i in items)))
