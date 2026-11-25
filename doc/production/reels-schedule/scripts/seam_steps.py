#!/usr/bin/env python3
"""Compare each reel's loop-point step with every other 10 ms step in the reel, and write a waveform-free seam report. Run with the gigstills venv from the project directory."""
import json, os, subprocess
import numpy as np
R = os.path.expanduser("~/src/personal/gigstills/runs/sydney26_reels/report/")
for r in json.load(open("data/reels.json"))["reels"]:
    if not r.get("file") or not r["ready"]:
        continue
    b = subprocess.run(["ffmpeg", "-v", "error", "-i", R + r["file"], "-ac", "1", "-ar", "48000", "-f", "f32le", "-"], capture_output=True).stdout
    x = np.frombuffer(b, dtype=np.float32)
    loop = np.concatenate([x[-48000:], x[:48000]])
    rms = lambda a: 20 * np.log10(np.sqrt(np.mean(a ** 2)) + 1e-9)
    w = 480  # 10 ms blocks
    n = len(x) // w
    lev = np.array([rms(x[i * w:(i + 1) * w]) for i in range(n)])
    jumps = np.abs(np.diff(lev))
    seam = abs(rms(x[:w]) - rms(x[-w:]))
    samp = np.abs(np.diff(x))
    step = abs(float(x[0]) - float(x[-1]))
    print(f'{r["key"]:11s} {r.get("loop","?"):8s} sample step {step:.3f}: p99.9 {np.percentile(samp,99.9):.3f} max {samp.max():.3f}, {(samp>=step).mean()*100:.3f}% of steps bigger | 10 ms level change {seam:.1f} dB: p99 {np.percentile(jumps,99):.1f} max {jumps.max():.1f} dB, {(jumps>=seam).mean()*100:.2f}% bigger')
