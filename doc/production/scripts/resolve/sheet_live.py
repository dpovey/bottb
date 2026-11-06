# Contact sheets of a song straight from the timeline: one graded frame per V1 cut, labelled, with no render. For reviewing the cut, not for judging the grade.
# Read-only. About 1 s a frame with the look (one 12-frame sheet, 2026-11-06). The same labels as phone_review.py.
# Usage: RR_TIMEOUT=300 rr.sh resolve/sheet_live.py <in_abs> <out_abs> <outdir> [per_page=24] [max_px=2400]
import os, sys, DaVinciResolveScript as d
sys.path.insert(0, os.path.dirname(os.path.abspath(sys.argv[0]))); import pix
a = sys.argv[1:]; IN, OUT, D = int(a[0]), int(a[1]), a[2]; N = int(a[3]) if len(a) > 3 else 24; PX = int(a[4]) if len(a) > 4 else 2400; os.makedirs(D, exist_ok=True)
p = d.scriptapp("Resolve").GetProjectManager().GetCurrentProject(); pix.rendering(p); tl = p.GetCurrentTimeline(); S = tl.GetStartFrame()
fr = []
for c, it in enumerate(pix.v1_cuts(tl, IN, OUT), 1):
    x, y = max(it.GetStart(), IN), min(it.GetEnd() - 1, OUT); m = (x + y) // 2; src = (it.GetName().split(" - ")[-1])[:28]
    fr.append({"frameOffset": m - S, "label": "%d %s %s" % (c, pix.tc(m), src)})
for k in range(0, len(fr), N):
    f = "%s/sheet_%02d.jpg" % (D, k // N + 1); x = tl.ExportThumbnails(fr[k:k + N], {"outputType": "file", "filePath": f, "maxDimension": PX, "quality": 85})
    print(f, x.get("columns"), "x", x.get("rows"), "cells", x.get("cellWidth"), "x", x.get("cellHeight"), x.get("error") or "")
print(len(fr), "cuts")
