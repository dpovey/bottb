#!/bin/zsh
# Template for a release delivery runner on resolve/runner.zsh (fails closed). Copy into the release's video/scripts/,
# fill in the CHANGE lines, and read it top to bottom before running. Based on You Oughta Know's deliver_4k.sh (2026-11-20),
# rewritten so no check sits inside a pipe. Not run end to end against Resolve as a template: first use is a live check.
# Usage: deliver.zsh <mix.wav>
source ${0:A:h}/resolve/runner.zsh            # CHANGE if the copy lives elsewhere: source ~/src/personal/bottb/doc/production/scripts/resolve/runner.zsh
S=${RUNNER_DIR:h}; cd $S
WAV=${1:A}                                     # absolute: the runner cds to the scripts folder
SONG="Band - Song"                             # CHANGE: RELEASE marker substring
IN=0; OUT=0; MIX0=0                            # CHANGE: song range and the mix item's start frame
D=/Volumes/BOTTB/Renders; PRE=Band_Song_4K_v1_prefade; FIN=$D/Band_Song_4K_v1.mp4   # CHANGE
(( IN > 0 && OUT > IN )) || abort "fill in IN/OUT"
for f in $D/$PRE.mp4 $FIN; do [[ ! -e $f ]] || abort "exists $f"; done

print "=== $(date +%T) state"; df -g /Volumes/BOTTB | tail -1
must -s "In/Out" "In/Out $IN $OUT" rr resolve/release_inout.py restore "$SONG"
print "=== $(date +%T) preflight"; mkdir -p $D/checks/preflight_deliver
RRT=600 must -s "^(ok|FAIL|WARN|PASS)" "^PASS" rr resolve/preflight.py $IN $OUT $D/checks/preflight_deliver --flc
print "=== $(date +%T) render"
out=$(rr resolve/render_range.py $IN $OUT $D $PRE mp4 H264 1 3840 45000 2>&1) || { print -r -- "$out"; abort "render_range failed"; }
print -r -- "$out"
jid=$(started_job "$out")
must -s "DONE|HUNG|real" "^DONE .*'JobStatus': 'Complete'" /usr/bin/time -l /usr/bin/python3 resolve/wait_render.py $jid 30 900   # DONE prints for Failed/Cancelled too
must "page edit" rr resolve/clear_jobs.py $jid
must -s "In/Out" "In/Out $IN $OUT" rr resolve/release_inout.py restore "$SONG"
print "=== $(date +%T) QC prefade"; ok -s "OK|FAIL|VERDICT" zsh render-qc.sh $D/$PRE.mp4 $IN $OUT 25 40
OFF=$(python3 -c "print(($IN-$MIX0)/25)")
print "=== $(date +%T) splice fade"; ok zsh splice-mix.sh $D/$PRE.mp4 "$WAV" $OFF $FIN 3.92
print "=== $(date +%T) QC final"; ok -s "OK|FAIL|VERDICT" zsh render-qc.sh $FIN $IN $OUT 25 40
ok ./render-verify $FIN --expect frames=$(( OUT - IN + 1 ))
print "=== $(date +%T) DELIVER DONE"
