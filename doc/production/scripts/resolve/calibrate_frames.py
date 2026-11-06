# Run once with the media online, because the lab proved this on a plain clip only: does the item frame equal the timeline frame with the look off, on the clip kinds a real song has
# (live multicam, RiP'd, gigsteady overlay)? Switches the look track off and back on, Edit page, no render. Expect mean|rgb| under 1 per kind; a higher number names the kind the item frame can't stand in for.
# Usage: RR_TIMEOUT=300 rr.sh resolve/calibrate_frames.py <in_abs> <out_abs> <workdir> [per_kind=3]
import os, sys, DaVinciResolveScript as d
sys.path.insert(0, os.path.dirname(os.path.abspath(sys.argv[0]))); import pix
a = sys.argv[1:]; IN, OUT, D = int(a[0]), int(a[1]), a[2]; N = int(a[3]) if len(a) > 3 else 3; os.makedirs(D, exist_ok=True)
r = d.scriptapp("Resolve"); p = r.GetProjectManager().GetCurrentProject(); pix.rendering(p); assert r.GetCurrentPage() == "edit", "on page %s: open the Edit page first" % r.GetCurrentPage()
tl = p.GetCurrentTimeline(); S = tl.GetStartFrame(); lt = pix.look_track(tl, IN + (OUT - IN) // 2); kinds = {}; assert lt, "no Adjustment Clip over the middle of the range"
for c in pix.v1_cuts(tl, IN, OUT):
    rec = max(c.GetStart(), IN) + (min(c.GetEnd() - 1, OUT) - max(c.GetStart(), IN)) // 2; top = pix.picture_item(tl, rec)
    if top and not any(i.GetStart() <= rec < i.GetEnd() for t in range(lt + 1, tl.GetTrackCount("video") + 1) for i in tl.GetItemListInTrack("video", t) or []):
        k = "overlay" if top.GetTrackTypeAndIndex()[1] > 1 else pix.src_type(top); kinds.setdefault(k, [])
        if len(kinds[k]) < N: kinds[k].append((rec, top))
for k, v in kinds.items():
    for rec, top in v: pix.export(top, rec - top.GetStart(), "%s/%d_item.png" % (D, rec), maxDimension=1920)
was = tl.GetIsTrackEnabled("video", lt)
print("Look track V%d goes off for this run. If it dies, put it back: rr.sh resolve/track_enable.py video %d %d" % (lt, lt, int(was)), flush=True)  # a hang kills this process before the finally; preflight then fails on the track
assert tl.SetTrackEnable("video", lt, False) and not tl.GetIsTrackEnabled("video", lt), "look track would not switch off"
try:
    for k, v in kinds.items():
        for rec, top in v: pix.export(tl, rec - S, "%s/%d_tl.png" % (D, rec), maxDimension=1920)
finally:
    tl.SetTrackEnable("video", lt, was); print("look track restored:", tl.GetIsTrackEnabled("video", lt) == was, "on" if tl.GetIsTrackEnabled("video", lt) else "off")
for k, v in kinds.items():
    for rec, top in v:
        f, g = "%s/%d_item.png" % (D, rec), "%s/%d_tl.png" % (D, rec)
        if not (os.path.exists(f) and os.path.exists(g)): print("%-9s %d %-44s EXPORT FAILED" % (k, rec, top.GetName()[:44])); continue
        print("%-9s %d %-44s %-8s mean|rgb| %.2f" % (k, rec, top.GetName()[:44], pix.kind(g), pix.rgb_diff(f, g)))
