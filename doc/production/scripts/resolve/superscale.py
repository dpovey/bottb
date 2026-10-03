# Set Super Scale on every non-DJI camera source clip (.MP4 and .MXF) in the media pool (checklist steps 3/6).
# .MXF added 2026-10-03: the Sydney 2025 Chase camera is a Sony FX6 recording MXF, and an .MP4-only filter
# silently left it at Super Scale 1. .mov is excluded on purpose (title cards / end card are ProRes .mov).
# VALUE = 2 before the RiP, 1 after. It MUST be an int: "2" as a string returns False and silently
# does nothing. Never on the multicam item (one item backs every cut in the show). Reads back.
# If it times out (run_script 10 s), re-run: it is idempotent. Treat no output as unknown state.
VALUE = 2
CAMERA_EXT = (".MP4", ".MXF")
import DaVinciResolveScript as dvr
resolve = dvr.scriptapp("Resolve"); mp = resolve.GetProjectManager().GetCurrentProject().GetMediaPool()
def walk(f):
    for c in f.GetClipList() or []: yield c
    for s in f.GetSubFolderList() or []: yield from walk(s)
done = skipped = bad = 0
for c in walk(mp.GetRootFolder()):
    n = c.GetName() or ""
    if not n.upper().endswith(CAMERA_EXT) or n.upper().startswith("DJI") or c.GetClipProperty("Type") == "Multicam":
        continue
    if str(c.GetClipProperty("Super Scale")) == str(VALUE): skipped += 1; continue
    c.SetClipProperty("Super Scale", int(VALUE))
    if str(c.GetClipProperty("Super Scale")) == str(VALUE): done += 1
    else: bad += 1; print("READ-BACK FAIL", n, c.GetClipProperty("Super Scale"))
print("Super Scale=%d: set %d, already %d, failed %d" % (VALUE, done, skipped, bad))
