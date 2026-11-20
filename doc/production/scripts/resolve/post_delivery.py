# Post-delivery clean-up for one song, every step read back; idempotent. Run AFTER the deliverables pass QC.
# usage (via rr.sh): post_delivery.py <RELEASE marker substring, e.g. "Starships">
#   1. In/Out back to the song range taken from its Cyan "RELEASE: ..." marker (timeline-relative)
#   2. clears Orange clip colours on EVERY video track inside that range (the zoomed-cut marks), prints the count per track,
#      and reports Orange still on the timeline outside the range (another song's leftovers: clip_colours.py, not this script).
#      V1 only until 2026-11-21: You Oughta Know found 4 Mustang Sally overlay RiPs on V3 still Orange, which a later
#      Select Clips By Clip Color > Orange would have re-rendered (good 4 u's V2 likewise, 2026-11-03).
#   3. deletes Complete render jobs whose ids are in $MYJOBS (written by render_range.py), never anyone else's
#   4. render CustomName back to the timeline name (read back from a probe job, then deleted)
#   5. SaveProject
# Not here (separate, one change each): CAM NR off (grpnode.py <group> <node> 0, then a pixel check), halation (Dean, UI;
# read back with resolve-lab drp_flcstate.py), Super Scale (superscale.py VALUE=1).
import os, sys, DaVinciResolveScript as dvr
pm = dvr.scriptapp("Resolve").GetProjectManager(); p = pm.GetCurrentProject(); tl = p.GetCurrentTimeline()
assert not p.IsRenderingInProgress(), "a render is running"
st = tl.GetStartFrame(); key = sys.argv[1]
sys.path.insert(0, os.path.dirname(os.path.abspath(sys.argv[0]))); import pix
IN, OUT, name = pix.release_range(tl, key)  # "(In N, Out M)" in the name wins: those markers sit on In+1 (2026-11-08)
print("RELEASE", name, IN, OUT)
pix.set_inout(tl, IN, OUT)
print("1 in/out", tl.GetMarkInOut().get("video"))
def orange(inside):
    return {t: [x for x in tl.GetItemListInTrack("video", t) or [] if x.GetClipColor() == "Orange"
                and (x.GetEnd() > IN and x.GetStart() <= OUT) == inside] for t in range(1, tl.GetTrackCount("video") + 1)}
xs = orange(True)
for t in xs:
    for x in xs[t]: x.ClearClipColor()
left = {"V%d" % t: len(v) for t, v in orange(True).items() if v}; outside = {"V%d" % t: len(v) for t, v in orange(False).items() if v}
print("2 orange cleared", sum(map(len, xs.values())), {"V%d" % t: len(v) for t, v in xs.items() if v}, "left", sum(left.values()), left)
if outside: print("  NOTE orange outside this song, not cleared:", outside, "(back up and clear with clip_colours.py before anyone selects by colour)")
if left: print("  FAIL orange still on", left, "after ClearClipColor")
jf = os.environ.get("MYJOBS", os.path.expanduser("~/.cache/bottb/resolve_jobs.txt"))
mine = set(open(jf).read().split()) if os.path.exists(jf) else set()
gone = [j["JobId"][:8] for j in p.GetRenderJobList() if j["JobId"] in mine and p.GetRenderJobStatus(j["JobId"]).get("JobStatus") == "Complete" and p.DeleteRenderJob(j["JobId"])]
print("3 jobs deleted", gone, "left", [(j["JobId"][:8], j.get("OutputFilename")) for j in p.GetRenderJobList()])
p.SetRenderSettings({"CustomName": tl.GetName()}); probe = p.AddRenderJob()
name = [j.get("OutputFilename") for j in p.GetRenderJobList() if j["JobId"] == probe]; p.DeleteRenderJob(probe)
for _ in range(3):  # AddRenderJob can clear In/Out
    if tl.GetMarkInOut().get("video") == {"in": IN - st, "out": OUT - st}: break
    tl.SetMarkInOut(IN - st, OUT - st, "all")
print("4 render name", name, "in/out", tl.GetMarkInOut().get("video"))
print("5 save", pm.SaveProject())
if left: raise SystemExit("FAIL: Orange left in the song range %s" % left)  # after the save, so the other steps still land
