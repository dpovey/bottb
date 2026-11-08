# Render several short absolute ranges as separate jobs, start only those ids, wait, delete them, and restore In/Out.
# Usage (rr.sh with RR_TIMEOUT large): render_batch.py <dir> <prefix> <restore_in_abs> <restore_out_abs> <in:out> [<in:out> ...]
# ProRes 422 HQ, 1920x1080 (RB_WIDTH=3840 env for 4K), video only. Files: <dir>/<prefix>_<in>.mov. Prints DONE <status per job>.
# Waits on each job's own status (not IsRenderingInProgress, which can still read False just after StartRendering), and always
# deletes its jobs and restores In/Out, even when an assert or the 900 s timeout stops it.
import os, sys, time, DaVinciResolveScript as dvr
sys.path.insert(0, os.path.dirname(os.path.abspath(sys.argv[0]))); import pix
D, PRE, RIN, ROUT = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
rngs = [tuple(map(int, s.split(":"))) for s in sys.argv[5:]]
p = dvr.scriptapp("Resolve").GetProjectManager().GetCurrentProject(); tl = p.GetCurrentTimeline()
assert not p.IsRenderingInProgress(), "a render is running"
os.makedirs(D, exist_ok=True); ids = []
W = int(os.environ.get("RB_WIDTH", 1920))  # RB_WIDTH=3840 for 4K pixel checks
DONE = ("Complete", "Failed", "Cancelled")
status = lambda j: (p.GetRenderJobStatus(j) or {}).get("JobStatus")
t0 = time.time(); stat = []
try:
    assert p.SetCurrentRenderFormatAndCodec("mov", "ProRes422HQ")
    for a, b in rngs:
        assert pix.set_inout(tl, a, b), ("In/Out would not set", a, b, tl.GetMarkInOut())  # moving In past the old Out needs a retry
        assert p.SetRenderSettings({"TargetDir": D, "CustomName": "%s_%d" % (PRE, a), "FormatWidth": W, "FormatHeight": W * 9 // 16,
                                    "ExportVideo": True, "ExportAudio": False})
        j = p.AddRenderJob(); ids.append(j); job = [x for x in p.GetRenderJobList() if x["JobId"] == j][0]
        assert (job["MarkIn"], job["MarkOut"]) == (a, b), (job["MarkIn"], job["MarkOut"], a, b)
    assert p.StartRendering(ids, False), "StartRendering refused"
    while not all(status(j) in DONE for j in ids):
        time.sleep(2)
        if time.time() - t0 > 900: raise SystemExit("render over 900 s; statuses %s" % [status(j) for j in ids])
    stat = [status(j) for j in ids]
finally:
    if p.IsRenderingInProgress() and ids: p.StopRendering()
    for j in ids: p.DeleteRenderJob(j)
    restored = pix.set_inout(tl, RIN, ROUT)
    print("DONE", round(time.time() - t0, 1), "s", stat, "in/out", tl.GetMarkInOut().get("video"), "restored" if restored else "IN/OUT NOT RESTORED")
