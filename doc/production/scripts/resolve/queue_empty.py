# READ-ONLY: exit 0 and print "queue empty" when no render job is waiting or rendering; otherwise list them and exit 1.
# Finished jobs (Complete, Failed, Cancelled) don't count: a project often keeps dozens (28 on Everlong).
# With a job id, that job is ignored too (the one just started). Used by runner.zsh's queue_render.
# Usage: rr.sh resolve/queue_empty.py [<job_id>]
import sys, DaVinciResolveScript as dvr
p = dvr.scriptapp("Resolve").GetProjectManager().GetCurrentProject()
skip = set(sys.argv[1:])
DONE = {"Complete", "Failed", "Cancelled"}
live = []
for x in p.GetRenderJobList() or []:
    st = (p.GetRenderJobStatus(x["JobId"]) or {}).get("JobStatus")
    if x["JobId"] not in skip and st not in DONE: live.append((x["JobId"][:8], x.get("OutputFilename"), st))
print("queue empty" if not live else "queue holds %s" % live); sys.exit(0 if not live else 1)
