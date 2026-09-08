import subprocess, numpy as np, sys
from scipy.signal import correlate, butter, sosfiltfilt

SR = 48000
D = sys.argv[1].rstrip("/") + "/"  # stem folder

def load(name, start, dur, chan="c0"):
    cmd = ["ffmpeg", "-v", "error", "-ss", str(start), "-t", str(dur), "-i", D + name,
           "-af", f"pan=mono|c0={chan}", "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"]
    return np.frombuffer(subprocess.check_output(cmd), dtype=np.float32).astype(np.float64)

# 1. find a loud 20 s window using the snare track (5 s hops)
snr_full = load("03 Snare Top.wav", 0, 1e9, "c0")
hop = SR * 5
n = len(snr_full) // hop
rms = np.array([np.sqrt(np.mean(snr_full[i*hop:(i+1)*hop]**2)) for i in range(n)])
# restrict to the middle 60% of the set
lo, hi = int(n*0.2), int(n*0.8)
best = lo + int(np.argmax(rms[lo:hi]))
start = best * 5 - 5
dur = 20
print(f"analysis window: {start}s - {start+dur}s (snare RMS {20*np.log10(rms[best]):.1f} dBFS)")
del snr_full

def bp(x, f1, f2):
    sos = butter(4, [f1, f2], btype="band", fs=SR, output="sos")
    return sosfiltfilt(sos, x)

def xcorr(a, b, maxlag, band):
    a = bp(a, *band); b = bp(b, *band)
    a = a / (np.std(a) + 1e-12); b = b / (np.std(b) + 1e-12)
    c = correlate(a, b, mode="full", method="fft") / len(a)
    mid = len(a) - 1
    seg = c[mid - maxlag: mid + maxlag + 1]
    k = int(np.argmax(np.abs(seg)))
    lag = k - maxlag
    return lag, seg[k], seg

ohL = load("09 OH.wav", start, dur, "c0")
ohR = load("09 OH.wav", start, dur, "c1")
oh = (ohL + ohR) / 2
tracks = {
    "Kick In": ("01 Kick In.wav", (40, 400)),
    "Kick Out": ("02 Kick Out.wav", (40, 400)),
    "Snare Top": ("03 Snare Top.wav", (120, 1500)),
    "Hi-Hats": ("05 Hi-Hats.wav", (2000, 8000)),
    "Tom 1": ("06 Tom 1.wav", (80, 800)),
    "Tom 2": ("07 Tom 2.wav", (80, 800)),
    "Floor Tom": ("08 Floor Tom.wav", (60, 600)),
    "Room": ("21 Room.wav", (120, 1500)),
}
sig = {k: load(v[0], start, dur, "c0") for k, v in tracks.items()}
maxlag = int(SR * 0.025)  # ±25 ms
print("\n--- each close mic vs OH (L+R). lag<0 = close mic arrives EARLIER than OH (negative = physically expected) ---")
print(f"{'track':12} {'lag smp':>8} {'ms':>7} {'corr':>7}  polarity vs OH")
for k, (fn, band) in tracks.items():
    lag, val, _ = xcorr(sig[k], oh, maxlag, band)
    pol = "SAME" if val > 0 else "INVERTED"
    print(f"{k:12} {lag:8d} {lag/48:7.2f} {val:7.3f}  {pol}")

print("\n--- pairs ---")
for a, b, band in [("Kick In", "Kick Out", (40, 400)),
                   ("Snare Top", "Hi-Hats", (300, 3000)),
                   ("Tom 1", "Tom 2", (80, 800)),
                   ("Tom 2", "Floor Tom", (60, 600))]:
    lag, val, _ = xcorr(sig[a], sig[b], maxlag, band)
    print(f"{a} vs {b}: lag {lag} smp ({lag/48:.2f} ms), corr {val:.3f}, polarity {'SAME' if val>0 else 'INVERTED'}")

# OH L vs R sanity (which side is the hat?)
lagLR, vLR, _ = xcorr(ohL, ohR, maxlag, (200, 5000))
hh = bp(sig["Hi-Hats"], 3000, 8000)
cl = np.corrcoef(bp(ohL, 3000, 8000), hh)[0, 1]
cr = np.corrcoef(bp(ohR, 3000, 8000), hh)[0, 1]
print(f"\nOH L vs R lag {lagLR} smp corr {vLR:.3f}; hi-hat correlates with OH L {cl:.3f} / OH R {cr:.3f}")
