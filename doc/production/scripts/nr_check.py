#!/usr/bin/env python3
"""Prove a noise-reduction toggle on pixels: compare two short 4K renders of the same frames (before / after).
usage: ~/src/personal/gigstills/.venv/bin/python -I nr_check.py <before.mov> <after.mov>
Prints spatial high-frequency sd (frame minus 5x5 box blur) and frame-to-frame sd on the middle frames, plus mean level.
NR on: both noise figures drop, the mean stays. Proven 2026-10-30 on CAM 5 (drum, 03:36:04:00): HF 0.0192 -> 0.0094,
frame-to-frame (frames 0 vs 2) 0.0440 -> 0.0335, mean 0.292 -> 0.291."""
import subprocess, sys, numpy as np


def frames(path):
    w, h = map(int, subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
                                    "-of", "csv=p=0", path], capture_output=True, text=True).stdout.split()[0].split(","))
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "rawvideo", "-pix_fmt", "gray16le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint16).reshape(-1, h, w).astype(float) / 65535


def box(y, k=5):
    c = np.cumsum(np.cumsum(np.pad(y, ((k // 2 + 1, k // 2), (k // 2 + 1, k // 2)), mode="edge"), 0), 1)
    return (c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]) / (k * k)


for label, path in zip(("before", "after"), sys.argv[1:3]):
    f = frames(path); i = len(f) // 2; y = f[i]
    hf = (y - box(y))[50:-50, 50:-50]; dt = (f[min(i + 1, len(f) - 1)] - f[i - 1 if i else 0])[50:-50, 50:-50]
    print(f"{label:6s} frames {len(f)}  spatial HF sd {hf.std():.5f}  frame-to-frame sd {dt.std():.5f}  mean {y.mean():.4f}")
