#!/bin/zsh
# Upload the 2160x3840 reels to Blob and record their URLs. Run from the repo root.
R=~/src/personal/gigstills/runs/sydney26_reels/report/uhd
OUT=doc/production/reels-schedule/data/blob_uhd_2026-11-07.txt
one() { n=$(basename $1); u=$(node doc/production/scripts/blob-upload.mjs $1 release/reels-uhd/$n 2>&1 | grep '^BLOB_URL' | cut -d' ' -f2); echo "$n $(stat -f%z $1) ${u:-FAILED}" >> $OUT; }
for f in $R/Bandlassian*.mp4 $R/OffTheRecord*.mp4 $R/Epsonics_NoOne*.mp4 $R/TotalLoss*.mp4 $R/V2Voyagers*.mp4 $R/Amakazaam*.mp4 $R/Epsonics_TheChain*.mp4 $R/ShipReX_Everlong*.mp4 $R/Jumbo*.mp4; do
  one $f &
  while [ $(jobs -r | wc -l) -ge 3 ]; do wait -n 2>/dev/null || /bin/sleep 2; done
done
wait
echo finished $(grep -c FAILED $OUT) failed of $(wc -l < $OUT)
