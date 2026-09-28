#!/bin/zsh
# QC a delivery render against the range it was rendered from.
#
#   render-qc.sh <render.mp4> <in_frame> <out_frame> [fps=25] [min_mbps]
#
# The checks in video-post-learnings.md, "Delivery render checklist → Render":
#   1. video frame count == out - in + 1          (a stale range rendered the wrong frames)
#   2. AUDIO STREAM duration vs video within 0.2 s (a 1080p once shipped 56 s short)
#   3. the last 5 s of audio DECODE and are not silent, sampled in 1 s windows
#   4. achieved video bitrate (and >= min_mbps if given)
# Exit 0 only if every check passes. Prints a one-line verdict last.
#
# Two instrument traps this avoids, both of which reported good masters as broken:
#   * volumedetect prints at INFO level — never run it under `-v error`.
#   * zsh does not word-split unquoted scalars — every expansion here is quoted.
#
# Cheap: ffprobe plus a few 1 s audio decodes. Memory is tens of MB.
set -u
F="${1:-}"; IN="${2:-}"; OUT="${3:-}"; FPS="${4:-25}"; MIN_MBPS="${5:-0}"
if [[ -z "$F" || -z "$IN" || -z "$OUT" || ! -f "$F" ]]; then
  echo "usage: render-qc.sh <render.mp4> <in_frame> <out_frame> [fps=25] [min_mbps]"; exit 2
fi
fail=0
note() { print -r -- "$*"; }

# 1. frames — count packets, which is exact and needs no decode
N=$(ffprobe -v error -select_streams v:0 -count_packets -show_entries stream=nb_read_packets -of csv=p=0 "$F")
WANT=$(( OUT - IN + 1 ))
if [[ "$N" == "$WANT" ]]; then note "frames   OK   $N (= $OUT - $IN + 1)"
else note "frames   FAIL $N, expected $WANT"; fail=1; fi

# 2. stream durations
V=$(ffprobe -v error -select_streams v:0 -show_entries stream=duration -of csv=p=0 "$F")
A=$(ffprobe -v error -select_streams a:0 -show_entries stream=duration -of csv=p=0 "$F")
if [[ -z "$A" ]]; then note "audio    FAIL no audio stream"; fail=1
else
  if python3 -c "import sys; sys.exit(0 if abs(float('$V')-float('$A'))<=0.2 else 1)"; then
    note "durations OK  video ${V}s audio ${A}s"
  else note "durations FAIL video ${V}s audio ${A}s (> 0.2 s apart)"; fail=1; fi

  # 3. tail audio: five 1 s windows ending at the video end
  tail_ok=1; levels=()
  for k in 5 4 3 2 1; do
    t=$(python3 -c "print(max(0.0, float('$V') - $k))")
    out=$(ffmpeg -nostdin -hide_banner -ss "$t" -t 1 -i "$F" -vn -af volumedetect -f null - 2>&1)
    n=$(print -r -- "$out" | grep -o 'n_samples: [0-9]*' | tail -1 | cut -d' ' -f2)
    m=$(print -r -- "$out" | grep -o 'mean_volume: [-0-9.inf]*' | tail -1 | cut -d' ' -f2)
    levels+=("${m:-none}")
    [[ "${n:-0}" -gt 0 ]] || tail_ok=0
  done
  # at least one window above -70 dB: an end-card fade may take the last second down,
  # but five seconds of digital silence is a truncated or zeroed mix
  loud=$(python3 -c "
import sys
v=[x for x in sys.argv[1:] if x not in ('none','-inf')]
print(1 if any(float(x)>-70 for x in v) else 0)" "${levels[@]}")
  if [[ $tail_ok == 1 && $loud == 1 ]]; then note "tail     OK   last 5 s mean dB: ${levels[*]}"
  else note "tail     FAIL last 5 s mean dB: ${levels[*]}"; fail=1; fi
fi

# 4. bitrate
BR=$(ffprobe -v error -select_streams v:0 -show_entries stream=bit_rate -of csv=p=0 "$F")
MB=$(python3 -c "print(round(int('${BR:-0}' or 0)/1e6,1))")
if python3 -c "import sys; sys.exit(0 if float('$MB')>=float('$MIN_MBPS') else 1)"; then
  note "bitrate  OK   ${MB} Mb/s"
else note "bitrate  FAIL ${MB} Mb/s < ${MIN_MBPS}"; fail=1; fi

if [[ $fail == 0 ]]; then note "VERDICT PASS $F"; else note "VERDICT FAIL $F"; fi
exit $fail
