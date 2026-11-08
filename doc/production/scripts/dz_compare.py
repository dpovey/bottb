# Read-only: compare the Dynamic Zoom params (EffectFiltersBA group 118) of V2 overlays with the V1 originals they cover,
# from a project export. Prints raw param equality per record start. Usage: python3.14 -I dz_compare.py <export.drp> "<timeline>" REC...
import sys, os
sys.path.insert(0, os.path.expanduser('~/src/personal/resolve-lab/scripts'))
import drp_cutlist as D
proj = D.Project(sys.argv[1]); tl = proj.timeline_by_name(sys.argv[2]); want = [int(a) for a in sys.argv[3:]]
vt, _ = proj.tracks(tl)
def dz(track):
    out = {}
    for it in track.findall('Items/Element/*'):
        if it.tag == 'Sm2TiTransition': continue
        st = D.num(D.txt(it, 'Start')); orig = it.find('OriginalClip/Sm2TiVideoClip'); src = orig if orig is not None else it
        eff = D.effects(D.txt(src, 'EffectFiltersBA')); g = eff.get(118)
        out[st] = (g or {}).get('params', {})
    return out
a, b = dz(vt[0]), dz(vt[1])
for s in want:
    pa, pb = a.get(s), b.get(s)
    keys = sorted(set(pa or {}) | set(pb or {}))
    print(s, "V2 present" if s in b else "V2 MISSING", {k: ("same" if (pa or {}).get(k) == (pb or {}).get(k) else "DIFF") for k in keys})
    for k in keys:
        if (pa or {}).get(k) != (pb or {}).get(k): print("   ", k, "orig", (pa or {}).get(k), "\n    new ", (pb or {}).get(k))
