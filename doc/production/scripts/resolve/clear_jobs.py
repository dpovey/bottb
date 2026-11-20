# Delete the render jobs this run started, by id, and leave every other job alone; then open the Edit page and print it.
# Replaces per-release clear_my_jobs.py, whose output-name prefix list missed the delivery name on You Oughta Know
# (2026-11-20) and left the 4K job queued with Resolve on Deliver. Exit 1 if a given id is still queued afterwards.
# Usage: rr.sh resolve/clear_jobs.py <job_id> [<job_id> ...]      (ids from render_range.py's "JOB <id>" line)
import sys, time, DaVinciResolveScript as d
want = set(sys.argv[1:]); assert want, "give the job ids to delete"
r = d.scriptapp("Resolve"); p = r.GetProjectManager().GetCurrentProject(); assert not p.IsRenderingInProgress(), "a render is running"
for j in p.GetRenderJobList() or []:
    if j["JobId"] in want: print("delete", j["JobId"][:8], j.get("OutputFilename"), p.DeleteRenderJob(j["JobId"]))
left = [j["JobId"] for j in p.GetRenderJobList() or []]
print("others kept", [(j[:8]) for j in left if j not in want])
stuck = [j[:8] for j in left if j in want]
r.OpenPage("edit"); time.sleep(2); print("page", r.GetCurrentPage())
if stuck: raise SystemExit("ABORT: still queued %s" % stuck)
