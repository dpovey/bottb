# Clear clip colours on the CURRENT timeline's V1 items over an absolute range, saving the before-state first. Read back.
# Usage: rr.sh resolve/clear_colors.py <in_abs> <out_abs_excl> <before.json>
# Restore from the json by item start: SetClipColor(colour). Flags are separate (media-pool level on multicam clips).
import sys, json, DaVinciResolveScript as d
IN, OUT, J = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3]
p = d.scriptapp("Resolve").GetProjectManager().GetCurrentProject(); tl = p.GetCurrentTimeline()
assert not p.IsRenderingInProgress()
its = [i for i in tl.GetItemListInTrack("video", 1) if IN <= i.GetStart() < OUT]
before = [{"start": i.GetStart(), "end": i.GetEnd(), "name": i.GetName(), "color": i.GetClipColor()} for i in its]
json.dump({"timeline": tl.GetName(), "range": [IN, OUT], "items": before}, open(J, "w"), indent=0)
n = sum(1 for b in before if b["color"])
for i in its:
    if i.GetClipColor(): i.ClearClipColor()
left = [(i.GetStart(), i.GetClipColor()) for i in its if i.GetClipColor()]
print(tl.GetName(), "items", len(its), "coloured before", n, "left after", len(left), left[:5], "saved", J)
