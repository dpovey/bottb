# Set Super Scale on every non-DJI camera .MP4 source clip in the media pool (checklist steps 3/6).
# VALUE = 2 before the RiP, 1 after. It MUST be an int: "2" as a string returns False and silently
# does nothing. Never on the multicam item (one item backs every cut in the show). Reads back.
# If it times out (run_script 10 s), re-run: it is idempotent. Treat no output as unknown state.
VALUE = 2
import DaVinciResolveScript as dvr
resolve = dvr.scriptapp("Resolve"); mp = resolve.GetProjectManager().GetCurrentProject().GetMediaPool()
def walk(f):
    for c in f.GetClipList() or []: yield c
    for s in f.GetSubFolderList() or []: yield from walk(s)
done = skipped = bad = 0
for c in walk(mp.GetRootFolder()):
    n = c.GetName() or ""
    if not n.upper().endswith(".MP4") or n.upper().startswith("DJI") or c.GetClipProperty("Type") == "Multicam":
        continue
    if str(c.GetClipProperty("Super Scale")) == str(VALUE): skipped += 1; continue
    c.SetClipProperty("Super Scale", int(VALUE))
    if str(c.GetClipProperty("Super Scale")) == str(VALUE): done += 1
    else: bad += 1; print("READ-BACK FAIL", n, c.GetClipProperty("Super Scale"))
print("Super Scale=%d: set %d, already %d, failed %d" % (VALUE, done, skipped, bad))
