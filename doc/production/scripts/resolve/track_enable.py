# Switch a timeline track on/off and read it back. Edit page only (SetTrackEnable on Deliver returns True and does nothing).
# Usage: rr.sh resolve/track_enable.py <video|audio> <index> <0|1>
import sys, DaVinciResolveScript as d
r = d.scriptapp("Resolve"); tl = r.GetProjectManager().GetCurrentProject().GetCurrentTimeline()
k, i, on = sys.argv[1], int(sys.argv[2]), sys.argv[3] == "1"
assert r.GetCurrentPage() == "edit", "on page %s: open the Edit page first" % r.GetCurrentPage()
print(k, i, tl.GetTrackName(k, i), "before", tl.GetIsTrackEnabled(k, i), "set", tl.SetTrackEnable(k, i, on), "after", tl.GetIsTrackEnabled(k, i))
