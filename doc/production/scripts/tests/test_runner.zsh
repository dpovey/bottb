#!/bin/zsh
# Tests for resolve/runner.zsh, no Resolve needed: zsh doc/production/scripts/tests/test_runner.zsh
# Each case runs a small runner in a child zsh and checks its exit code and whether a later line ran.
H=${0:A:h}; R=$H/../resolve/runner.zsh; pass=0; fail=0
case_() {  # name, want_rc, want_after(yes|no), body
  local out rc; out=$(zsh -c "source '$R'; $4; echo AFTER" 2>&1); rc=$?
  local after=no; [[ "$out" == *AFTER* ]] && after=yes
  if [[ $rc == $2 && $after == $3 ]]; then pass=$((pass+1)); print "ok   $1"
  else fail=$((fail+1)); print "FAIL $1 (rc $rc want $2, after $after want $3)"; print -r -- "$out" | sed 's/^/     /'; fi
}
case_ "must passes on the pattern"            0 yes 'must "In/Out 1 2" echo "In/Out 1 2"'
case_ "must aborts on a missing pattern"      1 no  'must "In/Out 1 2" echo "In/Out 1 3"'
case_ "must aborts on ABORT text"             1 no  'must "page edit" print -l "ABORT: not mine" "page edit"'
case_ "must aborts on a non-zero exit"        1 no  'must "x" zsh -c "echo x; exit 3"'
case_ "must -s filters but still checks"      1 no  'must -s "^ok" "^PASS" print -l "ok a" "FAIL b" "PASS"'
case_ "must -s shows only matches"            0 yes 'must -s "^ok" "^PASS" print -l "ok a" "noise" "PASS"'
case_ "the YOK bug: must piped to tail"       1 no  'must "page edit" echo "ABORT: job a84992fe" | tail -1'
case_ "a failing pipeline stage aborts"       1 no  'false | cat'
case_ "ok aborts on non-zero (render-qc)"     1 no  'ok -s "VERDICT" zsh -c "echo VERDICT FAIL f; exit 1"'
case_ "ok passes on zero"                     0 yes 'ok -s "VERDICT" zsh -c "echo VERDICT PASS f"'
case_ "started_job reads the JOB id"          0 yes 'j=$(started_job "$(print -l "job x" "JOB abc123 range")"); [[ $j == abc123 ]]'
case_ "started_job aborts with no JOB"        1 no  'j=$(started_job "nothing"); echo got'
case_ "informational grep needs || true"      0 yes 'echo foo | grep bar || true'
case_ "Error inside a name is not an error"   0 yes 'must "PASS" print -l "ok output ErrorBudget_v1.mp4" "PASS 0 fails"'
case_ "an exception line is an error"         1 no  'must "PASS" print -l "ValueError: bad" "PASS"'
case_ "VERDICT FAIL is an error"              1 no  'must "VERDICT" echo "VERDICT FAIL x.mp4"'
case_ "0 fails is not FAIL"                   0 yes 'must "PASS" echo "PASS  0 fails, 2 warnings"'
case_ "big output with -q match (no SIGPIPE)" 0 yes 'must "^line 1$" seq -f "line %g" 1 200000'
# queue_render with a stubbed rr: RR_SEQ is the exit code of each render_range attempt in turn, Q_SEQ of each queue check
# (the second check is the one after the retry). Counter files keep the call number across the $(...) subshells.
STUB='CNT=$(mktemp); QCNT=$(mktemp); RUNNER_RETRY_WAIT=0
rr() { case $1 in
  *render_range.py) local n=$(( $(cat $CNT 2>/dev/null || echo 0) + 1 )); print $n > $CNT; print "attempt $n"
    local rc=${${(s:,:)RR_SEQ}[$n]:-0}; (( rc == 0 )) && print "JOB job$n"; (( rc == 3 )) && print "NOJOB x"
    (( rc == 1 )) && print "Traceback boom$n"; return $rc ;;
  *queue_empty.py) local n=$(( $(cat $QCNT 2>/dev/null || echo 0) + 1 )); print $n > $QCNT
    local rc=${${(s:,:)Q_SEQ}[$n]:-0}; (( rc == 0 )) && print "queue empty ${2:-}" || print "queue holds [ghost]"; return $rc ;;
esac }'
case_ "queue_render: first try works"         0 yes "$STUB; RR_SEQ=0 Q_SEQ=0; out=\$(queue_render 1 2); [[ \$(started_job \"\$out\") == job1 ]]"
case_ "queue_render: NOJOB, empty, retry ok"  0 yes "$STUB; RR_SEQ=3,0 Q_SEQ=0,0; out=\$(queue_render 1 2); [[ \$(started_job \"\$out\") == job2 ]]"
case_ "queue_render: NOJOB, job waiting"      1 no  "$STUB; RR_SEQ=3,0 Q_SEQ=1; out=\$(queue_render 1 2)"
case_ "queue_render: ghost job after retry"   1 no  "$STUB; RR_SEQ=3,0 Q_SEQ=0,1; out=\$(queue_render 1 2)"
case_ "queue_render: NOJOB twice aborts"      1 no  "$STUB; RR_SEQ=3,3 Q_SEQ=0; out=\$(queue_render 1 2)"
case_ "queue_render: other failure, no retry" 1 no  "$STUB; RR_SEQ=1,0 Q_SEQ=0; out=\$(queue_render 1 2)"
case_ "queue_render: retries at most once"    0 yes "$STUB; RR_SEQ=3,0 Q_SEQ=0,0; out=\$(queue_render 1 2); [[ \$(cat \$CNT) == 2 ]]"
case_ "queue_render: post-retry check skips the new job" 0 yes "$STUB; RR_SEQ=3,0 Q_SEQ=0,0; out=\$(queue_render 1 2 2>&1 >/dev/null); [[ \$out == *'queue empty job2'* ]]"
# an abort inside out=$(queue_render ...) must still show why (stderr is not captured by the substitution)
shown() {  # name, body, text that must appear in the run's output
  local o; o=$(zsh -c "source '$R'; $2" 2>&1)
  if [[ "$o" == *"$3"* ]]; then pass=$((pass+1)); print "ok   $1"; else fail=$((fail+1)); print "FAIL $1 (no '$3')"; print -r -- "$o" | sed 's/^/     /'; fi
}
shown "queue_render abort shows the traceback"  "$STUB; RR_SEQ=1 Q_SEQ=0; out=\$(queue_render 1 2)" "Traceback boom1"
shown "queue_render abort shows the queue list" "$STUB; RR_SEQ=3 Q_SEQ=1; out=\$(queue_render 1 2)" "queue holds [ghost]"
print "$pass passed, $fail failed"; exit $(( fail > 0 ))
