# Apply a REVISED gigstills apply list over what is already on V1 of the current timeline: rows whose LUT differs from the
# current node-1 LUT get SetLUT(1, new) (sha256 checked) or SetLUT(1, "") when the row has no LUT; unchanged rows are left alone.
# Rows with held true count as no LUT, whatever their lut field says (the apply list's own rule: "apply rows with lut set and held
# false"). You Oughta Know, 2026-11-20: the first version ignored held, and the dry run gave 43 LUTs against the list's 42 (row 6 is
# held but keeps its lut path). Before-state saved; every V1 cut in the list read back at the end, exit 1 on a mismatch.
# --dry prints the diff only. Promoted from the You Oughta Know release scripts (2026-11-21).
# Usage: rr.sh resolve/apply_diff.py <apply_final.json> "<timeline>" <before.json> [--dry]
import sys, json, hashlib, os, DaVinciResolveScript as d
APPLY, TL, BEFORE = sys.argv[1], sys.argv[2], sys.argv[3]; DRY = "--dry" in sys.argv
LUTDIR = os.environ.get("BOTTB_LUT_ROOT", "/Library/Application Support/Blackmagic Design/DaVinci Resolve/LUT")
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
plan, before = [], []
for row in rows:
    it = match(row); g = it.GetNodeGraph(); n = g.GetNumNodes(); cur = g.GetLUT(1) or ""; new = want_lut(row)
    assert n == 1, ("expected 1 node", row["index"], n)
    before.append({"index": row["index"], "start": it.GetStart(), "end": it.GetEnd(), "name": it.GetName(), "lut1": cur})
    if cur == new: continue
    if new:
        sha = hashlib.sha256(open(os.path.join(LUTDIR, new), "rb").read()).hexdigest(); assert sha == row["sha256"], ("sha mismatch", row["index"], new)
    plan.append((row, it, g, cur, new))
kinds = {"set (was none)": 0, "changed": 0, "cleared": 0}
for row, it, g, cur, new in plan:
    k = "cleared" if not new else ("set (was none)" if not cur else "changed"); kinds[k] += 1
    print("%2d %d-%d %-13s %-15s %r -> %r" % (row["index"], it.GetStart(), it.GetEnd(), row["angle"], k, cur, new))
print("diff:", kinds, "unchanged", len(rows) - len(plan), "| list: with LUT %d, held %d (no LUT), none %d" % (
    sum(1 for r in rows if want_lut(r)), sum(1 for r in rows if r.get("held")), sum(1 for r in rows if not r.get("held") and not r.get("lut"))))
if DRY: sys.exit(0)
json.dump({"timeline": TL, "items": before}, open(BEFORE, "w"), indent=1)
for row, it, g, cur, new in plan: g.SetLUT(1, new)
bad = 0
for row in rows:
    got = match(row).GetNodeGraph().GetLUT(1) or ""; want = want_lut(row)
    if got != want: bad += 1; print("READ-BACK FAIL", row["index"], repr(got), repr(want))
print("READBACK %d cuts: with LUT %d, none %d, mismatches %d" % (len(rows), sum(1 for r in rows if want_lut(r)), sum(1 for r in rows if not want_lut(r)), bad))
if bad: raise SystemExit(1)
