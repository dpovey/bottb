# Nodes of the show look (the Adjustment Clip (any video track)'s CURRENT version): list them, or switch one on/off. One change per run.
# The state is read back with GetNodeEnabled (Resolve 21.2).
# Usage: rr.sh resolve/adj_node.py list <frame_abs>  |  rr.sh resolve/adj_node.py <index> <0|1> <frame_abs>
import os, sys, DaVinciResolveScript as d
sys.path.insert(0, os.path.dirname(os.path.abspath(sys.argv[0]))); import pix
a = sys.argv[1:]; assert len(a) == (2 if a[:1] == ["list"] else 3), "usage: adj_node.py list <frame_abs> | <index> <0|1> <frame_abs>"; f = int(a[-1])
p = d.scriptapp("Resolve").GetProjectManager().GetCurrentProject(); pix.rendering(p); tl = p.GetCurrentTimeline()
if a[0] != "list": pix.writable(p, tl)
it = [i for t in range(1, tl.GetTrackCount("video") + 1) for i in tl.GetItemListInTrack("video", t) or []
      if i.GetName() == "Adjustment Clip" and i.GetStart() <= f < i.GetEnd()]  # any track: V3 since the 2026-11-02 promote
assert len(it) == 1 and it[0].GetName() == "Adjustment Clip", [i.GetName() for i in it]
it = it[0]; g = it.GetNodeGraph()
print("version", it.GetCurrentVersion()["versionName"], "nodes", g.GetNumNodes(),
      [(i, g.GetNodeLabel(i), g.GetNodeEnabled(i), g.GetToolsInNode(i)) for i in range(1, g.GetNumNodes() + 1)])
if a[0] != "list":
    i, on = int(a[0]), a[1] == "1"
    before = g.GetNodeEnabled(i); ok = g.SetNodeEnabled(i, on)
    print("SetNodeEnabled", i, g.GetNodeLabel(i), "before", before, on, ok, "read back", g.GetNodeEnabled(i))
