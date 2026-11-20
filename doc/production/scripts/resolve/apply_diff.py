# Apply a REVISED gigstills apply list over what is already on V1 of the current timeline: rows whose LUT differs from the
# current node-1 LUT get SetLUT(1, new) (sha256 checked) or SetLUT(1, "") when the row has no LUT; unchanged rows are left alone.
# Rows with held true count as no LUT, whatever their lut field says (the apply list's own rule: "apply rows with lut set and held
# false"). You Oughta Know, 2026-11-20: the first version ignored held, and the dry run gave 43 LUTs against the list's 42 (row 6 is
# held but keeps its lut path). Before-state saved; every V1 cut in the list read back at the end, exit 1 on a mismatch.
# --dry prints the diff only. Promoted from the You Oughta Know release scripts (2026-11-21).
# Usage: rr.sh resolve/apply_diff.py <apply_final.json> "<timeline>" <before.json> [--dry]
import sys, json, hashlib, os, DaVinciResolveScript as d
APPLY, TL, BEFORE = sys.argv[1], sys.argv[2], sys.argv[3]; DRY = "--dry" in sys.argv
sys.path.insert(0, os.path.dirname(os.path.abspath(sys.argv[0]))); import pix   # LUT library roots, shared with preflight
def want_lut(row): return "" if row.get("held") else (row.get("lut") or "")
p = d.scriptapp("Resolve").GetProjectManager().GetCurrentProject(); tl = p.GetCurrentTimeline()
assert tl.GetName() == TL, tl.GetName(); assert not p.IsRenderingInProgress()
rows = json.load(open(APPLY))["items"]; v1 = tl.GetItemListInTrack("video", 1)
def match(row):
    ex = [i for i in v1 if (i.GetStart(), i.GetEnd()) == (row["record_in"], row["record_out"]) and i.GetName().endswith(row["angle"])]
    if ex: return ex[0]
    ov = [i for i in v1 if i.GetStart() < row["record_out"] and i.GetEnd() > row["record_in"] and i.GetName().endswith(row["angle"])]
    assert len(ov) == 1, (row["index"], [(i.GetStart(), i.GetEnd(), i.GetName()) for i in ov]); return ov[0]
print("RefreshLUTList", p.RefreshLUTList())
plan, before, refuse = [], [], []
for row in rows:
    it = match(row); g = it.GetNodeGraph(); new = want_lut(row)
    if not g: refuse.append((row["index"], "no node graph")); continue
    n = g.GetNumNodes(); cur = g.GetLUT(1) or ""
    before.append({"index": row["index"], "start": it.GetStart(), "end": it.GetEnd(), "name": it.GetName(), "nodes": n, "lut1": cur})
    if cur == new:
        if n != 1: print("note: row %s unchanged, but its cut has %d nodes" % (row["index"], n))
        continue
    if n != 1: refuse.append((row["index"], "expected 1 node to set node 1's LUT, found %d" % n)); continue  # a hand-added node: look first
    if new:
        f = pix.lut_file(new)
        if not f: refuse.append((row["index"], "LUT file not found: %s" % new)); continue
        if not row.get("sha256"): refuse.append((row["index"], "row has no sha256 to check %s against" % new)); continue
        sha = hashlib.sha256(open(f, "rb").read()).hexdigest()
        if sha != row["sha256"]: refuse.append((row["index"], "sha256 mismatch for %s" % new)); continue
    plan.append((row, it, g, cur, new))
for x in refuse: print("REFUSED row %s: %s" % x)
kinds = {"set (was none)": 0, "changed": 0, "cleared": 0}
for row, it, g, cur, new in plan:
    k = "cleared" if not new else ("set (was none)" if not cur else "changed"); kinds[k] += 1
    print("%2d %d-%d %-13s %-15s %r -> %r" % (row["index"], it.GetStart(), it.GetEnd(), row["angle"], k, cur, new))
print("diff:", kinds, "unchanged", len(rows) - len(plan) - len(refuse), "refused", len(refuse), "| list: with LUT %d, held %d (no LUT), none %d" % (
    sum(1 for r in rows if want_lut(r)), sum(1 for r in rows if r.get("held")), sum(1 for r in rows if not r.get("held") and not r.get("lut"))))
if refuse: raise SystemExit("ABORT: %d rows refused, nothing written" % len(refuse))
if DRY: sys.exit(0)
json.dump({"timeline": TL, "items": before}, open(BEFORE, "w"), indent=1)
for row, it, g, cur, new in plan: g.SetLUT(1, new)
bad = 0
for row in rows:
    got = match(row).GetNodeGraph().GetLUT(1) or ""; want = want_lut(row)
    if got != want: bad += 1; print("READ-BACK FAIL", row["index"], repr(got), repr(want))
print("READBACK %d cuts: with LUT %d, none %d, mismatches %d" % (len(rows), sum(1 for r in rows if want_lut(r)), sum(1 for r in rows if not want_lut(r)), bad))
if bad: raise SystemExit(1)
