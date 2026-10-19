#!/bin/zsh
# Make the 1080p and IG files from a finished 4K master, one AAC generation (audio is copied, never re-encoded).
# Settings proven on NOK (2026-10-06): Lanczos downscale, x264 slow, 12 Mb/s (1080p) / 8 Mb/s (IG), -threads 4 ≈ 1 GB peak,
# ~5 min each. Runs the two encodes one after the other (one heavy job at a time), then render-qc on each.
# Usage: derive-1080-ig.sh <4K_master.mp4> <in_frame> <out_frame>
#   e.g. derive-1080-ig.sh /Volumes/BOTTB/Renders/BOTTB_Jumbo_SayItAintSo_4K_v1.mp4 222764 228668
# Outputs next to the master: <name with 4K -> 1080p>.mp4 and <name with 4K -> 1080p_IG>.mp4. IG must stay < 300 MB.
set -euo pipefail
src=$1; in=$2; out=$3
[[ $src == *_4K_* ]] || { echo "master name must contain _4K_" >&2; exit 2; }
here=${0:A:h}
for kind in 1080p 1080p_IG; do
  dst=${src/_4K_/_${kind}_}
  if [[ -e $dst ]]; then  # never overwrite; QC what is there (a run killed by a drive dropping left a finished file)
    echo "== $kind exists, not re-encoding; QC only: $dst"; ls -l "$dst"
    zsh "$here/render-qc.sh" "$dst" "$in" "$out" 25 | tail -5 && continue
    echo "existing $dst FAILS QC (e.g. 'moov atom not found' = truncated when a drive dropped): move it aside and re-run" >&2; exit 3
  fi
  rate=12M; [[ $kind == 1080p_IG ]] && rate=8M
  echo "== $kind -> $dst ($rate)"
  # stderr (ffmpeg errors + time -l) goes to a log; a grep pipe here once hid the error that killed an encode.
  log=${TMPDIR:-/tmp}/${dst:t}.ffmpeg.log
  if ! /usr/bin/time -l ffmpeg -nostdin -v error -i "$src" -map 0:v:0 -map 0:a:0 \
    -vf scale=1920:1080:flags=lanczos -c:v libx264 -preset slow -b:v $rate -maxrate $rate -bufsize ${rate%M}M \
    -pix_fmt yuv420p -threads 4 -c:a copy -movflags +faststart "$dst" 2> "$log"; then
    echo "ffmpeg FAILED for $kind; log $log:" >&2; grep -v -E '^ +[0-9]+ +[a-z]' "$log" | tail -15 >&2; exit 1
  fi
  grep -E 'real|peak memory footprint' "$log" || true
  ls -l "$dst"
  zsh "$here/render-qc.sh" "$dst" "$in" "$out" 25 | tail -5
done
