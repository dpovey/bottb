# Put EndCard_2x.mov (fades baked into RGB, opaque alpha: needs Add) on a title track so it ends at the song's Out, video only,
# CompositeMode Add, and read back. Usage: rr.sh resolve/end_card.py <out_abs> <track> [frames=98]
import sys, DaVinciResolveScript as d
OUT, TR = int(sys.argv[1]), int(sys.argv[2]); N = int(sys.argv[3]) if len(sys.argv) > 3 else 98
r = d.scriptapp("Resolve"); p = r.GetProjectManager().GetCurrentProject(); tl = p.GetCurrentTimeline(); mp = p.GetMediaPool()
def walk(f):
    for c in f.GetClipList() or []: yield c
    for s in f.GetSubFolderList() or []: yield from walk(s)
card = [c for c in walk(mp.GetRootFolder()) if c.GetName() == "EndCard_2x.mov"]; assert card, "EndCard_2x.mov not in the pool"
st = OUT - N + 1
busy = [i.GetName() for i in tl.GetItemListInTrack("video", TR) or [] if i.GetStart() <= OUT and i.GetEnd() > st]
assert not busy, "track %d busy: %s" % (TR, busy)
io = tl.GetMarkInOut(); ph = tl.GetCurrentTimecode()
it = mp.AppendToTimeline([{"mediaPoolItem": card[0], "startFrame": 0, "endFrame": N, "recordFrame": st, "trackIndex": TR, "mediaType": 1}])[0]
it.SetProperty("CompositeMode", r.COMPOSITE_ADD)
print("card", it.GetName(), it.GetStart(), it.GetEnd(), "want", st, OUT + 1, "CompositeMode", it.GetProperty("CompositeMode"), "ADD =", r.COMPOSITE_ADD)
if io.get("video") and tl.GetMarkInOut() != io: tl.SetMarkInOut(io["video"]["in"], io["video"]["out"], "all")
tl.SetCurrentTimecode(ph)
