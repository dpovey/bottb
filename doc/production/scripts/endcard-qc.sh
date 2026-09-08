#!/bin/zsh
# QC a treated end-card master before it ships.
#
#   endcard-qc.sh <treated.mp4> [contact-sheet.png]
#
# Checks, in the order they have actually caught problems on this project:
#   1. stream durations (video vs audio) — a truncated audio export shipped once
#   2. decoded audio across the whole file, INCLUDING the region a bad 1080p
#      silently dropped (240-299s), plus the fade curve
#   3. a tail contact sheet so a human can confirm the card is an ADDITIVE
#      OVERLAY (picture fades under the logo), not a replacement
set -e
F="$1"; SHEET="${2:-${F%.mp4}.tail.png}"
[ -f "$F" ] || { echo "usage: endcard-qc.sh <treated.mp4>"; exit 1; }

echo "=== streams ==="
ffprobe -v error -show_entries stream=codec_type,width,height,duration,nb_frames -of csv=p=0 "$F"

V=$(ffprobe -v error -select_streams v:0 -show_entries stream=duration -of csv=p=0 "$F")
A=$(ffprobe -v error -select_streams a:0 -show_entries stream=duration -of csv=p=0 "$F")
python3 -c "
import sys
v,a=float('$V'),float('$A')
print('video %.3fs  audio %.3fs' % (v,a))
if abs(v-a)>0.5: sys.exit('FAIL: audio/video length mismatch')
print('duration check passed')"

echo "=== decoded audio (expect sound throughout, then the fade) ==="
fail=0
for t in 60 150 240 250 280 293 296 298; do
  out=$(ffmpeg -nostdin -hide_banner -ss $t -t 0.4 -i "$F" -af volumedetect -f null - 2>&1)
  n=$(echo "$out" | grep -o 'n_samples: [0-9]*' | tail -1 | cut -d' ' -f2)
  m=$(echo "$out" | grep -o 'mean_volume: [-0-9.]*' | tail -1 | cut -d' ' -f2)
  printf "  t=%-6s n_samples=%-8s mean=%s dB\n" "$t" "${n:-0}" "${m:-none}"
  # n_samples>0 alone is NOT enough: a digitally silent region decodes samples
  # that are all zero and would pass. Also require the level to be above -80 dB,
  # except inside the deliberate fade at the end.
  if [ "${n:-0}" -le 0 ]; then fail=1; continue; fi
  case "$t" in
    296|298|298.9) ;;   # inside the end-card fade, low level is correct
    *) python3 -c "
import sys
m='${m:-}'
if not m: sys.exit(1)
sys.exit(0 if float(m) > -80.0 else 1)" || { echo '    ^ SILENT (mean <= -80 dB) outside the fade'; fail=1; } ;;
  esac
done
[ $fail -eq 0 ] || { echo "FAIL: silent region found"; exit 1; }

echo "=== tail contact sheet ==="
ffmpeg -nostdin -v error -y -ss 294.9 -t 4.2 -i "$F" \
  -vf "select='not(mod(n\,10))',scale=320:-1,tile=6x2" -vsync vfr -frames:v 1 "$SHEET"
echo "  wrote $SHEET — LOOK AT IT. The logo must appear OVER the live picture,"
echo "  which then fades out beneath it. If the picture cuts to black the moment"
echo "  the logo appears, the card replaced the frame instead of overlaying it."
