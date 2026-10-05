# Wait for a Resolve render job from OUTSIDE the MCP bridge, so a long render needs no polling calls.
# Usage (run in the background; it exits when the render stops):
#   RESOLVE_SCRIPT_LIB="/Applications/DaVinci Resolve/DaVinci Resolve.app/Contents/Libraries/Fusion/fusionscript.so" \
#     python3 wait_render.py <job_id> [poll_s]
# Prints "DONE {JobStatus...}". Waits on IsRenderingInProgress(), never on the file (runbook rule).
# A status of "Cancelled" can be Dean pressing Stop: ask before re-queuing. Proven on Jamazon 2026-10-04/05
# (42.5 min look-on render, 45.7 min 4K delivery).
import os, sys, time
sys.path.append("/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Scripting/Modules/")
os.environ.setdefault("RESOLVE_SCRIPT_LIB", "/Applications/DaVinci Resolve/DaVinci Resolve.app/Contents/Libraries/Fusion/fusionscript.so")
import DaVinciResolveScript as dvr
jid = sys.argv[1]; poll = float(sys.argv[2]) if len(sys.argv) > 2 else 30
p = dvr.scriptapp("Resolve").GetProjectManager().GetCurrentProject()
while p.IsRenderingInProgress():
    time.sleep(poll)
print("DONE", p.GetRenderJobStatus(jid), flush=True)
