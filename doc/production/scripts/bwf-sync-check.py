#!/usr/bin/env python3
"""Check a BWF-stamped Sydney 2026 bounce against the desk scratch (the bp/up/ms_sync recipe, 2026-10-17..22).

Usage (bottb scripts venv):
  venv/bin/python -I bwf-sync-check.py <bounce.wav> [--ref <scratch.wav>] [--ref-zero N] [--points 20,80,...]

For each point: 30 s of the bounce, 300-3000 Hz, FFT NCC against the scratch +/-10 s around where the
stamp says it is. Prints the lag vs the stamp (ms and frames), NCC and the runner-up outside +/-50 ms,
then a wrong-region control (bounce t vs scratch 90 s later). Also prints the timeline frame to place
it at: round(stamp / 1920) at 25 fps (show TC = Logic TC on the Sydney edit timeline).

Reading it: the known mixed-vs-unmixed offset against this scratch is about +7 ms. A stamp holds when every
point agrees within a ms or two, NCC is well above the runner-up, and the control is near 0.
Proven on Mustang Sally MIXv1 (+7.0 ms x5, control 0.029) and, as up_sync.py, Under Pressure and Black Parade.
Peak ~0.32 GB, ~2 min for five points.
"""
import argparse, json, subprocess, sys
import numpy as np, soundfile as sf
from scipy.signal import butter, sosfiltfilt

SCRATCH = "/Volumes/BOTTB/Sydney - 2026/video/DESK_SCRATCH_sum_stereo_plus16dB_48k.wav"
REF_ZERO = 172800000 - 134523   # Logic sample that is scratch sample 0 (runbook 2026-10-14 REF mapping)
SR = 48000

ap = argparse.ArgumentParser()
ap.add_argument("bounce"); ap.add_argument("--ref", default=SCRATCH)
ap.add_argument("--ref-zero", type=int, default=REF_ZERO)
ap.add_argument("--points", help="comma-separated seconds into the bounce (default: 5 spread over it)")
a = ap.parse_args()

tags = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format_tags:format=duration",
                                  "-of", "json", a.bounce], capture_output=True, text=True).stdout)["format"]
stamp = int(tags.get("tags", {}).get("time_reference", -1)); dur = float(tags["duration"])
if stamp < 0: sys.exit("no BWF time_reference on %s: stamp it first (mix-assist), or place by correlation" % a.bounce)
fr = stamp / 1920; f = round(fr)
print("stamp %d = frame %.3f -> place at %d = %02d:%02d:%02d:%02d (frame lands %+.1f ms after the stamp), %.3f s = %.2f frames"
      % (stamp, fr, f, f // 90000, f // 1500 % 60, f // 25 % 60, f % 25, (f * 1920 - stamp) / 48, dur, dur * 25))

sos = butter(4, [300, 3000], btype="band", fs=SR, output="sos")
def mono(path, start, n):
    x, _ = sf.read(path, start=start, frames=n, dtype="float32", always_2d=True)
    return sosfiltfilt(sos, x.mean(1)).astype(np.float32)
def ncc_best(b, r):
    N = 1 << int(np.ceil(np.log2(len(r) + len(b))))
    c = np.fft.irfft(np.fft.rfft(r, N) * np.conj(np.fft.rfft(b, N)), N)[:len(r) - len(b) + 1]
    e = np.sqrt(np.convolve(r * r, np.ones(len(b), np.float32), "valid")) * np.sqrt((b * b).sum()) + 1e-9
    c = c / e; k = int(np.argmax(c)); m = c.copy(); m[max(0, k - 2400):k + 2400] = -1
    return k, float(c[k]), float(m.max())

EXP = stamp - a.ref_zero; SEARCH = 10 * SR; WIN = 30 * SR
pts = [float(p) for p in a.points.split(",")] if a.points else list(np.linspace(20, max(20, dur - 46), 5).round())
for t in pts:
    s = int(t * SR); b = mono(a.bounce, s, WIN); s0 = EXP + s - SEARCH
    k, pk, ru = ncc_best(b, mono(a.ref, s0, WIN + 2 * SEARCH)); lag = (s0 + k) - (EXP + s)
    print("bounce t=%4.0fs  lag vs stamp %+8.1f ms (%+.2f frames)  ncc %.3f  runner-up %.3f" % (t, lag / 48, lag / 1920, pk, ru))
s = int(pts[1 if len(pts) > 1 else 0] * SR); s0 = EXP + s + 90 * SR - SEARCH
k, pk, ru = ncc_best(mono(a.bounce, s, WIN), mono(a.ref, s0, WIN + 2 * SEARCH))
print("control (scratch 90 s later) ncc %.3f runner-up %.3f" % (pk, ru))
