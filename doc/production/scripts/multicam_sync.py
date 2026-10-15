#!/usr/bin/env python3
"""Measure where each camera clip sits against a continuous reference (desk/multitrack) audio.

Usage:
  multicam_sync.py REF.wav CLIP.wav [CLIP.wav ...] --expect S [S ...] [--search 30] [--json out.json]

All WAVs mono, same sample rate (16 kHz is plenty). --expect is each clip's start in REF seconds from its
camera clock (creation_time - REF start + that camera's clock offset; get the offset from one clip that
locks globally with --search 0 = whole REF, then check that every other clip of that camera agrees).

Method (proven on Sydney 2026, 2026-10-13):
  1. Coarse = windowed vote. 300-3000 Hz 10 ms log-RMS envelopes; every 60 s window of the clip finds its
     best lag within expect +/- search; the confident windows (r >= 0.3) vote and the median of the
     majority cluster (+/- 0.2 s) wins. A whole-clip correlation fails on stage-side cameras: in
     changeovers they hear stage noise while the desk is silent, those windows anti-correlate and cancel
     the music (drum cam C1364: whole-clip z -92 at the true position, 9 of 15 windows at +0.2 s).
  2. Fine = sample-level NCC (300-3000 Hz, +/- 0.25 s around coarse) in the best envelope windows (music),
     20 s each (shorter on short clips), with a wrong-region control (same probe vs REF +/- 37 s).
  3. Drift = least-squares lag vs clip time over the fine probes, in ppm, with the max residual.
  verdict LOCKED = >= 4 probes with r >= 0.15, median r >= 3x control, and residual after the drift fit
  <= 15 ms (single-window jitter of a room mic vs the desk is +/- 20-40 ms: PA and acoustic kit arrive at
  different delays, so trust the fit over many probes, never one window).

A positive start means the clip starts that many seconds after REF sample 0. It is the AUDIO position:
a camera mic d metres from the PA hears each event d/343 s after its picture, so aligning the audio pulls
the clip EARLY: picture-true start = start + d/343. Correct for that separately (runbook: Sydney 2025 Wide
lagged the desk mix by 81 ms at ~27 m). Per-window drift fits were noise on Sydney 2026 (same camera
-8.8 to +23 ppm): place long clips per set from per-set medians instead.
"""
import argparse
import json
import sys

import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt, sosfiltfilt, fftconvolve

ENV_HOP = 160  # 10 ms at 16 kHz -> 100 Hz envelope
BAND = (300.0, 3000.0)


def bandpass(sr):
    return butter(4, [BAND[0] / (sr / 2), BAND[1] / (sr / 2)], btype="band", output="sos")


def envelope(path):
    """Causal band-pass, 10 ms log-RMS, chunked so a 3 h file stays small in RAM."""
    sr = sf.info(path).samplerate
    hop = ENV_HOP * sr // 16000
    sos = bandpass(sr)
    zi = np.zeros((sos.shape[0], 2))
    out, carry = [], np.zeros(0, dtype=np.float32)
    for block in sf.blocks(path, blocksize=sr * 60, dtype="float32", always_2d=True):
        y, zi = sosfilt(sos, block[:, 0], zi=zi)
        y = np.concatenate([carry, y.astype(np.float32)])
        n = len(y) // hop
        seg = y[: n * hop].reshape(n, hop).astype(np.float64)
        out.append(np.log10(np.sqrt((seg ** 2).mean(axis=1)) + 1e-6))
        carry = y[n * hop:]
    e = np.concatenate(out)
    return (e - e.mean()) / (e.std() + 1e-9), sr / hop, sr


def windowed_corr(seg, ref_seg):
    """Pearson r of seg against every same-length slice of ref_seg (valid lags)."""
    L = len(seg)
    s = (seg - seg.mean()) / (seg.std() * L + 1e-12)
    num = fftconvolve(ref_seg, s[::-1], mode="valid")
    cs = np.concatenate([[0.0], np.cumsum(ref_seg)])
    cs2 = np.concatenate([[0.0], np.cumsum(ref_seg ** 2)])
    mu = (cs[L:] - cs[:-L]) / L
    sd = np.sqrt(np.maximum((cs2[L:] - cs2[:-L]) / L - mu ** 2, 1e-12))
    return num / sd


