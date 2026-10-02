# Mark the song's zoomed cuts Orange for Render in Place (checklist step 2). Writes clip colours.
# Rule: DynamicZoomEnabled OR ZoomX >= 1.3. There is no "Red" clip colour (it returns True and
# does nothing), so this reads every colour back. Run state.py first: the show timeline must be
# the current one. Set IN/OUT to the song's record-frame range.
IN, OUT, COLOUR = None, None, "Orange"
import DaVinciResolveScript as dvr
resolve = dvr.scriptapp("Resolve"); proj = resolve.GetProjectManager().GetCurrentProject()
tl = proj.GetCurrentTimeline()
if proj.IsRenderingInProgress():  # 21.1.1: every GetProperty/GetProperties read is empty during
    raise SystemExit("A render is in progress: clip property reads return nothing until it ends "
                     "(zoom counts would silently read 0). Wait on IsRenderingInProgress(), then rerun.")
assert IN is not None and OUT is not None, "set IN/OUT"
marked = bad = 0
for x in tl.GetItemListInTrack("video", 1) or []:
    if x.GetEnd() <= IN or x.GetStart() > OUT: continue
    if x.GetProperty("DynamicZoomEnabled") or float(x.GetProperty("ZoomX") or 1) >= 1.3:
        x.SetClipColor(COLOUR)
        if x.GetClipColor() == COLOUR: marked += 1
        else: bad += 1; print("READ-BACK FAIL", x.GetStart(), x.GetName())
print("marked %d %s, %d failed read-back" % (marked, COLOUR, bad))
