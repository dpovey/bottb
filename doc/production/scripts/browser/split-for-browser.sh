#!/bin/zsh
# Split a video into browser-upload pieces for attach-pieces.js and print what the page should rebuild.
#   split-for-browser.sh <file> [outdir] [piece_mb=45]
# outdir defaults to a new folder in $TMPDIR (use the session scratchpad: preview uploads take paths the session may read).
# Prints each piece path in upload order, the file's sha256, and a check that the pieces join back to the same hash.
# Exit 1 if they don't. Delete the outdir after the attach.
set -eu -o pipefail
F=${1:?usage: split-for-browser.sh <file> [outdir] [piece_mb=45]}
OUT=${2:-$(mktemp -d "${TMPDIR:-/tmp}/pieces.XXXXXX")}; MB=${3:-45}
[[ -f "$F" ]] || { print -u2 "no such file: $F"; exit 2; }
mkdir -p "$OUT"
[[ -z "$(ls -A "$OUT")" ]] || { print -u2 "outdir not empty: $OUT"; exit 2; }
split -b "${MB}m" "$F" "$OUT/part_"
SHA=$(shasum -a 256 "$F" | cut -d' ' -f1)
JOIN=$(cat "$OUT"/part_* | shasum -a 256 | cut -d' ' -f1)
print "pieces (upload in this order):"; ls -1 "$OUT"/part_* | sed 's/^/  /'
print "count $(ls -1 "$OUT"/part_* | wc -l | tr -d ' ')  bytes $(stat -f %z "$F")"
print "rebuild: await bottbAttach.rebuild('${F:t}', '$SHA')"
if [[ "$JOIN" == "$SHA" ]]; then print "JOIN OK $SHA"; else print "JOIN FAIL $JOIN != $SHA"; exit 1; fi
