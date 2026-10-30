"""Song-start chapter/marker frame: just BEFORE the first transient (runbook, Dean 2026-10-04).

Rule (runbook "Chapter markers go JUST BEFORE the first transient", Canvanauts 2025):
  10 ms RMS blocks; transient = first block >= 9 dB over the median of the preceding 300 ms, that stays
  >= 6 dB over it for 60 ms, and is followed by sustained level (median of the next 1 s >= 6 dB over it).
  The search window starts >= 3 s before the candidate. marker = floor(transient frame) - 5 (0.2 s).
A transient that decays straight back to silence (I'm Still Standing, 2025) fails the 1 s test, so the
detector moves on to the real entry.

Usage:
  venv/bin/python -I transient_marker.py <audio> <frame_of_sample0> <cand_frame>[:label] ... [--fps 25] [--pre 4] [--post 4]
  frame_of_sample0: the timeline frame where the file's sample 0 sits (item start - left offset).
Prints one line per candidate: transient frame/TC, marker frame/TC, step dB, and the shift vs the candidate.
Reads only ~10 s of audio per candidate (ffmpeg -ss), so it is light (< 100 MB).
"""
import argparse, math, subprocess, sys
import numpy as np

SR = 48000
BLK = 480  # 10 ms


def tc(f, fps):
    f = int(f)
    return "%02d:%02d:%02d:%02d" % (f // (3600 * fps), f // (60 * fps) % 60, f // fps % 60, f % fps)


def load(path, start_s, dur_s):
    cmd = ["ffmpeg", "-v", "error", "-ss", "%.6f" % max(0.0, start_s), "-t", "%.6f" % dur_s, "-i", path,
           "-af", "pan=mono|c0=0.5*c0+0.5*c1", "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"]
    return np.frombuffer(subprocess.check_output(cmd), dtype=np.float32).astype(np.float64)


def find(x, t0, pre_blocks=30, step_db=9.0, hold_db=6.0, hold_blocks=6, sustain_blocks=100):
    n = len(x) // BLK
    rms = np.sqrt(np.mean(x[: n * BLK].reshape(n, BLK) ** 2, axis=1) + 1e-20)
    db = 20 * np.log10(rms)
    for i in range(pre_blocks, n - sustain_blocks):
        base = np.median(db[i - pre_blocks:i])
        if db[i] < base + step_db:
            continue
        if np.min(db[i:i + hold_blocks]) < base + hold_db:
            continue
        if np.median(db[i:i + sustain_blocks]) < base + hold_db:
            continue
        return t0 + i * BLK / SR, db[i] - base, base
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("audio"); ap.add_argument("frame0", type=float); ap.add_argument("cands", nargs="+")
    ap.add_argument("--fps", type=int, default=25); ap.add_argument("--pre", type=float, default=4.0)
    ap.add_argument("--post", type=float, default=4.0)
    a = ap.parse_args()
    for c in a.cands:
        f, _, label = c.partition(":")
        f = int(f)
        t_c = (f - a.frame0) / a.fps
        t0 = t_c - a.pre - 0.3  # 300 ms of baseline before the window
        x = load(a.audio, t0, a.pre + a.post + 0.3 + 1.2)
        r = find(x, max(0.0, t0))
        if r is None:
            print("%-22s cand %d %s  NO TRANSIENT in -%.0f/+%.0f s" % (label, f, tc(f, a.fps), a.pre, a.post))
            continue
        t, step, base = r
        tf = a.frame0 + t * a.fps
        m = math.floor(tf) - 5
        print("%-22s cand %d %s  transient %.1f %s (+%.1f dB over %.1f dBFS)  marker %d %s  (%+.2f s vs cand)"
              % (label, f, tc(f, a.fps), tf, tc(tf, a.fps), step, base, m, tc(m, a.fps), (tf - f) / a.fps))


if __name__ == "__main__":
    sys.exit(main())
