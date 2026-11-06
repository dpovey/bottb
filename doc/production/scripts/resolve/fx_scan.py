# Every OFX and Fusion effect on the timeline's clips, and any that Resolve doesn't list as installed. Read-only. 0.4 s on 1,800 items.
# Usage: rr.sh resolve/fx_scan.py [<in_abs> <out_abs>]
# Built for the Mustang Sally missing gigsteady plugin ("GPU processing failed", found by bisecting renders). Not yet proved on a really missing plugin.
import collections, os, sys, DaVinciResolveScript as d
sys.path.insert(0, os.path.dirname(os.path.abspath(sys.argv[0]))); import pix
a = sys.argv[1:]; r = d.scriptapp("Resolve"); p = r.GetProjectManager().GetCurrentProject(); pix.rendering(p); tl = p.GetCurrentTimeline()
lo, hi = (int(a[0]), int(a[1])) if a else (tl.GetStartFrame(), tl.GetEndFrame())
known = {e.get("id") for e in r.GetEffectsList() or []}
counts = collections.Counter(); missing = []
for t in range(1, tl.GetTrackCount("video") + 1):
    for it in tl.GetItemListInTrack("video", t) or []:
        if it.GetEnd() <= lo or it.GetStart() > hi: continue
        for cat in ("ofx", "fusion"):
            for e in it.GetEffects(cat) or []:
                i = e.GetInfo() or {}; on = e.GetIsEnabled(); counts[(cat, i.get("name") or "?", "on" if on else "off")] += 1
                if not i or (cat == "ofx" and i.get("id") not in known): missing.append((t, it.GetName(), it.GetStart(), i.get("id")))
for k, n in sorted(counts.items()): print(n, *k)
print("not installed or unreadable: %d" % len(missing)); [print(" ", *m) for m in missing[:40]]
raise SystemExit(1 if missing else 0)
