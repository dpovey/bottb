#!/bin/zsh
# Loop seam check and cover candidates for each reel. Usage: seam_and_frames.sh <key> <file> (from the project directory)
key=$1; f=$2; d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")
mkdir -p report/frames/$key
for i in 1 2 3 4 5 6 7 8 9 10; do t=$(python3 -c "print(round(5.5+($d-7)*($i-1)/9,2))"); ffmpeg -hide_banner -loglevel error -y -ss $t -i "$f" -frames:v 1 -vf "scale=324:-2" -q:v 3 report/frames/$key/c$i.jpg; done
# seam: last frame then first frames
ffmpeg -hide_banner -loglevel error -y -sseof -0.08 -i "$f" -frames:v 1 -vf scale=270:-2 report/frames/$key/last.jpg
ffmpeg -hide_banner -loglevel error -y -i "$f" -frames:v 1 -vf scale=270:-2 report/frames/$key/first.jpg
ffmpeg -hide_banner -loglevel error -y -ss 2.5 -i "$f" -frames:v 1 -vf scale=270:-2 report/frames/$key/logo.jpg
/Users/dean/src/personal/gigstills/.venv/bin/python - "$f" "$d" "$key" <<'PY'
import subprocess, sys, numpy as np
f, d, key = sys.argv[1], float(sys.argv[2]), sys.argv[3]
def pcm(ss, t):
    b = subprocess.run(["ffmpeg","-v","error","-ss",str(ss),"-t",str(t),"-i",f,"-ac","1","-ar","48000","-f","f32le","-"],capture_output=True).stdout
    return np.frombuffer(b, dtype=np.float32)
a, b = pcm(d-0.5, 0.5), pcm(0, 0.5)
db = lambda x: 20*np.log10(np.sqrt(np.mean(x**2))+1e-9)
tail, head = a[-2400:], b[:2400]
jump = abs(float(a[-1])-float(b[0])); typ = float(np.median(np.abs(np.diff(a))))
print(f"{key}: last 50 ms {db(tail):.1f} dB, first 50 ms {db(head):.1f} dB; first-sample {abs(b[0]):.4f}; seam jump {jump:.4f} vs typical sample step {typ:.4f}; last 0.5s {db(a):.1f} first 0.5s {db(b):.1f}")
PY
