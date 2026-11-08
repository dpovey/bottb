# Make a timeline current by exact name and read it back. Usage: rr.sh resolve/set_timeline.py "<timeline name>"
import sys, DaVinciResolveScript as d
p = d.scriptapp("Resolve").GetProjectManager().GetCurrentProject()
t = [p.GetTimelineByIndex(i) for i in range(1, p.GetTimelineCount() + 1) if p.GetTimelineByIndex(i).GetName() == sys.argv[1]]
assert len(t) == 1, "no unique timeline %r" % sys.argv[1]
print("before", p.GetCurrentTimeline().GetName(), "set", p.SetCurrentTimeline(t[0]), "after", p.GetCurrentTimeline().GetName())
