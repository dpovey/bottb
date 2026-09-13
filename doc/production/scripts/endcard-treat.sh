#!/bin/zsh
# Apply the BoTTB end card to a finished song render, then QC it.
#
#   endcard-treat.sh <source.mp4> <output.mp4> [--4k]
#
# The card is an ADDITIVE OVERLAY, never a replacement: the picture fades out
# underneath the logo. Verified by eye on the tail contact sheet this writes.
#
# Gates run BEFORE the encode, because every bad master this project has seen
# would have passed a casual look:
#   * video duration ~= expected
#   * audio stream duration ~= video duration  (a 7 Sep 1080p had video 299.000s
#     and audio 243.285s — 56s of silent big finish)
#   * audio actually DECODES near the end (metadata alone is not proof)
#
# Runs the encode detached (nohup) so a lost session or a machine reboot does
# not leave a truncated file behind with no explanation. Memory: one ffmpeg,
# well under 1 GB; do not parallelise this on a 24 GB machine that also runs
# Resolve and Logic (see ~/.claude/CLAUDE.md).
set -e

SRC="$1"; OUT="$2"; shift 2 2>/dev/null || true
CARD="/Volumes/BOTTB/TitleCards/EndCard_2x.mov"
TOL=0.5
MODE=""
EXPECT=""       # optional: the length you believe the song is, for the truncation gate
FADE_START=""   # default: end of video minus the card's own length
FADE_DUR=""     # default: the card's measured duration

while [ $# -gt 0 ]; do
  case "$1" in
    --4k) MODE="--4k"; shift ;;
    --expect) EXPECT="$2"; shift 2 ;;
    --fade-start) FADE_START="$2"; shift 2 ;;
    --fade-dur) FADE_DUR="$2"; shift 2 ;;
    *) echo "unknown option $1"; exit 1 ;;
  esac
done

[ -n "$SRC" ] && [ -n "$OUT" ] || {
  echo "usage: endcard-treat.sh <source.mp4> <output.mp4> [--4k] [--expect S] [--fade-start S] [--fade-dur S]"
  exit 1; }
[ -f "$SRC" ] || { echo "STOP: no such source $SRC"; exit 1; }
[ -f "$CARD" ] || { echo "STOP: end card not found at $CARD"; exit 1; }

dur () { ffprobe -v error -select_streams "$1":0 -show_entries stream=duration -of csv=p=0 "$2"; }

V=$(dur v "$SRC"); A=$(dur a "$SRC")

# The card's own length sets the fade, so a card of a different length still
# lands its last frame on the last frame of the picture.
[ -n "$FADE_DUR" ] || FADE_DUR=$(dur v "$CARD")
[ -n "$FADE_START" ] || FADE_START=$(python3 -c "print(round(float('$V')-float('$FADE_DUR'),3))")

echo "source: video=${V}s audio=${A}s"
echo "card:   ${CARD} (${FADE_DUR}s), fade starts ${FADE_START}s"
python3 -c "
import sys
v,a=float('$V'),float('$A')
e='$EXPECT'
if e:
    if abs(v-float(e))>$TOL: sys.exit('STOP: video %.3fs, expected ~%.1fs' % (v,float(e)))
    if abs(a-float(e))>$TOL: sys.exit('STOP: audio %.3fs vs expected %.1fs — TRUNCATED EXPORT, do not ship' % (a,float(e)))
else:
    print('note: no --expect given, so the length gate is audio-vs-video only')
if abs(a-v)>$TOL: sys.exit('STOP: audio/video length mismatch %.3f vs %.3f — TRUNCATED EXPORT, do not ship' % (a,v))
print('duration gates passed')"

# Decoded tail: metadata can lie, a decoder cannot. Probe points scale with the
# song - fixed seconds only ever worked for the one song they were written for.
PROBES=($(python3 -c "
v=float('$V')
print(' '.join('%.1f' % (v*f) for f in (0.80, 0.94, 0.985)))"))
# Array, not a bare string: this script is zsh, which does NOT word-split an
# unquoted scalar, so `for t in $PROBES` iterated once over the whole list.
for t in "${PROBES[@]}"; do
  n=$(ffmpeg -nostdin -hide_banner -ss $t -t 0.4 -i "$SRC" -af volumedetect -f null - 2>&1 | grep -o 'n_samples: [0-9]*' | tail -1 | cut -d' ' -f2)
  echo "  source audio t=${t}s: n_samples=${n:-0}"
  [ "${n:-0}" -gt 0 ] || { echo "STOP: no audio decoded at ${t}s — silent tail"; exit 1; }
done

if [ "$MODE" = "--4k" ]; then
  CARD_CHAIN="scale=3840:2160:flags=lanczos,format=gbrp"
  VOPTS=(-c:v libx264 -preset fast -b:v 45M -maxrate 50M -bufsize 90M)
else
  CARD_CHAIN="format=gbrp"
  VOPTS=(-c:v libx264 -preset medium -b:v 12M -maxrate 14M -bufsize 24M)
fi

LOG="${OUT%.mp4}.ffmpeg.log"
echo "encoding (detached) -> $OUT   log: $LOG"
nohup ffmpeg -nostdin -v error -y -i "$SRC" -i "$CARD" -filter_complex \
"[0:v]fade=t=out:st=${FADE_START}:d=${FADE_DUR},format=gbrp[base];\
[1:v]${CARD_CHAIN},tpad=start_duration=${FADE_START}:color=black[card];\
[base][card]blend=all_mode=addition:shortest=0,format=yuv420p[v];\
[0:a]afade=t=out:st=${FADE_START}:d=${FADE_DUR}[a]" \
-map "[v]" -map "[a]" "${VOPTS[@]}" -c:a aac -b:a 320k -movflags +faststart "$OUT" > "$LOG" 2>&1 &
disown
echo "pid $! — poll until it exits, then run: endcard-treat.sh --qc $OUT"
