# Enable or bypass a colour group's Pre-Clip node (e.g. CAM 5 OFX Noise Reduction before a delivery render, off after).
# usage (MCP down; outside the MCP bridge with the atexit guard, e.g. the editor's rr.sh wrapper):
#   grpnode.py "<group name>" <node index> <0|1>
#   grpnode.py --list                      (groups, pre-clip nodes and their tools)
# There is NO GetNodeEnabled: the return value proves nothing. Prove the state on pixels: render 3 frames of a cut of that
# group at 4K before and after and compare noise (nr_check.py), and expect the render time to jump (NR: 1.5 s -> 15 s).
# Never run while a multicam is open in the timeline or a render is in progress.
import sys, DaVinciResolveScript as d
p = d.scriptapp("Resolve").GetProjectManager().GetCurrentProject()
assert not p.IsRenderingInProgress(), "render in progress"
groups = p.GetColorGroupsList() or []
if sys.argv[1] == "--list":
    for g in groups:
        pg = g.GetPreClipNodeGraph(); n = pg.GetNumNodes() if pg else 0
        print(g.GetName(), [(i, pg.GetToolsInNode(i)) for i in range(1, n + 1)])
    raise SystemExit
g = [x for x in groups if x.GetName() == sys.argv[1]][0]; pg = g.GetPreClipNodeGraph(); n = int(sys.argv[2])
print(g.GetName(), "node", n, pg.GetToolsInNode(n), "SetNodeEnabled", sys.argv[3] == "1", pg.SetNodeEnabled(n, sys.argv[3] == "1"))
