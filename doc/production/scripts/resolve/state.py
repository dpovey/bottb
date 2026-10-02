# READ-ONLY pre/post-flight report. Paste into run_script (sandboxed is fine; < 10 s).
# Edit IN/OUT to the song's range (record frames) or leave None to use the timeline In/Out.
# Every line it prints is a checklist item in video-post-learnings.md "Delivery render checklist".
IN, OUT = None, None
MAIN_TIMELINE = "BOTTB Brisbane 2026"
import DaVinciResolveScript as dvr
resolve = dvr.scriptapp("Resolve"); proj = resolve.GetProjectManager().GetCurrentProject()
if proj.IsRenderingInProgress():  # 21.1.1: every GetProperty/GetProperties read is empty during
    raise SystemExit("A render is in progress: clip property reads return nothing until it ends "
                     "(zoom counts would silently read 0). Wait on IsRenderingInProgress(), then rerun.")
tl = proj.GetCurrentTimeline()
def tc(f):
    f = int(f); return "%02d:%02d:%02d:%02d" % (f//90000, f//1500 % 60, f//25 % 60, f % 25)
name = tl.GetName()
print("timeline      %s%s" % (name, "" if name == MAIN_TIMELINE else
      "   <-- NOT the show timeline: a multicam opened in the timeline makes reads wrong and writes refused"))
print("page          %s" % resolve.GetCurrentPage())
print("resolution    %sx%s" % (tl.GetSetting("timelineResolutionWidth"), tl.GetSetting("timelineResolutionHeight")))
mio = tl.GetMarkInOut() or {}
v = mio.get("video", {})
print("In/Out        %s" % ("%s-%s  (%s-%s, %d frames)" % (v["in"], v["out"], tc(v["in"]), tc(v["out"]), v["out"]-v["in"]+1)
                            if "in" in v and "out" in v else "none"))
for f, m in sorted((tl.GetMarkers() or {}).items()):
    if str(m.get("name", "")).upper().startswith("RELEASE"):
        s = tl.GetStartFrame() + f
        print("RELEASE mark  %s dur %s  %s  -> implies %d-%d" % (tc(s), m.get("duration"), m.get("name"), s, s + int(m.get("duration", 1)) - 1))
lo = IN if IN is not None else v.get("in"); hi = OUT if OUT is not None else v.get("out")
# hasattr() is True for ANY name on a Resolve object (the attribute is None), so test callable().
# GetRenderSettings does not exist on 21.1/21.1.1; this prints None until it does.
f = getattr(proj, "GetRenderSettings", None); rs = f() if callable(f) else {}
print("render name   %r" % (rs.get("CustomName") if isinstance(rs, dict) else "?"))
print("rendering     %s" % proj.IsRenderingInProgress())
jobs = proj.GetRenderJobList() or []
st = {}
for j in jobs:
    s = (proj.GetRenderJobStatus(j["JobId"]) or {}).get("JobStatus", "?"); st[s] = st.get(s, 0) + 1
    if s != "Complete": print("  job %s %-40s %s" % (j["JobId"][:8], j.get("OutputFilename"), s))
print("render queue  %d jobs %s" % (len(jobs), st))
if lo is not None and hi is not None:
    cols = {}; dz = 0; zm = 0; kinds = {}
    for t in range(1, tl.GetTrackCount("video") + 1):
        for x in tl.GetItemListInTrack("video", t) or []:
            if x.GetEnd() <= lo or x.GetStart() > hi: continue
            c = x.GetClipColor() or "-"; cols[c] = cols.get(c, 0) + 1
            mp = x.GetMediaPoolItem(); k = mp.GetClipProperty("Type") if mp else "?"
            kinds[k] = kinds.get(k, 0) + 1
            if x.GetProperty("DynamicZoomEnabled"): dz += 1
            elif float(x.GetProperty("ZoomX") or 1) >= 1.3: zm += 1
    print("in range      clip colours %s" % cols)
    print("              item types %s  (Video = already RiP'd or plain; Multicam = live)" % kinds)
    print("              zoomed: %d dynamic + %d static >= 1.3" % (dz, zm))
