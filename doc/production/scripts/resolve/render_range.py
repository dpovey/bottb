# Queue and start ONE render job for an absolute record range, with the range read back from the job before it starts.
# usage (via rr.sh): render_range.py <in_abs> <out_abs> <dir> <name> <fmt> <codec> <audio 0|1> <width> [kbps]
#   width 3840 → 3840x2160, 1920 → 1920x1080.  e.g. 4K delivery: ... mp4 H264 1 3840 45000 ; pixel check: ... mov ProRes422HQ 0 3840
# Sets In/Out with SetMarkInOut (timeline-relative; never MarkIn/MarkOut in SetRenderSettings), single pass for mp4,
# starts only this job id, appends the id to $MYJOBS (default ~/.cache/bottb/resolve_jobs.txt) for post_delivery.py.
# Prints "JOB <id>". Then wait with: python3 wait_render.py <id> (run_in_background). Replaces scratch rjob.py/rjob4k.py
# (2026-10-30, used ~30 times on the V2 medley).
import os, sys, DaVinciResolveScript as dvr
a = sys.argv[1:]
IN, OUT, D, NAME, FMT, COD, AUD, WID = int(a[0]), int(a[1]), a[2], a[3], a[4], a[5], a[6] == "1", int(a[7])
r = dvr.scriptapp("Resolve"); p = r.GetProjectManager().GetCurrentProject(); tl = p.GetCurrentTimeline()
assert not p.IsRenderingInProgress(), "a render is running"
st = tl.GetStartFrame()
for _ in range(3):
    tl.SetMarkInOut(IN - st, OUT - st, "all")
    v = tl.GetMarkInOut().get("video", {})
    if v.get("in") == IN - st and v.get("out") == OUT - st: break
else:
    raise SystemExit("In/Out would not set: %s" % tl.GetMarkInOut())
assert p.SetCurrentRenderFormatAndCodec(FMT, COD), (FMT, COD)
s = {"TargetDir": D, "CustomName": NAME, "FormatWidth": WID, "FormatHeight": WID * 9 // 16, "ExportVideo": True, "ExportAudio": AUD}
if FMT == "mp4": s["MultiPassEncode"] = False  # refused for ProRes
if len(a) > 8: s["VideoQuality"] = int(a[8])  # Kb/s
assert p.SetRenderSettings(s), s
jid = p.AddRenderJob()
j = [x for x in p.GetRenderJobList() if x["JobId"] == jid][0]
print("job", tl.GetName(), j["MarkIn"], j["MarkOut"], j.get("TargetDir"), j.get("OutputFilename"), j.get("FormatWidth"), j.get("MultiPassEncode"))
if j["MarkIn"] != IN or j["MarkOut"] != OUT:
    p.DeleteRenderJob(jid); raise SystemExit("job range %s-%s != %s-%s; deleted" % (j["MarkIn"], j["MarkOut"], IN, OUT))
f = os.environ.get("MYJOBS", os.path.expanduser("~/.cache/bottb/resolve_jobs.txt")); os.makedirs(os.path.dirname(f), exist_ok=True)
open(f, "a").write(jid + "\n")
print("start", p.StartRendering([jid], False))
print("JOB", jid)
