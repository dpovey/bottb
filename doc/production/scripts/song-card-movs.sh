#!/bin/bash
# Song-card PNGs (generate-song-overlays.ts) -> 5 s ProRes 4444 movies with the fades BAKED IN ALPHA.
# Recipe as used for Canvanauts/Amakazaam Sydney 2026 (runbook): 125 frames at 25 fps, alpha fade in 12 f,
# fade out 22 f, as time-based fades (st/d), the form the Canvanauts/Amakazaam cards used.
# Every movie is read back at full resolution at f0/6/12/60/110/124: want 0/128/255/255/175/12 (runbook; the Amakazaam
# cards read the same). Do not downscale before taking the max: scaler overshoot gave 136/143 depending on the artwork. Runs sequentially (~1.3 GB peak each at -threads 2).
# Never overwrites: an existing movie is only re-checked.
# Usage: song-card-movs.sh <overlays_dir> <out_dir> <prefix>     e.g. ... V2Voyagers/Overlays TitleCards/Sydney2026 v2voyagers_syd26
#   writes <out_dir>/<prefix>_<NN-song>_card.mov for every NN-*.png in <overlays_dir>
set -euo pipefail
src=$1; out=$2; prefix=$3
mkdir -p "$out"
alpha_at() {  # max alpha (8-bit) of frame $2 of movie $1
  ffmpeg -v error -i "$1" -vf "select=eq(n\,$2),alphaextract,format=gray" -frames:v 1 -f rawvideo - |
    python3 -c 'import sys; b=sys.stdin.buffer.read(); print(max(b) if b else -1)'
}
fail=0
for png in "$src"/[0-9][0-9]-*.png; do
  base=$(basename "$png" .png)
  mov="$out/${prefix}_${base}_card.mov"
  if [ ! -e "$mov" ]; then
    ffmpeg -v error -n -threads 2 -loop 1 -framerate 25 -i "$png" -frames:v 125 \
      -vf "format=rgba,fade=t=in:st=0:d=0.48:alpha=1,fade=t=out:st=4.12:d=0.88:alpha=1" \
      -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le -threads 2 "$mov"
  fi
  got=""; for f in 0 6 12 60 110 124; do got="$got$(alpha_at "$mov" $f)/"; done
  n=$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$mov" | grep . | head -n1)
  want="0/128/255/255/175/12/"   # runbook read-back; the known-good Amakazaam cards read the same
  ok=OK; { [ "$got" = "$want" ] && [ "$n" = 125 ]; } || { ok=FAIL; fail=1; }
  echo "$ok $mov frames=$n alpha=$got"
done
exit $fail
