# Shared helpers for release render runners (measure, paired, verify, deliver). Source it, don't run it:
#   source ~/src/personal/bottb/doc/production/scripts/resolve/runner.zsh
#
# It makes the runner FAIL CLOSED (You Oughta Know, 2026-11-20: `must … | tail -1` printed ABORT and the run went on,
# because `exit` inside a pipeline only ends that pipeline's subshell; the job stayed queued):
#   - err_exit + pipe_fail: any failing command, including a failure anywhere in a pipeline, ends the run.
#   - must/ok never need a pipe: they filter what they print themselves, so their `exit 1` runs in the main shell. Inside
#     they read output from here-strings, so a `grep -q` can't SIGPIPE a pipeline under pipe_fail.
#   - An informational command that may legitimately fail (a grep with no match) needs `|| true`, said out loud.
#
#   rr <script.py> [args]                 rr.sh with RR_TIMEOUT=${RRT:-120}; exit code propagates (rr.sh, 2026-11-05)
#   must [-s <show-regex>] <pattern> <cmd> [args]
#                                         run cmd; print its output (only lines matching -s, if given); ABORT the run if it
#                                         exits non-zero, prints Traceback/Error/HUNG/FAIL/ABORT, or prints nothing matching <pattern>
#   ok [-s <show-regex>] <cmd> [args]     run cmd; print (filtered) output; ABORT the run if it exits non-zero
#   started_job <render_range output>     the JOB id it printed (ABORT if none). Clear it after QC with
#                                         `must "page edit" rr resolve/clear_jobs.py <id>...` (by id, not by name prefix)
#   abort <message>                       print ABORT and end the run
#
# Tests (no Resolve): zsh ../tests/test_runner.zsh. Template: ../runner-template.zsh.
# The global trap prints "RUNNER ABORT at line N" for any other failure, so a silent exit can't look like success.
# Wait on the render process id (wait_render.py), never a log string; this file doesn't change that.
setopt err_exit pipe_fail no_unset
RUNNER_DIR=${0:A:h}
export RESOLVE_SCRIPT_LIB="/Applications/DaVinci Resolve/DaVinci Resolve.app/Contents/Libraries/Fusion/fusionscript.so"
TRAPZERR() { print -r -- "RUNNER ABORT: a command failed (exit $?) near line ${funcfiletrace[1]:-?}" >&2; }

abort() { print -r -- "ABORT: $*" >&2; exit 1; }

rr() { RR_TIMEOUT=${RRT:-120} "$RUNNER_DIR/rr.sh" "$@"; }

_runner_show() {  # print captured output, filtered by an optional regex; never fails
  local show=$1 out=$2
  if [[ -n "$show" ]]; then grep -E -- "$show" <<< "$out" || true
  else print -r -- "$out"; fi
}

must() {
  local show=""; [[ "${1:-}" == "-s" ]] && { show=$2; shift 2; }
  local pat=$1; shift
  local out rc=0
  out=$("$@" 2>&1) || rc=$?
  _runner_show "$show" "$out"
  if (( rc != 0 )); then abort "exit $rc from: $*"; fi
  if grep -q -E "Traceback|Error|HUNG|FAIL|ABORT" <<< "$out"; then abort "error text from: $*"; fi
  if ! grep -q -E -- "$pat" <<< "$out"; then abort "expected /$pat/ from: $*"; fi
  return 0
}

ok() {
  local show=""; [[ "${1:-}" == "-s" ]] && { show=$2; shift 2; }
  local out rc=0
  out=$("$@" 2>&1) || rc=$?
  _runner_show "$show" "$out"
  (( rc == 0 )) || abort "exit $rc from: $*"
  return 0
}

started_job() {
  local jid; jid=$(awk '/^JOB/ {print $2; exit}' <<< "$1")
  [[ -n "$jid" ]] || abort "render_range printed no JOB id"
  print -r -- "$jid"
}
