#!/bin/zsh
# Run a Resolve script file OUTSIDE the MCP bridge, with the atexit os._exit guard (no fusionscript segfault dialog)
# and a hang guard: if Resolve doesn't answer within $RR_TIMEOUT s (default 90) the run is killed and prints HUNG.
# A hang means Resolve itself is stuck (2026-10-30: after a 4K render it hung until Dean force-quit it) or is playing back.
# Usage: rr.sh <script.py> [args...]      e.g. rr.sh resolve/post_delivery.py "Starships"
export RESOLVE_SCRIPT_LIB="/Applications/DaVinci Resolve/DaVinci Resolve.app/Contents/Libraries/Fusion/fusionscript.so"
t=${RR_TIMEOUT:-90}
perl -e 'alarm shift; exec @ARGV' $t /usr/bin/python3 -c '
import atexit, os, sys
atexit.register(lambda: (sys.stdout.flush(), os._exit(0)))
sys.path.append("/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Scripting/Modules/")
f = sys.argv[1]; sys.argv = sys.argv[1:]
exec(compile(open(f).read(), f, "exec"))
' "$@"
rc=$?
(( rc == 142 )) && echo "HUNG: Resolve did not answer in ${t}s (playback, a dialog, or Resolve stuck). Edits made before the hang stand: go and look." >&2
exit $rc