def coarse_vote(ref_env, env, rate, expect, search, win_s=60.0, hop_s=30.0):
    """Each window votes its best lag inside expect +/- search. Returns start, votes, windows list."""
    W = int(min(win_s, max(5.0, len(env) / rate - 1)) * rate)
    hop = max(1, int(hop_s * rate))
    R = int(search * rate)
    wins = []
    for t in range(0, max(1, len(env) - W + 1), hop):
        seg = env[t:t + W]
        r0 = int(round(expect * rate)) + t - R
        a, b = max(0, r0), min(len(ref_env), r0 + W + 2 * R)
        if b - a < W + 1:
            continue
        c = windowed_corr(seg, ref_env[a:b])
        k = int(np.argmax(c))
        wins.append({"t": t / rate, "start": expect + (a - r0 + k - R) / rate, "r": float(c[k])})
    good = [w for w in wins if w["r"] >= 0.3] or sorted(wins, key=lambda w: -w["r"])[:3]
    if not good:
        return None, 0, wins
    starts = np.array([w["start"] for w in good])
    best = max(starts, key=lambda s: np.sum(np.abs(starts - s) <= 0.2))
    cl = starts[np.abs(starts - best) <= 0.2]
    return float(np.median(cl)), int(len(cl)), wins


def ncc_lag(ref_seg, clip_seg, max_lag):
    c = fftconvolve(ref_seg, clip_seg[::-1], mode="valid")
    cs = np.concatenate([[0.0], np.cumsum(ref_seg.astype(np.float64) ** 2)])
    L = len(clip_seg)
    r = c / (np.sqrt(cs[L:] - cs[:-L]) * np.sqrt(np.sum(clip_seg.astype(np.float64) ** 2)) + 1e-12)
    i = int(np.argmax(r))
    frac = 0.0
    if 0 < i < len(r) - 1:
        a, b, d = r[i - 1], r[i], r[i + 1]
        den = a - 2 * b + d
        frac = 0.5 * (a - d) / den if den else 0.0
    return i - max_lag + frac, float(r[i])


def read(path, start, n):
    if start < 0:
        return np.zeros(0, dtype=np.float32)
    x, _ = sf.read(path, start=start, frames=n, dtype="float32", always_2d=True)
    return x[:, 0]


