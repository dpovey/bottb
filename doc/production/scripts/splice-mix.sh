#!/bin/zsh
# Put a late mix onto a finished render without re-rendering: one AAC generation.
#
#   splice-mix.sh <video.mp4> <mix.wav> <wav_offset_s> <out.mp4> [fade_len_s=0]
#
#   wav_offset_s = (render In frame - mix clip start frame on the timeline) / fps
#                  e.g. Everlong v14: (163546 - 163534) / 25 = 0.48
#   fade_len_s   > 0 fades the audio out over the last fade_len_s seconds of the video
#                  (Everlong's end card: 3.92)
#
# The video stream is copied, so its md5 must match the source's; this script checks that and
# runs render-qc's duration/tail checks afterwards. Why this exists and what it saves:
# video-post-learnings.md, "Why the late-mix splice exists, and its cost". Then put the same mix
# on the TIMELINE audio track too, or the next render off the timeline reverts it.
set -eu
SRC="$1"; W="$2"; OFF="$3"; OUT="$4"; FADE="${5:-0}"
[[ -f "$SRC" && -f "$W" ]] || { echo "usage: splice-mix.sh <video.mp4> <mix.wav> <wav_offset_s> <out.mp4> [fade_len_s]"; exit 2; }
[[ "$SRC" != "$OUT" ]] || { echo "refusing to overwrite the source"; exit 2; }

D=$(ffprobe -v error -select_streams v:0 -show_entries stream=duration -of csv=p=0 "$SRC")
AF="anull"
if [[ "$FADE" != "0" ]]; then
  ST=$(python3 -c "print(round(float('$D') - float('$FADE'), 3))")
  AF="afade=t=out:st=${ST}:d=${FADE}"
fi
ffmpeg -nostdin -v error -y -i "$SRC" -ss "$OFF" -t "$D" -i "$W" \
  -filter_complex "[1:a]${AF}[a]" -map 0:v -map "[a]" \
  -c:v copy -c:a aac -b:a 320k -movflags +faststart "$OUT"

vmd5() { ffmpeg -nostdin -v error -i "$1" -map 0:v -c copy -f md5 - ; }
if [[ "$(vmd5 "$SRC")" == "$(vmd5 "$OUT")" ]]; then echo "video stream md5 identical to source"
else echo "FAIL: video stream changed"; exit 1; fi
ffprobe -v error -show_entries stream=codec_type,duration -of csv=p=0 "$OUT"
echo "now run render-qc.sh on $OUT with the release range, and check true peak:"
echo "  ffmpeg -nostdin -hide_banner -i \"$OUT\" -vn -af ebur128=peak=true -f null - 2>&1 | tail -12"
