# One look-off frame per camera, without a render or touching a track: run after a Log input or colour group change. Read-only.
# Saves frames and a sheet; with a baseline, prints what moved. Names RiP'd clips with no group too: one out of its group came in +20 levels bright (NOK).
# The same frame is measured each time, so a move is the input change and not the picture. Baseline holds rec per group.
# Usage: rr.sh resolve/input_proof.py <in_abs> <out_abs> <outdir> [baseline.json]   writes <outdir>/proof_<time>.json; pass an earlier one to compare. Each run keeps its own frames, so the same outdir is safe.
import json, os, subprocess, sys, time, DaVinciResolveScript as d
sys.path.insert(0, os.path.dirname(os.path.abspath(sys.argv[0]))); import pix
a = sys.argv[1:]; IN, OUT, D = int(a[0]), int(a[1]), a[2]; base = json.load(open(a[3])) if len(a) > 3 else None; os.makedirs(D, exist_ok=True)
p = d.scriptapp("Resolve").GetProjectManager().GetCurrentProject(); pix.rendering(p); tl = p.GetCurrentTimeline()
by, nogroup = {}, []
for it in pix.v1_cuts(tl, IN, OUT):
    by.setdefault(pix.camera(it), it)
    if pix.src_type(it) != "Multicam" and not it.GetColorGroup(): nogroup.append(it)
print("RiP'd or plain cuts with no colour group:", len(nogroup), [(i.GetName(), i.GetStart()) for i in nogroup[:8]])
res = {}; files = []; STAMP = time.strftime("%Y%m%d_%H%M%S")
for i, (n, it) in enumerate(sorted(by.items()), 1):
    rec = (base or {}).get(n, {}).get("rec")
    if rec:
        it = next((x for x in tl.GetItemListInTrack("video", 1) if x.GetStart() <= rec < x.GetEnd()), it)
    else: rec = it.GetStart() + it.GetDuration() // 2
    f = "%s/camera_%02d_%s.png" % (D, i, STAMP)
    if not pix.export(it, rec - it.GetStart(), f, maxDimension=960): print("%-32s %s EXPORT FAILED" % (n, pix.tc(rec))); continue
    files.append(f)
    res[n] = {"rec": rec, "item": it.GetName(), "Y": round(pix.level(f), 2), "kind": pix.kind(f), "frame": f}
    line = "%-32s %s Y %.1f %s" % (n, pix.tc(rec), res[n]["Y"], res[n]["kind"])
    if base and n in base and os.path.exists(base[n]["frame"]):
        line += "   moved: Y %+.1f  mean|rgb| %.1f" % (res[n]["Y"] - base[n]["Y"], pix.rgb_diff(f, base[n]["frame"]))
    print(line)
if files:
    cols = min(3, len(files)); rows = (len(files) + cols - 1) // cols
    args = sum((["-i", f] for f in files), [])
    subprocess.run(["ffmpeg", "-v", "error", "-y"] + args + ["-filter_complex", "".join("[%d:v]" % i for i in range(len(files))) + "concat=n=%d:v=1,tile=%dx%d" % (len(files), cols, rows), "-frames:v", "1", "%s/proof_sheet_%s.jpg" % (D, STAMP)], check=True)
    print("%s/proof_sheet_%s.jpg" % (D, STAMP))
json.dump(res, open("%s/proof_%s.json" % (D, STAMP), "w"), indent=1); print("%s/proof_%s.json" % (D, STAMP))
