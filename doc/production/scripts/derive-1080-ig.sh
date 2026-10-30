#!/bin/zsh
# Make the 1080p and IG files from a finished 4K master, one AAC generation (audio is copied, never re-encoded).
# Settings proven on NOK (2026-10-06): Lanczos downscale, x264 slow, 12 Mb/s for 1080p. ~1.15 GB peak per encode.
# IG rate is computed from the duration (2026-10-30): a fixed 8 Mb/s overflowed the 300 MB IG cap on anything over ~4:50
# (V2 medley 5:29 → ~342 MB). Target IG_MB (default 285 MB incl. audio), capped at 8 Mb/s.
# The two encodes run in PARALLEL (-threads 6 each) when free+inactive memory ≥ 6 GB, else one after the other.
# Proven 2026-10-30 on the V2 medley: 4.5 / 5.7 min in parallel, both render-qc PASS, IG 274.5 MB.
# Usage: derive-1080-ig.sh <4K_master.mp4> <in_frame> <out_frame>
# Outputs next to the master: <name with 4K -> 1080p>.mp4 and <name with 4K -> 1080p_IG>.mp4. Never overwrites: QCs an existing file.
set -uo pipefail
src=$1; in=$2; out=$3
[[ $src == *_4K_* ]] || { echo "master name must contain _4K_" >&2; exit 2; }
here=${0:A:h}
dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$src" | grep . | head -1)
akbps=$(( $(ffprobe -v error -select_streams a:0 -show_entries stream=bit_rate -of csv=p=0 "$src" | grep . | head -1) / 1000 ))
zmodload zsh/mathfunc; igk=$(( int( ${IG_MB:-285} * 8000.0 / dur ) - akbps - 100 )); (( igk > 8000 )) && igk=8000
echo "duration ${dur}s audio ${akbps}k → IG video ${igk}k"
free_gb=$(vm_stat | awk '/Pages free|Pages inactive/{s+=$NF} END{printf "%d", s*16384/1e9}')
enc() {  # kind rate_k
  local kind=$1 rate=$2 dst=${src/_4K_/_${1}_} log
  if [[ -e $dst ]]; then
    echo "== $kind exists, not re-encoding; QC only: $dst"; ls -l "$dst"
    zsh "$here/render-qc.sh" "$dst" "$in" "$out" 25 | tail -5; return
  fi
  log=${TMPDIR:-/tmp}/${dst:t}.ffmpeg.log
  echo "== $kind -> $dst (${rate}k)"
  if ! /usr/bin/time -l ffmpeg -nostdin -v error -i "$src" -map 0:v:0 -map 0:a:0 \
    -vf scale=1920:1080:flags=lanczos -c:v libx264 -preset slow -b:v ${rate}k -maxrate ${rate}k -bufsize ${rate}k \
    -pix_fmt yuv420p -threads 6 -c:a copy -movflags +faststart "$dst" 2> "$log"; then
    echo "ffmpeg FAILED for $kind; log $log:" >&2; grep -v -E '^ +[0-9]+ +[a-z]' "$log" | tail -15 >&2; return 1
  fi
  grep -E 'real|peak memory footprint' "$log" || true
  ls -l "$dst"; zsh "$here/render-qc.sh" "$dst" "$in" "$out" 25 | tail -5
}
if (( free_gb >= 6 )); then
  echo "free+inactive ${free_gb} GB: parallel"
  t=${TMPDIR:-/tmp}/derive.$$; enc 1080p 12000 > $t.a 2>&1 & p1=$!; enc 1080p_IG $igk > $t.b 2>&1 & p2=$!
  wait $p1; r1=$?; wait $p2; r2=$?; cat $t.a $t.b; rm -f $t.a $t.b
else
  echo "free+inactive ${free_gb} GB: sequential"; enc 1080p 12000; r1=$?; enc 1080p_IG $igk; r2=$?
fi
ig=${src/_4K_/_1080p_IG_}; [[ -e $ig ]] && { b=$(stat -f %z "$ig"); echo "IG $b bytes = $((b/1000000)) MB / $((b/1048576)) MiB"; (( b < 300000000 )) || { echo "IG OVER 300 MB" >&2; exit 4; }; }
exit $(( r1 || r2 ))
