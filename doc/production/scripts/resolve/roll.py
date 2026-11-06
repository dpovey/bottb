# Roll a cut point on a video track by n frames (+ later, - earlier), with read-back of both sides. Works on multicam clips. Replaces the menu-bar trim.
# The trap this exists for: SetRightOffset alone is not a roll. Extending eats the next clip's head, and shortening leaves a gap, and putting it back doesn't return what it ate.
# Usage: rr.sh resolve/roll.py <cut_rec_abs> <n> [track=1]    (cut_rec = the start of the clip after the cut)
import os, sys, DaVinciResolveScript as d
sys.path.insert(0, os.path.dirname(os.path.abspath(sys.argv[0]))); import pix
a = sys.argv[1:]; CUT, N = int(a[0]), int(a[1]); T = int(a[2]) if len(a) > 2 else 1
r = d.scriptapp("Resolve"); p = r.GetProjectManager().GetCurrentProject(); tl = p.GetCurrentTimeline(); pix.writable(p, tl); v = tl.GetItemListInTrack("video", T)
i = next((k for k, x in enumerate(v) if x.GetStart() == CUT), None); assert i, "no cut at %d on V%d" % (CUT, T)
A, B = v[i - 1], v[i]; assert A.GetEnd() == CUT, "gap before the cut: %d to %d" % (A.GetEnd(), CUT)
assert N < B.GetDuration() and -N < A.GetDuration(), "roll is longer than a clip"; ar, bl = A.GetRightOffset(), B.GetLeftOffset()
assert N <= ar and -N <= bl, "not enough source: %s right %d, %s left %d" % (A.GetName(), ar, B.GetName(), bl)
ok = A.SetRightOffset(ar - N)
if ok and N < 0:
    ok = B.SetLeftOffset(bl + N)
    if not ok: print("B wouldn't extend, so A goes back:", A.SetRightOffset(ar))  # or the shortened A leaves a gap
print("set", ok, "A", A.GetName(), A.GetStart(), A.GetEnd(), "offset", ar, "->", A.GetRightOffset(), "B", B.GetName(), B.GetStart(), B.GetEnd(), "offset", bl, "->", B.GetLeftOffset())
good = ok and A.GetEnd() == CUT + N == B.GetStart() and A.GetRightOffset() == ar - N and B.GetLeftOffset() == bl + N
print("OK" if good else "BAD: read-back doesn't match a %+d roll" % N); raise SystemExit(0 if good else 1)
