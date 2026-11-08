# Compare post-RiP sample renders with a pre-RiP reference render, per sample: mean |diff| and the mean |diff| after a
# 9-px blur (texture/sharpening from Super Scale shows in the first, a lost group or grade in both). 0-255 scale at 1080p.
# Usage: python -I rip_check.py <post_dir> <post_prefix> <ref.mov> <ref_first_rec> <rec> [<rec> ...]
import sys, subprocess, numpy as np
D, PRE, REF, R0 = sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4])
def grab(path, n):  # seek to frame n (25p) instead of decoding from frame 0 with select
    b = subprocess.run(["ffmpeg", "-v", "error", "-ss", "%.3f" % (n / 25.0), "-i", path, "-vf", "scale=1920:1080", "-frames:v", "1",
                        "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(b, np.uint8).reshape(1080, 1920, 3).astype(np.float32)
def blur(a, k=9):  # separable 9-px box filter by cumulative sums ("same" size, edges averaged over the pixels present)
    for ax in (0, 1):
        pad = [(0, 0)] * a.ndim; pad[ax] = (k // 2 + 1, k // 2)
        c = np.cumsum(np.pad(a, pad), axis=ax); n = np.cumsum(np.pad(np.ones(a.shape[ax]), (k // 2 + 1, k // 2)))
        s = np.take(c, range(k, c.shape[ax]), axis=ax) - np.take(c, range(0, c.shape[ax] - k), axis=ax)
        w = (n[k:] - n[:-k]).reshape([-1 if i == ax else 1 for i in range(a.ndim)])
        a = s / w
    return a
for rec in map(int, sys.argv[5:]):
    a = grab("%s/%s_%d.mov" % (D, PRE, rec), 0); b = grab(REF, rec - R0)
    d = np.abs(a - b).mean(); g = np.abs(blur(a.mean(2)) - blur(b.mean(2))).mean()
    print(rec, "mean|d| %.2f  blurred %.2f  means %.1f / %.1f" % (d, g, a.mean(), b.mean()))
