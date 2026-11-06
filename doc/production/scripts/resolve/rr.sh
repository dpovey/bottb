#!/bin/zsh
# Run a Resolve script file OUTSIDE the MCP bridge, with the atexit os._exit guard (no fusionscript segfault dialog)
# Propagates the script's exit code (1 on an exception, SystemExit's code) since 2026-11-05; before that it always exited 0.
# and a hang guard: if Resolve doesn't answer within $RR_TIMEOUT s (default 90) the run is killed and prints HUNG.
# A hang means Resolve itself is stuck (2026-10-30: after a 4K render it hung until Dean force-quit it) or is playing back.
# Usage: rr.sh <script.py> [args...]      e.g. rr.sh resolve/post_delivery.py "Starships"
export RESOLVE_SCRIPT_LIB="/Applications/DaVinci Resolve/DaVinci Resolve.app/Contents/Libraries/Fusion/fusionscript.so"
t=${RR_TIMEOUT:-90}
perl -e 'alarm shift; exec @ARGV' $t /usr/bin/python3 -c '
import atexit, os, sys, traceback
rc = [0]  # the real exit code: os._exit skips interpreter teardown (fusionscript segfault) but must not hide a failure (2026-11-05)
atexit.register(lambda: (sys.stdout.flush(), sys.stderr.flush(), os._exit(rc[0])))
sys.path.append("/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Scripting/Modules/")
f = sys.argv[1]; sys.argv = sys.argv[1:]
try:
    exec(compile(open(f).read(), f, "exec"))
except SystemExit as e:
    if e.code not in (None, 0):
        if not isinstance(e.code, int): print(e.code, file=sys.stderr)
        rc[0] = e.code if isinstance(e.code, int) else 1
except BaseException:
    traceback.print_exc(); rc[0] = 1
' "$@"
rc=$?
(( rc == 142 )) && echo "HUNG: Resolve did not answer in ${t}s (playback, a dialog, or Resolve stuck). Edits made before the hang stand: go and look." >&2
exit $rc
