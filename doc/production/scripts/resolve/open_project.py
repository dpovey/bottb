# Open a project and timeline by name (after a relaunch or force quit Resolve sits with no project). Read-back printed.
# usage: open_project.py "<project>" "<timeline>"   e.g. "BOTTB Sydney 2026 Full Show" "BOTTB Sydney 2026 - final cut"
import sys, DaVinciResolveScript as dvr
pm = dvr.scriptapp("Resolve").GetProjectManager(); proj, tln = sys.argv[1], sys.argv[2]
p = pm.GetCurrentProject()
if not p or p.GetName() != proj: p = pm.LoadProject(proj)
assert p, "LoadProject(%r) failed; db %s" % (proj, pm.GetCurrentDatabase())
if p.GetCurrentTimeline() is None or p.GetCurrentTimeline().GetName() != tln:
    t = [p.GetTimelineByIndex(i) for i in range(1, p.GetTimelineCount() + 1)]
    p.SetCurrentTimeline([x for x in t if x.GetName() == tln][0])
print("project", p.GetName(), "timeline", p.GetCurrentTimeline().GetName())
