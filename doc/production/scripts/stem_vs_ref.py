import subprocess, numpy as np
from scipy.signal import correlate, butter, sosfiltfilt
SR=48000
def load(path,start,dur,pan="0.5*c0+0.5*c1"):
    cmd=["ffmpeg","-v","error","-ss",str(start),"-t",str(dur),"-i",path,"-af",f"pan=mono|c0={pan}","-f","f32le","-ac","1","-ar",str(SR),"-"]
    return np.frombuffer(subprocess.check_output(cmd),dtype=np.float32).astype(np.float64)
def bp(x,lo,hi): return sosfiltfilt(butter(4,[lo,hi],btype="band",fs=SR,output="sos"),x)
REF="/Volumes/BOTTB/Audio/BOTTB_reference_48k.wav"; W=2
def run(label,stem,T0,pts,pan="c0"):
    print(label)
    for st in pts:
        s=bp(load(stem,st,12,pan),300,3000); r=bp(load(REF,T0+st-W,12+2*W),300,3000); s/=np.std(s); r/=np.std(r)
        c=correlate(r,s,mode="valid"); k=int(np.argmax(np.abs(c)))-int(W*SR)
        print(f"  stem @{st:5d}s (show {T0+st:7.1f}): {k:+7d} smp = {k/48:+8.2f} ms (corr {c[int(np.argmax(np.abs(c)))]/len(s):+.2f})")
run("Epsonics Vox2 stem vs reference (file start 2823.692; video agent verified this region):",
    "/Volumes/Extreme SSD/bottb/events/2026/Brisbane/01_Media/Epsonics/15 Vox 2.wav",2823.692,(300,900,1500))
run("ShipRex Vox2 stem vs reference — Zoom1 region (before show 6542):",
    "/Volumes/Extreme SSD/bottb/events/2026/Brisbane/01_Media/The ShipRex/16 Vox 2 Lead.wav",5497.494,(300,600,900))
run("ShipRex Vox2 stem vs reference — Zoom2 region (S5):",
    "/Volumes/Extreme SSD/bottb/events/2026/Brisbane/01_Media/The ShipRex/16 Vox 2 Lead.wav",5497.494,(1100,1400,1550))
