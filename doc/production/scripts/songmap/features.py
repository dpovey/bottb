"""Stream a REF window of the desk multitrack into compact per-track features.

One track at a time, in 60 s blocks (float32 ~11 MB each), so the peak stays near 0.3 GB
whatever the window length. Output (npz, all float16/float32, ~20 frames/s):

* `<track>/full|low|mid|high` — band energies in dB (whole, <200 Hz, 200-4000 Hz, >4 kHz)
* `<track>/flat` — spectral flatness of 200-4000 Hz (tonal ≈ low; noise/cymbal bleed ≈ high)
* `<track>/cent` — spectral centroid (Hz)
* `<track>/chent` — chroma entropy in bits (one note ≈ low; chords/noise ≈ high)
* `<track>/env` — 100 Hz RMS envelope in dB (drums and onset work)
* group mel spectra (`mel_inst`, `mel_vox`, 64 bands, dB) and `chroma_inst` (12) — power sums of the
  group's tracks, for segmentation (the sum of projections is the projection of the power sum)

Usage: python -m songmap.features <band> [--start S --end E] (defaults to the band's set ± 30 s)
"""
from __future__ import annotations

import argparse
import sys
import time

import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt

from . import config as C

GROUP_INST = ["Kick", "Snare", "HH", "T1", "T2", "FT", "OH L", "OH R", "Bass", "GTR SR", "GTR SL",
              "BASS Q", "GTR Q1", "GTR Q2", "ACC 1", "ACC 2", "KEYS 2L", "KEYS 2R", "TRAX"]
GROUP_MELODIC = ["Bass", "GTR SR", "GTR SL", "BASS Q", "GTR Q1", "GTR Q2", "ACC 1", "ACC 2",
                 "KEYS 2L", "KEYS 2R"]
GROUP_VOX = C.VOCAL_MICS
LP_ENV = ["Kick", "T1", "T2", "FT"]  # low-passed 100 Hz envelopes (tom hits without cymbal/snare bleed)


def _filters():
    import librosa

    mel = librosa.filters.mel(sr=C.SR, n_fft=C.NFFT, n_mels=64, fmin=30, fmax=16000).astype(np.float32)
    chroma = librosa.filters.chroma(sr=C.SR, n_fft=C.NFFT, n_chroma=12).astype(np.float32)
    f = np.fft.rfftfreq(C.NFFT, 1 / C.SR)
    # chroma only from 80 Hz - 5 kHz (below is rumble, above is mostly cymbal bleed)
    chroma[:, (f < 80) | (f > 5000)] = 0
    return mel, chroma, f


