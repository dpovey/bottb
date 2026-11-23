# READ-ONLY: exit 0 and print "queue empty" only when the render queue holds no job; otherwise list them and exit 1.
# Used by runner.zsh's queue_render before its one retry. Usage: rr.sh resolve/queue_empty.py
import sys, DaVinciResolveScript as dvr
j = dvr.scriptapp("Resolve").GetProjectManager().GetCurrentProject().GetRenderJobList() or []
print("queue empty" if not j else "queue holds %s" % [(x["JobId"][:8], x.get("OutputFilename")) for x in j]); sys.exit(0 if not j else 1)
