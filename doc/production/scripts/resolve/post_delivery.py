# Post-delivery clean-up for one song, every step read back; idempotent. Run AFTER the deliverables pass QC.
# usage (via rr.sh): post_delivery.py <RELEASE marker substring, e.g. "Starships">
#   1. In/Out back to the song range taken from its Cyan "RELEASE: ..." marker (timeline-relative)
#   2. clears Orange clip colours on V1 inside that range (the zoomed-cut marks), prints the count
#   3. deletes Complete render jobs whose ids are in $MYJOBS (written by render_range.py), never anyone else's
#   4. render CustomName back to the timeline name (read back from a probe job, then deleted)
#   5. SaveProject
# Not here (separate, one change each): CAM NR off (grpnode.py <group> <node> 0, then a pixel check), halation (Dean, UI;
# read back with resolve-lab drp_flcstate.py), Super Scale (superscale.py VALUE=1).
import os, sys, DaVinciResolveScript as dvr
pm = dvr.scriptapp("Resolve").GetProjectManager(); p = pm.GetCurrentProject(); tl = p.GetCurrentTimeline()
assert not p.IsRenderingInProgress(), "a render is running"
st = tl.GetStartFrame(); key = sys.argv[1]
rel = [(f, m) for f, m in tl.GetMarkers().items() if m["name"].startswith("RELEASE") and key.lower() in m["name"].lower()]
assert len(rel) == 1, "need exactly one RELEASE marker matching %r: %s" % (key, [m["name"] for _, m in rel])
f0, m = rel[0]; IN, OUT = st + int(f0), st + int(f0) + int(m["duration"]) - 1
print("RELEASE", m["name"], IN, OUT)
for _ in range(3):
    tl.SetMarkInOut(IN - st, OUT - st, "all")
    if tl.GetMarkInOut().get("video") == {"in": IN - st, "out": OUT - st}: break
print("1 in/out", tl.GetMarkInOut().get("video"))
xs = [x for x in tl.GetItemListInTrack("video", 1) if x.GetEnd() > IN and x.GetStart() <= OUT and x.GetClipColor() == "Orange"]
for x in xs: x.ClearClipColor()
left = sum(1 for x in tl.GetItemListInTrack("video", 1) if x.GetEnd() > IN and x.GetStart() <= OUT and x.GetClipColor() == "Orange")
print("2 orange cleared", len(xs), "left", left)
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
