# Export frames at record positions, with no track toggled and the playhead left alone. Read-only.
# Layer: tl = what the render shows; item = the top clip under the look, so the look-off picture.
# Usage: rr.sh resolve/frames.py <tl|item> <outdir> [--max PX] [--roi X Y W H] <rec_abs> [<rec_abs> ...]
#   --roi takes fractions of the frame and exports at native resolution for checking focus or a zoomed cut's detail.
import os, sys, DaVinciResolveScript as d
sys.path.insert(0, os.path.dirname(os.path.abspath(sys.argv[0]))); import pix
a = sys.argv[1:]; opts = {}; LAYER, OUT = a[0], a[1]; a = a[2:]; os.makedirs(OUT, exist_ok=True)
if "--max" in a: i = a.index("--max"); opts["maxDimension"] = int(a[i + 1]); del a[i:i + 2]
if "--roi" in a: i = a.index("--roi"); opts.update(zip(("roiX", "roiY", "roiWidth", "roiHeight"), map(float, a[i + 1:i + 5]))); del a[i:i + 5]
p = d.scriptapp("Resolve").GetProjectManager().GetCurrentProject(); pix.rendering(p); tl = p.GetCurrentTimeline(); S = tl.GetStartFrame()
for rec in map(int, a):
    f = "%s/%s_%d.png" % (OUT, LAYER, rec)
    if LAYER == "tl": x = pix.export(tl, rec - S, f, **opts); name = tl.GetName()
    else:
        it = pix.picture_item(tl, rec)
        if not it: print(rec, pix.tc(rec), "NO CLIP"); continue
        x = pix.export(it, rec - it.GetStart(), f, **opts); name = it.GetName()
    if not x: print(rec, pix.tc(rec), name, "EXPORT FAILED"); continue
    print(rec, pix.tc(rec), name, "%sx%s" % (x.get("width"), x.get("height")), pix.kind(f), "Y %.1f" % pix.level(f), f)
