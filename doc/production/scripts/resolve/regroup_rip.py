# After Render in Place: RiP'd V1 items leave their camera colour group (runbook 2026-10-03/06). Re-assign each "<...> - <Angle> Render*.mov"
# V1 item in an absolute range to the group whose name contains the angle, read back. Usage: rr.sh resolve/regroup_rip.py <in> <out_excl>
import sys, DaVinciResolveScript as d
IN, OUT = int(sys.argv[1]), int(sys.argv[2])
p = d.scriptapp("Resolve").GetProjectManager().GetCurrentProject(); tl = p.GetCurrentTimeline()
groups = {g.GetName(): g for g in p.GetColorGroupsList()}
ok = bad = 0
for i in tl.GetItemListInTrack("video", 1):
    n = i.GetName()
    if not (IN <= i.GetStart() < OUT and " Render" in n and n.endswith(".mov")): continue
    angle = n.split(" - ")[-1].split(" Render")[0]
    g = [v for k, v in groups.items() if angle in k]
    if len(g) != 1: print("NO GROUP", n, angle); bad += 1; continue
    i.AssignToColorGroup(g[0]); r = i.GetColorGroup()
    good = r is not None and r.GetName() == g[0].GetName(); ok += good; bad += not good
    print(i.GetStart(), angle, "->", r.GetName() if r else None)
print("regrouped", ok, "failed", bad)
