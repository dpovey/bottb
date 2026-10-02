#!/usr/bin/env python3
"""Place a short clip (stills-camera video, phone clip) against a camera's room audio.

Usage (bottb scripts venv has numpy/scipy):
  venv/bin/python sync-short-clip.py <clip> <ref_media> [--ref-ss S] [--ref-t T]

Decodes both to 8 kHz mono via ffmpeg (light: a 7 s clip vs 7 min of reference is ~60 MB),
band-passes 300-3000 Hz, runs normalised cross-correlation (Pearson r per lag) and prints:
  - the whole-clip peak, the next peak >1 s away, and a reversed-clip control
  - the peak for the first half, second half and middle of the clip
  - clip_start_in_ref_media_s = ref-ss + peak lag  (seconds into the reference MEDIA file)
Trust it only when the three sub-windows agree (to the sample on a real lock) and the peak
clearly beats both the next peak and the control.

CAVEATS (2026-09-30): the result is where the clip matches the REFERENCE CAMERA'S audio, which lags
the desk mix by that camera's acoustic delay (Sydney Wide: 81 ms, i.e. 2 frames). Subtract it, or refine
against the mix in a +/-1 s window around this answer. Confirm with clock-offset agreement across
several clips from the same camera.

Use a CAMERA's own audio as the reference for the search, not the desk mix: a camera mic hears the room,
and against the mix it does not lock (Canvanauts reel 2026-09-30: mix r 0.106 vs control
0.091; Wide cam r 0.27 vs next 0.144 / control 0.124, halves identical).
"""
import argparse
import subprocess

import numpy as np
from scipy.signal import butter, fftconvolve, sosfiltfilt

SR = 8000
SOS = butter(4, [300, 3000], btype="band", fs=SR, output="sos")


def decode(path, ss=None, t=None):
    cmd = ["ffmpeg", "-v", "error"]
    if ss is not None:
        cmd += ["-ss", str(ss)]
    if t is not None:
        cmd += ["-t", str(t)]
    cmd += ["-i", path, "-vn", "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"]
    raw = subprocess.run(cmd, check=True, capture_output=True).stdout
    return sosfiltfilt(SOS, np.frombuffer(raw, dtype=np.float32).astype(np.float64))


def ncc(q, r):
    q = q - q.mean()
    q = q / np.linalg.norm(q)
    n = len(q)
    num = fftconvolve(r, q[::-1], mode="valid")
    c = np.concatenate([[0], np.cumsum(r)])
    c2 = np.concatenate([[0], np.cumsum(r * r)])
    s = c[n:] - c[:-n]
    s2 = c2[n:] - c2[:-n]
    return num / np.sqrt(np.maximum(s2 - s * s / n, 1e-12))


def peaks(r, k=2, sep=SR):
    r = r.copy()
    out = []
    for _ in range(k):
        i = int(np.argmax(r))
        out.append((i, float(r[i])))
        r[max(0, i - sep): i + sep] = -1
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("clip")
    ap.add_argument("ref")
    ap.add_argument("--ref-ss", type=float, default=0.0, help="start of search window in ref media (s)")
    ap.add_argument("--ref-t", type=float, default=None, help="length of search window (s)")
    a = ap.parse_args()
    q = decode(a.clip)
    ref = decode(a.ref, a.ref_ss or None, a.ref_t)
    c = ncc(q, ref)
    (i, r1), (j, r2) = peaks(c)
    ctrl = float(ncc(q[::-1].copy(), ref).max())
    print("whole clip  lag %.4f s  r %.3f | next peak %.4f s r %.3f | reversed control r %.3f"
          % (i / SR, r1, j / SR, r2, ctrl))
    n = len(q)
    lags = []
    for lo, hi, lab in [(0, n // 2, "first half"), (n // 2, n, "second half"), (n // 4, 3 * n // 4, "middle")]:
        cc = ncc(q[lo:hi].copy(), ref)
        k = int(np.argmax(cc))
        lags.append((k - lo) / SR)
        print("%-11s lag %.4f s  r %.3f" % (lab, (k - lo) / SR, cc[k]))
    spread_ms = (max(lags) - min(lags)) * 1000
    ok = spread_ms <= 15 and r1 > 1.5 * max(r2, ctrl)
    print("sub-window spread %.1f ms -> %s" % (spread_ms, "LOCKED" if ok else "NOT TRUSTED"))
    print("clip_start_in_ref_media_s %.4f" % (a.ref_ss + i / SR))


if __name__ == "__main__":
    main()
