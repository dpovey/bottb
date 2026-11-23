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
#                                         exits non-zero, prints error text ($RUNNER_ERR), or prints nothing matching <pattern>
#   ok [-s <show-regex>] <cmd> [args]     run cmd; print (filtered) output; ABORT the run if it exits non-zero
#   queue_render <render_range args>      run render_range.py and print its output. When AddRenderJob returned an id that isn't
#                                         in the queue (render_range exits 3, "NOJOB"), retry ONCE after $RUNNER_RETRY_WAIT s
#                                         (default 30), and only when queue_empty.py finds no job waiting (finished jobs don't
#                                         count); after the retry, no waiting job but the new one may remain (Drops of Jupiter,
#                                         2026-11-21). Any other failure, a waiting job or a second failure ABORTs.
#                                         Use as: out=$(queue_render <args>); jid=$(started_job "$out")
#   started_job <render_range output>     the JOB id it printed (ABORT if none). Clear it after QC with
#                                         `must "page edit" rr resolve/clear_jobs.py <id>...` (by id, not by name prefix)
#   abort <message>                       print ABORT and end the run
#
# Tests (no Resolve): zsh ../tests/test_runner.zsh. Template: ../runner-template.zsh.
# The global trap prints "RUNNER ABORT at line N" for any other failure, so a silent exit can't look like success.
# Wait on the render process id (wait_render.py), never a log string; this file doesn't change that.
setopt err_exit pipe_fail no_unset
RUNNER_DIR=${0:A:h}
# error text that fails a must: a traceback, HUNG/ABORT at a line start, the word FAIL anywhere (preflight's "FAIL  …",
# render-qc's "VERDICT FAIL"), or an exception name at a line start. A bare "Error" inside a name doesn't count.
RUNNER_ERR='^(Traceback|HUNG|ABORT)|(^|[^A-Za-z])FAIL([^A-Za-z]|$)|^[A-Za-z_.]*(Error|Exception):'

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
  if grep -q -E "$RUNNER_ERR" <<< "$out"; then abort "error text from: $*"; fi
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

queue_render() {  # stdout carries only a successful attempt's output (for started_job); diagnostics go to stderr, so an abort
                  # inside out=$(queue_render ...) still shows the traceback, NOJOB line and queue list
  local out rc=0 jid
  out=$(rr "$RUNNER_DIR/render_range.py" "$@" 2>&1) || rc=$?
  if (( rc == 0 )); then print -r -- "$out"; return 0; fi
  print -r -- "$out" >&2
  (( rc == 3 )) || abort "render_range failed (exit $rc): $*"
  print -r -- "render_range: the job id is not in the queue; checking no job is waiting before one retry" >&2
  must "^queue empty" rr "$RUNNER_DIR/queue_empty.py" >&2
  sleep ${RUNNER_RETRY_WAIT:-30}
  rc=0; out=$(rr "$RUNNER_DIR/render_range.py" "$@" 2>&1) || rc=$?
  if (( rc != 0 )); then print -r -- "$out" >&2; abort "render_range failed again after the retry (exit $rc): $*"; fi
  # If the first job turned up late it would sit unstarted next to the retry's: no waiting job may remain but the new one.
  jid=$(started_job "$out")
  must "^queue empty" rr "$RUNNER_DIR/queue_empty.py" "$jid" >&2
  print -r -- "$out"
  return 0
}
