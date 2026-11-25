# Per-cut colour check between two look-off renders of the same timeline range (frame 0 = record r0): for each cut in the cut list,
# mean RGB over the middle 60% of the cut's frames (every 4th frame, 480x270), and the per-channel ratio and difference.
# A missing CDL or a CDL applied twice shows as a steady per-channel shift on that cut only; NR/Super Scale change texture, not means.
# Streams both renders per cut (two ffmpeg pipes), so memory stays small.
# Used on Barracuda 2026-11-25 to tell baked / missing / doubled CDLs after a Render in Place (control: 0.2 codes median between two
# renders of the same pictures). usage: <venv python with numpy> -I percut-compare.py <before.mp4> <after.mp4> <cut_list.json> <r0> <r_out> <out.csv>
#   r0 = record frame of both renders' frame 0; r_out = last record frame; cut_list.json = drp_cutlist.py or cut_list.py output
import sys, json, csv, subprocess, numpy as np
A, B, CL = sys.argv[1:4]; R0, ROUT, OUT = int(sys.argv[4]), int(sys.argv[5]), sys.argv[6]; FPS = float(sys.argv[7]) if len(sys.argv) > 7 else 25.0; W, H = 480, 270
items = [r for r in json.load(open(CL))["items"] if r["record_out"] > R0 and r["record_in"] <= ROUT]
def means(path, f0, n):
    cmd = ["ffmpeg", "-nostdin", "-v", "error", "-ss", "%.4f" % (f0 / FPS), "-i", path, "-frames:v", str(n),
           "-vf", "scale=%d:%d" % (W, H), "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
    pr = subprocess.run(cmd, capture_output=True)
    if pr.returncode: sys.exit("ffmpeg failed on %s: %s" % (path, pr.stderr.decode(errors="replace")[-300:]))
    b = pr.stdout; k = len(b) // (W * H * 3)
    x = np.frombuffer(b[:k * W * H * 3], np.uint8).reshape(k, H, W, 3)[::4].astype(np.float32)
    return x.reshape(-1, 3).mean(0) if len(x) else np.full(3, np.nan)
rows = []
for r in items:
    lo, hi = max(r["record_in"], R0), min(r["record_out"], ROUT + 1); L = hi - lo
    f0 = lo - R0 + int(0.2 * L); n = max(1, int(0.6 * L))
    a, b = means(A, f0, n), means(B, f0, n); d = b - a
    rows.append(dict(record_in=r["record_in"], angle=r["angle"], zoomed=bool(r["dynamic_zoom"] or r["zoom_x"] >= 1.3),
                     before=" ".join("%.1f" % v for v in a), after=" ".join("%.1f" % v for v in b),
                     diff=" ".join("%+.2f" % v for v in d), maxabs=round(float(np.nanmax(np.abs(d))), 2)))
    print("%d %-6s %-5s before %s after %s diff %s" % (r["record_in"], r["angle"], "Z" if rows[-1]["zoomed"] else "", rows[-1]["before"], rows[-1]["after"], rows[-1]["diff"]))
if not rows: sys.exit("no cuts in %d-%d" % (R0, ROUT))
with open(OUT, "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0])); w.writeheader(); w.writerows(rows)
for label, xs in (("unzoomed", [x["maxabs"] for x in rows if not x["zoomed"]]), ("zoomed", [x["maxabs"] for x in rows if x["zoomed"]])):
    if xs: print("%s cuts max|diff| median %.2f max %.2f (%d cuts)" % (label, np.median(xs), max(xs), len(xs)))