def track_features(name: str, a: float, b: float, mel, chroma, f):
    """Return (dict of per-frame arrays, mel power (T,64), chroma power (T,12))."""
    path = C.AUDIO_DIR / f"{name} #02.wav"
    win = np.hanning(C.NFFT).astype(np.float32)
    lo, mid, hi = f < 200, (f >= 200) & (f < 4000), f >= 4000
    s0 = int(a * C.SR)
    s1 = int(b * C.SR)
    nfr = (s1 - s0) // C.HOP
    out = {k: np.full(nfr, -150, np.float32) for k in ("full", "low", "mid", "high", "flat", "cent", "chent")}
    out["flat"][:] = 1
    env = np.full((s1 - s0) // C.ENV_HOP, -150, np.float32)
    envlo = env.copy()
    sos = butter(4, 300, btype="low", fs=C.SR, output="sos") if name in LP_ENV else None
    melP = np.zeros((nfr, 64), np.float32)
    chP = np.zeros((nfr, 12), np.float32)
    blk_fr = 1200  # frames per block = 60 s
    pad = C.NFFT // 2
    with sf.SoundFile(str(path)) as fh:
        assert fh.samplerate == C.SR
        for i0 in range(0, nfr, blk_fr):
            i1 = min(nfr, i0 + blk_fr)
            # frame i is centred on s0 + i*HOP + HOP/2
            c0 = s0 + i0 * C.HOP + C.HOP // 2 - pad
            n = (i1 - i0 - 1) * C.HOP + C.NFFT
            start = max(0, c0)
            fh.seek(start)
            x = fh.read(n - (start - c0), dtype="float32", always_2d=False)
            if start > c0:
                x = np.concatenate([np.zeros(start - c0, np.float32), x])
            if len(x) < n:
                x = np.concatenate([x, np.zeros(n - len(x), np.float32)])
            idx = np.arange(i1 - i0)[:, None] * C.HOP + np.arange(C.NFFT)[None, :]
            X = np.fft.rfft(x[idx] * win, axis=1)
            P = (X.real ** 2 + X.imag ** 2).astype(np.float32)
            del X
            norm = float(np.sum(win ** 2)) * C.NFFT / 2
            tot = P.sum(1) / norm
            out["full"][i0:i1] = 10 * np.log10(tot + 1e-15)
            out["low"][i0:i1] = 10 * np.log10(P[:, lo].sum(1) / norm + 1e-15)
            pm = P[:, mid]
            out["mid"][i0:i1] = 10 * np.log10(pm.sum(1) / norm + 1e-15)
            out["high"][i0:i1] = 10 * np.log10(P[:, hi].sum(1) / norm + 1e-15)
            out["flat"][i0:i1] = np.exp(np.mean(np.log(pm + 1e-20), 1)) / (np.mean(pm, 1) + 1e-20)
            out["cent"][i0:i1] = (P * f).sum(1) / (P.sum(1) + 1e-20)
            ch = P @ chroma.T
            chn = ch / (ch.sum(1, keepdims=True) + 1e-20)
            out["chent"][i0:i1] = -(chn * np.log2(chn + 1e-12)).sum(1)
            melP[i0:i1] = (P @ mel.T) / norm
            chP[i0:i1] = ch / norm
            del P
            # 100 Hz envelope over the same span
            e0 = (i0 * C.HOP) // C.ENV_HOP
            e1 = min(len(env), (i1 * C.HOP) // C.ENV_HOP)
            xs = x[pad - C.HOP // 2: pad - C.HOP // 2 + (e1 - e0) * C.ENV_HOP]
            m = len(xs) // C.ENV_HOP
            env[e0:e0 + m] = 10 * np.log10(np.mean(xs[: m * C.ENV_HOP].reshape(m, C.ENV_HOP) ** 2, 1) + 1e-15)
            if sos is not None:
                xl = sosfilt(sos, x)[pad - C.HOP // 2: pad - C.HOP // 2 + m * C.ENV_HOP]
                envlo[e0:e0 + m] = 10 * np.log10(np.mean(xl.reshape(m, C.ENV_HOP) ** 2, 1) + 1e-15)
    out["env"] = env
    if name in LP_ENV:
        out["envlo"] = envlo
    if name in GROUP_MELODIC:
        out["chroma"] = chP  # (T, 12) power, for "plays its own line vs follows the band"
    return out, melP, chP


def extract(band: str, a: float | None = None, b: float | None = None, out_path=None, tracks=None):
    cfg = C.BANDS[band]
    if a is None:
        a = cfg["set"][0] - 30
    if b is None:
        b = cfg["set"][1] + 30
    mel, chroma, f = _filters()
    res = {"t0": np.float64(a), "fps": np.float64(C.SR / C.HOP), "env_fps": np.float64(C.SR / C.ENV_HOP)}
    groups = {"inst": None, "vox": None, "chroma_inst": None}
    for name in tracks or C.TRACKS:
        t = time.time()
        o, melP, chP = track_features(name, a, b, mel, chroma, f)
        for k, v in o.items():
            res[f"{name}/{k}"] = v.astype(np.float32 if k in ("env", "envlo", "chroma") else np.float16)
        if name in GROUP_INST:
            groups["inst"] = melP if groups["inst"] is None else groups["inst"] + melP
        if name in GROUP_VOX:
            groups["vox"] = melP if groups["vox"] is None else groups["vox"] + melP
        if name in GROUP_MELODIC:
            groups["chroma_inst"] = chP if groups["chroma_inst"] is None else groups["chroma_inst"] + chP
        print(f"{name:8s} {time.time() - t:5.1f}s", flush=True)
    for k, v in groups.items():
        if v is not None:
            res[f"mel_{k}" if k != "chroma_inst" else k] = (10 * np.log10(v + 1e-15)).astype(np.float32)
    out_path = out_path or (C.OUT / "_cache" / f"{band}_features.npz")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(out_path, **res)
    print("wrote", out_path)
    return out_path


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("band")
    ap.add_argument("--start", type=float)
    ap.add_argument("--end", type=float)
    ap.add_argument("--out")
    ap.add_argument("--tracks", nargs="*")
    ns = ap.parse_args()
    from pathlib import Path

    extract(ns.band, ns.start, ns.end, Path(ns.out) if ns.out else None, ns.tracks)
    sys.exit(0)
