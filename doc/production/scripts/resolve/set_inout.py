# Set the timeline In/Out to an absolute frame range (items/jobs numbering) and read it back. One change, nothing else.
# SetMarkInOut counts from the timeline start, so GetStartFrame() is subtracted here (runbook 2026-10-14/22).
# Usage: rr.sh resolve/set_inout.py <in_abs> <out_abs>      (out inclusive)
import sys
import DaVinciResolveScript as d
IN, OUT = int(sys.argv[1]), int(sys.argv[2])
tl = d.scriptapp("Resolve").GetProjectManager().GetCurrentProject().GetCurrentTimeline()
st = tl.GetStartFrame()
print("timeline", tl.GetName(), "start", st, "before", tl.GetMarkInOut().get("video"))
tl.SetMarkInOut(IN - st, OUT - st, "all")
v = tl.GetMarkInOut().get("video", {})
ok = v == {"in": IN - st, "out": OUT - st}
print("after", v, "-> abs %s-%s, %d frames" % (v.get("in", 0) + st, v.get("out", 0) + st, OUT - IN + 1), "OK" if ok else "MISMATCH")
