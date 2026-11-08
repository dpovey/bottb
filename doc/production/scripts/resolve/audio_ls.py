# List audio items overlapping an absolute frame range, per track: name, track enabled, item start-end, left offset, enabled, path.
# Read-only. Usage: rr.sh resolve/audio_ls.py <in_abs> <out_abs>
import sys
import DaVinciResolveScript as d
IN, OUT = int(sys.argv[1]), int(sys.argv[2])
tl = d.scriptapp("Resolve").GetProjectManager().GetCurrentProject().GetCurrentTimeline()
for t in range(1, tl.GetTrackCount("audio") + 1):
    hits = [i for i in tl.GetItemListInTrack("audio", t) or [] if i.GetStart() <= OUT and i.GetEnd() > IN]
    if not hits: continue
    print("A%d %r track %s" % (t, tl.GetTrackName("audio", t), "ON" if tl.GetIsTrackEnabled("audio", t) else "off"))
    for i in hits:
        mpi = i.GetMediaPoolItem()
        path = mpi.GetClipProperty("File Path") if mpi else "?"
        en = i.GetClipEnabled() if callable(getattr(i, "GetClipEnabled", None)) else "?"
        print("   %d-%d  left %s  item %s  %s" % (i.GetStart(), i.GetEnd(), i.GetLeftOffset(), "on" if en else "off", path))
