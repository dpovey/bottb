# Read the CDL on each V1 cut in a range, node by node, and print the ones that aren't identity. Read-only. Use it before SetCDL, to skip cuts Dean graded and to compare with an applied list.
# Usage: rr.sh resolve/cdl_read.py <in_abs> <out_abs> [out.json]
import json, os, sys, DaVinciResolveScript as d
sys.path.insert(0, os.path.dirname(os.path.abspath(sys.argv[0]))); import pix
a = sys.argv[1:]; IN, OUT = int(a[0]), int(a[1]); p = d.scriptapp("Resolve").GetProjectManager().GetCurrentProject(); pix.rendering(p); tl = p.GetCurrentTimeline()
def identity(c): return all(abs(float(v) - t) < 1e-4 for k, t in (("Slope", 1), ("Offset", 0), ("Power", 1)) for v in c.get(k, "").split()) and abs(float(c.get("Saturation", 1)) - 1) < 1e-4
rows = []
for it in pix.v1_cuts(tl, IN, OUT):
    n = it.GetNumNodes() or 0; cs = {i: it.GetCDL(i) for i in range(1, n + 1)}; hit = {i: c for i, c in cs.items() if c and not identity(c)}
    rows.append(dict(start=it.GetStart(), name=it.GetName(), nodes=n, version=(it.GetCurrentVersion() or {}).get("versionName"), cdl=hit))
    if hit: print(it.GetStart(), it.GetName(), "nodes", n, hit)
print("%d cuts, %d with a non-identity CDL" % (len(rows), sum(1 for x in rows if x["cdl"])))
if len(a) > 2: json.dump(rows, open(a[2], "w"), indent=1)
