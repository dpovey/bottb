"""Crowd energy from the Static Desk (FOH) camera's audio minus the desk sum.

There are no crowd mics. The FOH camera hears PA + crowd; the desk sum (`_DESKREF_02_16k.wav`,
REF seconds) is the PA's source. In 300 Hz-4 kHz, 0.1 s frames:
`crowd_over = cam_dB − desk_dB − median(cam_dB − desk_dB)` over the window's music frames,
smoothed 1 s. Between songs, when the desk is near silent, the camera level itself is crowd
(applause/cheering), so `crowd_abs = cam_dB − the camera's 5th percentile` is kept too.

The camera is mapped to REF through gigstills' placements plan (picture-measured, ±1 frame);
FOH acoustic delay (~60-80 ms) is irrelevant at 1 s smoothing.
"""
from __future__ import annotations

import numpy as np
import soundfile as sf
from scipy.ndimage import uniform_filter1d
from scipy.signal import butter, sosfilt

from . import config as C
from . import frames as FR

SR16 = 16000
HOP = 1600  # 0.1 s


def _band_db(x):
    sos = butter(4, [300, 4000], btype="band", fs=SR16, output="sos")
    y = sosfilt(sos, x)
    m = len(y) // HOP
    return 10 * np.log10(np.mean(y[: m * HOP].reshape(m, HOP) ** 2, 1) + 1e-12)


def crowd_curve(a: float, b: float):
    """Return t (REF s, 0.1 s steps), crowd_over dB, crowd_abs dB, desk dB (all 1 s smoothed)."""
    desk, _ = sf.read(str(C.SYNC_AUDIO / "_DESKREF_02_16k.wav"), start=int(a * SR16), stop=int(b * SR16),
                      dtype="float32")
    n = len(desk) // HOP
    cam = np.zeros(n * HOP, np.float32)
    have = np.zeros(n, bool)
    # piecewise: each 10 s chunk located separately (pieces of the plan can step a frame)
    step = 10.0
    for k in range(int(np.ceil((b - a) / step))):
        r0 = a + k * step
        loc = FR.locate(1, r0)
        if loc is None:
            continue
        name, src = loc
        i0 = int(k * step * SR16)
        i1 = min(n * HOP, int((k + 1) * step * SR16))
        x, _ = sf.read(str(C.SYNC_AUDIO / f"STATIC_DESKCAM__{name}.wav"), start=int(src * SR16),
                       stop=int(src * SR16) + (i1 - i0), dtype="float32")
        cam[i0:i0 + len(x)] = x
        have[i0 // HOP:(i0 + len(x)) // HOP] = True
    d = _band_db(desk[: n * HOP])
    c = _band_db(cam)
    diff = c - d
    music = d > np.percentile(d, 40)
    off = np.median(diff[music & have]) if np.any(music & have) else 0.0
    over = uniform_filter1d(diff - off, 10)
    cabs = uniform_filter1d(c - np.percentile(c[have], 5) if have.any() else c * 0, 10)
    over[~have] = np.nan
    cabs[~have] = np.nan
    t = a + (np.arange(n) + 0.5) * HOP / SR16
    return t, over, cabs, uniform_filter1d(d, 10)
