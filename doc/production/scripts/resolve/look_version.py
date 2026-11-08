# The show look's local versions on the Adjustment Clip (any video track): list, add (copies the current grade and becomes current), or load.
# One change per run, read back. Usage: rr.sh resolve/look_version.py list [frame_abs] | add|load "<version>" [frame_abs] | rename "<old>" "<new>" [frame_abs]
#   frame_abs picks the Adjustment Clip under that record frame (default: the current playhead, 25p only).
# Proven 2026-10-29 by hand (ab.sh; pixels: v1 = Bear copy = v1 reloaded); promoted 2026-11-01.
import sys, DaVinciResolveScript as d
sys.path.insert(0, __import__("os").path.dirname(__import__("os").path.abspath(sys.argv[0]))); import pix
a = sys.argv[1:]; cmd = a[0]
need = {"list": 0, "add": 1, "load": 1, "rename": 2}
if cmd not in need: raise SystemExit("list|add|load|rename")
if len(a) < 1 + need[cmd]: raise SystemExit("%s needs %d name argument(s)" % (cmd, need[cmd]))
names = a[1:1 + need[cmd]]; rest = a[1 + need[cmd]:]; name = names[0] if names else None
tl = d.scriptapp("Resolve").GetProjectManager().GetCurrentProject().GetCurrentTimeline()
if rest: f = int(rest[0])
else:
    if abs(float(tl.GetSetting("timelineFrameRate") or 25) - 25) > 0.01: raise SystemExit("25p timelines only: pass frame_abs")
    h, m, s, fr = map(int, tl.GetCurrentTimecode().split(":")); f = ((h * 60 + m) * 60 + s) * 25 + fr
it = [i for t in range(1, tl.GetTrackCount("video") + 1) for i in tl.GetItemListInTrack("video", t) or []
      if i.GetName() == "Adjustment Clip" and i.GetStart() <= f < i.GetEnd()]  # any track: V3 since the 2026-11-02 promote
assert len(it) == 1, "expected one Adjustment Clip under %d, got %d" % (f, len(it)); it = it[0]
def show(tag):
    print(tag, it.GetName(), it.GetStart(), it.GetEnd(), "current:", it.GetCurrentVersion(), "local:", it.GetVersionNameList(0))
show("before")
if cmd == "add": print("AddVersion", it.AddVersion(name, 0))
elif cmd == "rename": print("RenameVersionByName", it.RenameVersionByName(name, names[1], 0))
elif cmd == "load": print("LoadVersionByName", it.LoadVersionByName(name, 0))
if cmd != "list": show("after")
