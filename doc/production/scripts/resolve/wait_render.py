# Wait for a Resolve render job from OUTSIDE the MCP bridge, so a long render needs no polling calls.
# Usage (run in the background; it exits when the render stops, or when Resolve stops answering):
#   RESOLVE_SCRIPT_LIB="/Applications/DaVinci Resolve/DaVinci Resolve.app/Contents/Libraries/Fusion/fusionscript.so" \
#     python3 wait_render.py <job_id> [poll_s] [hang_s]
# Prints "DONE {JobStatus...}". Waits on IsRenderingInProgress(), never on the file (runbook rule).
# A status of "Cancelled" can be Dean pressing Stop: ask before re-queuing. Proven on Jamazon 2026-10-04/05
# (42.5 min look-on render, 45.7 min 4K delivery).
# Hang guard (2026-10-30): on the V2 medley Resolve hung after writing the 4K file and this waiter sat inside a call for
# 75 min. Now any call that takes longer than hang_s (default 300) prints "HUNG ..." and exits 3, so the background
# notification fires; then QC the file from disk (ffprobe duration + render-qc) and tell Dean Resolve is stuck.
import os, sys, time, threading
sys.path.append("/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Scripting/Modules/")
os.environ.setdefault("RESOLVE_SCRIPT_LIB", "/Applications/DaVinci Resolve/DaVinci Resolve.app/Contents/Libraries/Fusion/fusionscript.so")
import DaVinciResolveScript as dvr
jid = sys.argv[1]; poll = float(sys.argv[2]) if len(sys.argv) > 2 else 30; hang = float(sys.argv[3]) if len(sys.argv) > 3 else 300
state = {"t": time.time(), "last": None}
def watchdog():
    while True:
        time.sleep(10)
        if time.time() - state["t"] > hang:
            print("HUNG: Resolve has not answered for %d s; last status %s" % (hang, state["last"]), flush=True); os._exit(3)
threading.Thread(target=watchdog, daemon=True).start()
p = dvr.scriptapp("Resolve").GetProjectManager().GetCurrentProject(); state["t"] = time.time()
while p.IsRenderingInProgress():
    state["t"] = time.time(); state["last"] = p.GetRenderJobStatus(jid); state["t"] = time.time()
    time.sleep(poll); state["t"] = time.time()
print("DONE", p.GetRenderJobStatus(jid), flush=True); os._exit(0)
