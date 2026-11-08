# Make a song's In/Out persistent, or get it back, through its Cyan "RELEASE: ..." duration marker (the convention on every show).
# usage (via rr.sh):
#   release_inout.py mark "<Band - Song>"      record the timeline's current In/Out: a Cyan marker on the In (In+1 if another marker
#                                              holds the In, e.g. the chapter marker), duration to the Out, named
#                                              "RELEASE: <Band - Song> (In N, Out M)". Replaces only that song's own RELEASE marker
#                                              ("RELEASE: <Band - Song>" with or without the range), restores it if the add fails, saves.
#   release_inout.py restore "<substring>"     set In/Out from the marker (pix.release_range: the name's range wins), then save
# Every change is read back; the note shows the timecodes on the viewer overlay. Proved on Paint It Black, 2026-11-08.
import os, sys, DaVinciResolveScript as dvr
sys.path.insert(0, os.path.dirname(os.path.abspath(sys.argv[0]))); import pix
cmd, key = sys.argv[1], sys.argv[2]
pm = dvr.scriptapp("Resolve").GetProjectManager(); tl = pm.GetCurrentProject().GetCurrentTimeline(); st = tl.GetStartFrame()
if cmd == "mark":
    if abs(float(tl.GetSetting("timelineFrameRate") or 25) - 25) > 0.01: raise SystemExit("25p timelines only (pix.tc)")
    v = tl.GetMarkInOut().get("video") or {}
    if "in" not in v or "out" not in v: raise SystemExit("set the song's In/Out on the timeline first")
    IN, OUT = v["in"] + st, v["out"] + st
    base = "release: %s" % key.lower()
    marks = tl.GetMarkers() or {}
    own = {f: m for f, m in marks.items() if m["name"].lower() == base or m["name"].lower().startswith(base + " (")}
    others = {f for f in marks if f not in own}
    F = IN - st + (1 if (IN - st) in others else 0)
    if F in others: raise SystemExit("frames %d and %d both hold other markers; nothing changed" % (IN, IN + 1))
    for f, m in own.items(): print("remove", f + st, m["name"], tl.DeleteMarkerAtFrame(f))
    name, note = "RELEASE: %s (In %d, Out %d)" % (key, IN, OUT), "In %s Out %s" % (pix.tc(IN), pix.tc(OUT))
    if not tl.AddMarker(F, "Cyan", name, note, OUT - st - F + 1, ""):
        for f, m in own.items(): tl.AddMarker(f, m["color"], m["name"], m.get("note", ""), m.get("duration", 1), m.get("customData", ""))
        raise SystemExit("AddMarker failed at %d; the old RELEASE marker is back" % (F + st))
    got = pix.release_range(tl, key)[:2]; print("added", tl.GetMarkers().get(F), "reads back", got)
    if got != (IN, OUT): raise SystemExit("read-back %s is not the In/Out %s" % (got, (IN, OUT)))
    print("save", pm.SaveProject())
elif cmd == "restore":
    IN, OUT, name = pix.release_range(tl, key)
    if not pix.set_inout(tl, IN, OUT): raise SystemExit("In/Out would not set: %s" % tl.GetMarkInOut())
    v = tl.GetMarkInOut()["video"]; print("RELEASE", name, "-> In/Out", v["in"] + st, v["out"] + st); print("save", pm.SaveProject())
else: raise SystemExit("mark | restore")
