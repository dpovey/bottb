# Render-in-Place set on the CURRENT timeline over an absolute range, aware of overlays on V2 (gigsteady stabilised clips):
# visible V1 cuts (not under an enabled V2 overlay) and enabled V2 overlays with DynamicZoomEnabled OR ZoomX >= 1.3.
# Usage: rr.sh resolve/rip_set.py <in_abs> <out_abs_excl> list|mark|superscale <0|1|2 for superscale>
#   mark: Orange clip colour on each, read back.  superscale N: Super Scale on the media-pool clips of the zoomed V2 overlays
#   (their .mov sources; superscale.py skips .mov on purpose), int, read back. One change per run.
import sys, DaVinciResolveScript as d
IN, OUT, CMD = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3]
p = d.scriptapp("Resolve").GetProjectManager().GetCurrentProject(); tl = p.GetCurrentTimeline()
assert not p.IsRenderingInProgress(), "property reads are empty during a render"
inr = lambda i: i.GetStart() < OUT and i.GetEnd() > IN
ov = [] if tl.GetTrackName("video", 2) != "gigsteady" else [i for i in tl.GetItemListInTrack("video", 2) or [] if inr(i) and i.GetClipEnabled() and i.GetName() != "Adjustment Clip"]
covered = lambda a: any(o.GetStart() <= a.GetStart() and o.GetEnd() >= a.GetEnd() for o in ov)
def zoomed(i):
    pr = i.GetProperty() or {}
    return bool(pr.get("DynamicZoomEnabled")) or (pr.get("ZoomX") or 1) >= 1.3, pr
rip = []
for i in tl.GetItemListInTrack("video", 1):
    if inr(i) and not covered(i):
        z, pr = zoomed(i)
        if z: rip.append(("V1", i, pr))
for i in ov:
    z, pr = zoomed(i)
    if z: rip.append(("V2", i, pr))
print("RiP set %d (V1 %d, V2 %d)" % (len(rip), sum(t == "V1" for t, _, _ in rip), sum(t == "V2" for t, _, _ in rip)))
for t, i, pr in sorted(rip, key=lambda x: x[1].GetStart()):
    print("  %s %d-%d %-34s DZ %s Z %.3f col %s" % (t, i.GetStart(), i.GetEnd(), i.GetName()[-34:], pr.get("DynamicZoomEnabled"), pr.get("ZoomX", 1), i.GetClipColor()))
if CMD == "mark":
    for _, i, _ in rip: i.SetClipColor("Orange")
    print("Orange read back", sum(i.GetClipColor() == "Orange" for _, i, _ in rip), "/", len(rip))
elif CMD == "superscale":
    v = int(sys.argv[4]); ok = 0
    for t, i, _ in rip:
        if t != "V2": continue
        c = i.GetMediaPoolItem(); c.SetClipProperty("Super Scale", v); ok += str(c.GetClipProperty("Super Scale")) == str(v)
        print("  ", c.GetName(), "Super Scale", c.GetClipProperty("Super Scale"))
    print("superscale read back", ok, "/", sum(t == "V2" for t, _, _ in rip))
