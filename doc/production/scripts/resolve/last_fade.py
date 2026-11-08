# Set the FadeOut on the last V1 cut of a song, clamped to the cut's length (SetFades returns False if the fade is longer
# than the item; 96 on a 96-frame item reads back 95). Read back. usage: last_fade.py <out_abs> <frames> [track=1]
# With an overlay (gigsteady V2) on the last cut, fade BOTH tracks, or the V1 original shows through the fading overlay.
# A force quit lost exactly this edit on 2026-10-30: re-run it after any crash.
import sys, DaVinciResolveScript as dvr
p = dvr.scriptapp("Resolve").GetProjectManager().GetCurrentProject(); tl = p.GetCurrentTimeline()
OUT, n = int(sys.argv[1]), int(sys.argv[2]); TR = int(sys.argv[3]) if len(sys.argv) > 3 else 1
it = [x for x in tl.GetItemListInTrack("video", TR) if x.GetStart() <= OUT < x.GetEnd()][0]
n = min(n, it.GetEnd() - it.GetStart())
print("item", it.GetName(), it.GetStart(), it.GetEnd(), "set", n, it.SetFades({"FadeOut": n}), "read", it.GetFades())
