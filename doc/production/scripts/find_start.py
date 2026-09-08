import subprocess, numpy as np, sys
from scipy.signal import butter, sosfiltfilt, fftconvolve

SR = 4000
def load(path, start=0, dur=None):
    cmd = ["ffmpeg", "-v", "error", "-ss", str(start)] + (["-t", str(dur)] if dur else []) + \
          ["-i", path, "-af", "pan=mono|c0=0.5*c0+0.5*c1", "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"]
    return np.frombuffer(subprocess.check_output(cmd), dtype=np.float32).astype(np.float64)

def bp(x):
    sos = butter(4, [100, 1500], btype="band", fs=SR, output="sos")
    return sosfiltfilt(sos, x)

stem = "/Volumes/Extreme SSD/bottb/events/2026/Brisbane/01_Media/The ShipRex/09&10_OHDs.wav"
zooms = {
    "192449 (00:15:51:03)": ("/Volumes/BOTTB/Audio/260827_192449/260827_192449_TrLR.WAV", 951.12),
    "205800 (01:49:01:25)": ("/Volumes/BOTTB/Audio/260827_205800/260827_205800_TrLR.WAV", 6541.0),
}
chunks = [(2, 30), (600, 30)]  # (offset into stem, length) — two probes 10 min apart
for name, (path, tc0) in zooms.items():
    z = bp(load(path)); z /= (np.std(z) + 1e-12)
    print(f"\n== Zoom {name}: {len(z)/SR:.0f} s loaded")
    for off, dur in chunks:
        s = bp(load(stem, off, dur)); s /= (np.std(s) + 1e-12)
        c = fftconvolve(z, s[::-1], mode="valid") / len(s)
        k = int(np.argmax(np.abs(c)))
        peak = c[k]; noise = np.std(c)
        t_zoom = k / SR            # where the chunk starts in the zoom file
        stem_start_in_zoom = t_zoom - off
        tc = tc0 + stem_start_in_zoom
        h, r = divmod(tc, 3600); m, sec = divmod(r, 60); fr = int(round((sec - int(sec)) * 25))
        print(f"  probe @{off:4d}s: peak {peak:+.3f} ({abs(peak)/noise:.0f}x noise) at zoom {t_zoom:9.3f}s"
              f" -> stem start = zoom {stem_start_in_zoom:9.3f}s = show TC {int(h):02d}:{int(m):02d}:{int(sec):02d}:{fr:02d}")
