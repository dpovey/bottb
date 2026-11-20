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
case_ "big output with -q match (no SIGPIPE)" 0 yes 'must "^line 1$" seq -f "line %g" 1 200000'
print "$pass passed, $fail failed"; exit $(( fail > 0 ))
