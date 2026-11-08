# Levels of short look renders, per state: luma (Rec.709, display-referred) percentiles and near-clip share, vs a base state.
# Usage: venv/bin/python -I look_levels.py <dir> <base_prefix> <prefix> [<prefix> ...]   (files <prefix>_<in>.mov, same <in>s)
# Decodes at 960x540 rgb48. Prints per prefix: p25 p50 p75 p90 p95 p99 of Y, % Y > 0.85, % any channel > 0.95, and the
# ratio to base for each percentile, and chroma (max-min channel) overall and in Y > 0.6. Also an md5 of the decoded frames to show identical states.
import sys, glob, os, subprocess, hashlib, numpy as np
D, pres = sys.argv[1], sys.argv[2:]
BINS = 4096  # per-file histograms, so memory doesn't grow with the render's length (streaming rule)
def load(pre):
    h = hashlib.md5(); fs = sorted(glob.glob(os.path.join(D, pre + "_*.mov")))
    if not fs: raise SystemExit("no files %s_*.mov in %s" % (pre, D))
    acc = dict(y=np.zeros(BINS), c=np.zeros(BINS), cm=np.zeros(BINS), n=0, hi=0, clip=0, csum=0.0, msum=0.0, mn=0)
    for f in fs:
        b = subprocess.run(["ffmpeg", "-v", "error", "-i", f, "-vf", "scale=960:540", "-f", "rawvideo", "-pix_fmt", "rgb48le", "-"],
                           capture_output=True, check=True).stdout
        h.update(b); a = np.frombuffer(b, "<u2").reshape(-1, 3).astype(np.float32) / 65535
        y = a @ np.array([0.2126, 0.7152, 0.0722], np.float32); c = a.max(1) - a.min(1); m = y > 0.6
        acc["y"] += np.histogram(y, BINS, (0, 1))[0]; acc["c"] += np.histogram(c, BINS, (0, 1))[0]
        acc["n"] += len(y); acc["hi"] += int((y > 0.85).sum()); acc["clip"] += int((a.max(1) > 0.95).sum())
        acc["csum"] += float(c.sum()); acc["msum"] += float(c[m].sum()); acc["mn"] += int(m.sum())
    return acc, h.hexdigest()[:10]
def pct(hist, p):  # percentile from a histogram, bin centres
    cum = np.cumsum(hist) / hist.sum(); return (np.searchsorted(cum, np.asarray(p) / 100.0) + 0.5) / BINS
P = [25, 50, 75, 90, 95, 99]
base = None
for pre in pres:
    A, md5 = load(pre); q = pct(A["y"], P); hi = 100 * A["hi"] / A["n"]; clip = 100 * A["clip"] / A["n"]
    if base is None: base = q
    print("%-6s md5 %s  " % (pre, md5) + " ".join("p%d %.3f(x%.2f)" % (p, v, v / b) for p, v, b in zip(P, q, base))
          + "  Y>0.85 %.1f%%  ch>0.95 %.1f%%" % (hi, clip))
    print("        chroma mean %.3f  median %.3f  in Y>0.6 (%.0f%% of px) %.3f" % (A["csum"] / A["n"], pct(A["c"], 50), 100 * A["mn"] / A["n"],
                                                                         A["msum"] / A["mn"] if A["mn"] else 0))
