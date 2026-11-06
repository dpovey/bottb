# Black bands from a pan or reframe, per cut, without a look-off render or touching a track: two item frames per cut (the top clip under the look),
# read at 480x270 with edge_scan.py's thresholds. Also names any offline or flat cut. Read-only. About 0.2 s a frame in the lab (one clip).
# Usage: RR_TIMEOUT=300 rr.sh resolve/edge_scan_live.py <in_abs> <out_abs> <workdir>
import os, sys, DaVinciResolveScript as d
sys.path.insert(0, os.path.dirname(os.path.abspath(sys.argv[0]))); import pix
IN, OUT, W = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3]; os.makedirs(W, exist_ok=True)
p = d.scriptapp("Resolve").GetProjectManager().GetCurrentProject(); pix.rendering(p); tl = p.GetCurrentTimeline()
hits, n, c = 0, 0, 0
for c, it in enumerate(pix.v1_cuts(tl, IN, OUT), 1):
    a, b = max(it.GetStart(), IN), min(it.GetEnd() - 1, OUT)
    for frac in (.3, .7):
        rec = int(a + frac * (b - a)); top = pix.picture_item(tl, rec); f = "%s/edge_%d.jpg" % (W, rec)
        if not top: print(c, pix.tc(rec), "NO CLIP"); hits += 1; break
        n += 1
        if not pix.export(top, rec - top.GetStart(), f, maxDimension=960, quality=90):
            print(c, top.GetName(), pix.tc(rec), "EXPORT FAILED"); hits += 1; break
        k = pix.kind(f); e = pix.bands(f)
        if k in ("offline", "flat") or (k != "black" and pix.banded(e)):
            print(c, top.GetName(), rec, pix.tc(rec), k, "L R T B px:", *e, "  ", f); hits += 1; break
print("%d cuts, %d frames, %d flagged" % (c, n, hits))