def fine(ref_path, clip_path, start_s, sr, n_ref, n_clip, wins, probes):
    sos = bandpass(sr)
    max_lag = sr // 4
    win = int(min(20 * sr, n_clip - 2 * max_lag))
    if win < 2 * sr:
        return []
    s0 = int(round(start_s * sr))
    # probe centres: best envelope windows first, spread at least 120 s apart where possible
    cands = sorted(wins, key=lambda w: -w["r"])
    picks = []
    for w in cands:
        p = int(w["t"] * sr)
        p = min(max(p, 0), n_clip - win)
        if s0 + p - max_lag < 0 or s0 + p + win + max_lag > n_ref:
            continue
        if all(abs(p - q) >= min(120 * sr, n_clip // probes) for q in picks):
            picks.append(p)
        if len(picks) >= probes:
            break
    res = []
    for p in sorted(picks):
        clip = read(clip_path, p, win)
        ref = read(ref_path, s0 + p - max_lag, win + 2 * max_lag)
        ctl_at = s0 + p - max_lag + 37 * sr
        if ctl_at + win + 2 * max_lag > n_ref:
            ctl_at = s0 + p - max_lag - 37 * sr
        ctl = read(ref_path, ctl_at, win + 2 * max_lag)
        if len(ref) < win + 2 * max_lag or len(clip) < win or len(ctl) < win + 2 * max_lag or np.std(clip) < 1e-6:
            continue
        clip, ref, ctl = (sosfiltfilt(sos, x) for x in (clip, ref, ctl))
        lag, r = ncc_lag(ref, clip, max_lag)
        _, r_ctl = ncc_lag(ctl, clip, max_lag)
        res.append({"clip_s": p / sr, "lag_ms": 1000 * lag / sr, "r": r, "r_ctl": r_ctl})
    return res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("ref")
    ap.add_argument("clips", nargs="+")
    ap.add_argument("--expect", type=float, nargs="+", required=True)
    ap.add_argument("--search", type=float, default=30.0, help="+/- seconds around expect (0 = whole REF)")
    ap.add_argument("--probes", type=int, default=16)
    ap.add_argument("--json")
    a = ap.parse_args()
    if len(a.expect) != len(a.clips):
        sys.exit("--expect needs one value per clip")

    ref_env, rate, sr = envelope(a.ref)
    n_ref = sf.info(a.ref).frames
    out = []
    for cp, exp in zip(a.clips, a.expect):
        info = sf.info(cp)
        if info.samplerate != sr:
            sys.exit(f"{cp}: {info.samplerate} Hz != ref {sr} Hz")
        env, _, _ = envelope(cp)
        search = a.search if a.search > 0 else n_ref / sr + info.frames / sr
        start, votes, wins = coarse_vote(ref_env, env, rate, exp, search)
        rec = {"clip": cp, "dur_s": info.frames / sr, "expect_s": exp, "coarse_start_s": start,
               "votes": votes, "n_windows": len(wins), "verdict": "NOLOCK"}
        if start is not None:
            probes = fine(a.ref, cp, start, sr, n_ref, info.frames, wins, a.probes)
            good = [p for p in probes if p["r"] >= 0.15]
            rec["probes"] = probes
            if good:
                t = np.array([p["clip_s"] for p in good])
                lag = np.array([p["lag_ms"] for p in good])
                if len(good) >= 3 and np.ptp(t) > 600:
                    k, b = np.polyfit(t, lag, 1)
                else:
                    k, b = 0.0, float(np.median(lag))
                resid = lag - (k * t + b)
                # drop single outliers (> 3x MAD) once, then refit
                mad = np.median(np.abs(resid - np.median(resid))) + 1e-9
                keep = np.abs(resid) <= max(3 * 1.4826 * mad, 10)
                if keep.sum() >= 3 and np.ptp(t[keep]) > 600:
                    k, b = np.polyfit(t[keep], lag[keep], 1)
                elif keep.sum() >= 1:
                    k, b = 0.0, float(np.median(lag[keep]))
                resid = lag[keep] - (k * t[keep] + b)
                r_med = float(np.median([p["r"] for p in good]))
                ctl_med = float(np.median([p["r_ctl"] for p in good]))
                rec.update({
                    "start_s": start + b / 1000, "drift_ppm": k * 1000, "resid_max_ms": float(np.abs(resid).max()),
                    "n_good": int(keep.sum()), "n_probes": len(probes), "r_med": r_med, "r_ctl_med": ctl_med,
                    "end_shift_ms": k * rec["dur_s"],
                })
                ok = keep.sum() >= 4 and r_med >= 3 * ctl_med and rec["resid_max_ms"] <= 15
                rec["verdict"] = "LOCKED" if ok else "CHECK"
        out.append(rec)
        name = cp.split("/")[-1]
        if "start_s" in rec:
            print(f"{rec['verdict']:6} {name:32} start {rec['start_s']:10.3f} s (clock {rec['start_s'] - exp:+7.2f})  "
                  f"votes {votes}/{len(wins)}  drift {rec['drift_ppm']:+6.2f} ppm ({rec['end_shift_ms']:+6.1f} ms over clip)  "
                  f"resid {rec['resid_max_ms']:5.1f} ms  r {rec['r_med']:.2f} ctl {rec['r_ctl_med']:.2f}  "
                  f"{rec['n_good']}/{rec['n_probes']}", flush=True)
        else:
            print(f"{rec['verdict']:6} {name:32} coarse {start}  votes {votes}/{len(wins)}", flush=True)
    if a.json:
        with open(a.json, "w") as f:
            json.dump(out, f, indent=1)


if __name__ == "__main__":
    main()
