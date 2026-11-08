# Back up, clear and restore clip colours on the current timeline, by colour and record range, every change read back.
# usage (via rr.sh):
#   clip_colours.py backup <in_abs> <out_abs> <colour|all> <backup.json>   read-only: track, start, end, name, colour of the matches
#   clip_colours.py clear <backup.json>                                    clear exactly the items in the backup (matched by track,
#                                                                          start and name, and only if they still hold that colour)
#   clip_colours.py restore <backup.json>                                  put each item's colour back, unless it has been
#                                                                          given another colour since
# Made for the Say It Ain't So Orange leftovers (2026-11-08): post_delivery.py clears Orange in one song's range only.
import json, sys, DaVinciResolveScript as dvr
a = sys.argv[1:]; tl = dvr.scriptapp("Resolve").GetProjectManager().GetCurrentProject().GetCurrentTimeline()
def items():
    for kind in ("video", "audio"):
        for t in range(1, tl.GetTrackCount(kind) + 1):
            for it in tl.GetItemListInTrack(kind, t) or []: yield "%s%d" % (kind[0].upper(), t), it
if a[0] == "backup":
    lo, hi, col, path = int(a[1]), int(a[2]), a[3], a[4]
    rows = [dict(track=t, start=it.GetStart(), end=it.GetEnd(), name=it.GetName(), color=it.GetClipColor() or "") for t, it in items()
            if it.GetEnd() > lo and it.GetStart() <= hi and (it.GetClipColor() or "") and (col == "all" or it.GetClipColor() == col)]
    json.dump(dict(timeline=tl.GetName(), range=[lo, hi], colour=col, items=rows), open(path, "w"), indent=1)
    print("backed up %d items to %s" % (len(rows), path))
elif a[0] in ("clear", "restore"):
    B = json.load(open(a[1])); assert B["timeline"] == tl.GetName(), (B["timeline"], tl.GetName())
    want = {(r["track"], r["start"], r["name"]): r["color"] for r in B["items"]}; done = bad = skipped = found = 0
    for t, it in items():
        c = want.get((t, it.GetStart(), it.GetName()))
        if c is None: continue
        found += 1
        if a[0] == "clear":
            if (it.GetClipColor() or "") != c: print("skip, colour changed:", t, it.GetStart(), it.GetClipColor()); skipped += 1; continue
            it.ClearClipColor(); good = (it.GetClipColor() or "") == ""
        else:
            if (it.GetClipColor() or "") not in ("", c): print("skip, coloured since:", t, it.GetStart(), it.GetClipColor()); skipped += 1; continue
            it.SetClipColor(c); good = it.GetClipColor() == c
        done += good; bad += not good
    print("%s %d, failed %d, skipped %d, not found %d" % (a[0], done, bad, skipped, len(want) - found))
else: raise SystemExit("backup | clear | restore")
