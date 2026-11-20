"""A small in-memory stand-in for DaVinciResolveScript, for testing resolve/*.py logic without Resolve.

Only the calls the tested scripts make are here, with the behaviour the runbook documents (absolute item frames, In/Out
relative to the timeline start, ClearClipColor, SetLUT/GetLUT per node). It proves script logic, not Resolve's behaviour:
anything that depends on how Resolve itself reacts still needs a live check. Build a project with `build(spec)`, which the
test harness writes to the module global PROJECT before running a script.
"""
PROJECT = None
RESOLVE = None


class NodeGraph:
    def __init__(self, luts): self.luts = list(luts)
    def GetNumNodes(self): return len(self.luts)
    def GetLUT(self, n): return self.luts[n - 1] if 1 <= n <= len(self.luts) else None
    def SetLUT(self, n, path): self.luts[n - 1] = path; return True


class Item:
    def __init__(self, start, end, name, color="", left=0, enabled=True, luts=(), media=None, props=None):
        self.start, self.end, self.name, self.color, self.left, self.enabled = start, end, name, color, left, enabled
        self.graph = NodeGraph(luts); self.media = media or name; self.props = dict(props or {})
    def GetStart(self): return self.start
    def GetEnd(self): return self.end
    def GetName(self): return self.name
    def GetLeftOffset(self): return self.left
    def GetClipEnabled(self): return self.enabled
    def GetClipColor(self): return self.color
    def ClearClipColor(self): self.color = ""; return True
    def SetClipColor(self, c): self.color = c; return True
    def GetNodeGraph(self): return self.graph
    def GetProperty(self, k): return self.props.get(k)
    def GetMediaPoolItem(self): return MediaPoolItem(self.media)
    def GetUniqueId(self): return "id-%s-%d" % (self.media, self.start)


class MediaPoolItem:
    def __init__(self, name): self.name = name
    def GetName(self): return self.name
    def GetMediaId(self): return "m-" + self.name
    def GetClipProperty(self, k=None): return {"File Path": "/media/" + self.name} if k is None else ("/media/" + self.name if k == "File Path" else "")


class Timeline:
    def __init__(self, name, start=0, video=(), audio=(), markers=None, inout=None):
        """video/audio: lists of (track name, enabled, [Item, ...])."""
        self.name, self.start = name, start
        self.tracks = {"video": [list(t) for t in video], "audio": [list(t) for t in audio]}
        self.markers = dict(markers or {}); self.inout = dict(inout or {})
    def GetName(self): return self.name
    def GetStartFrame(self): return self.start
    def GetSetting(self, k): return "25" if k == "timelineFrameRate" else ""
    def GetTrackCount(self, kind): return len(self.tracks[kind])
    def GetTrackName(self, kind, i): return self.tracks[kind][i - 1][0]
    def GetIsTrackEnabled(self, kind, i): return self.tracks[kind][i - 1][1]
    def GetItemListInTrack(self, kind, i): return list(self.tracks[kind][i - 1][2])
    def GetMarkers(self): return dict(self.markers)
    def GetMarkInOut(self): return {"video": dict(self.inout), "audio": dict(self.inout)} if self.inout else {}
    def SetMarkInOut(self, i, o, typ="all"): self.inout = {"in": i, "out": o}; return True


class Project:
    def __init__(self, timelines, current=0):
        self.timelines = timelines; self.cur = timelines[current]; self.jobs = []; self.settings = {}; self.saved = 0
    def GetCurrentTimeline(self): return self.cur
    def SetCurrentTimeline(self, tl): self.cur = tl; return True
    def GetTimelineCount(self): return len(self.timelines)
    def GetTimelineByIndex(self, i): return self.timelines[i - 1]
    def IsRenderingInProgress(self): return False
    def RefreshLUTList(self): return True
    def GetRenderJobList(self): return [dict(j) for j in self.jobs]
    def GetRenderJobStatus(self, jid): return {"JobStatus": next(j["status"] for j in self.jobs if j["JobId"] == jid)}
    def DeleteRenderJob(self, jid): n = len(self.jobs); self.jobs = [j for j in self.jobs if j["JobId"] != jid]; return len(self.jobs) < n
    def SetRenderSettings(self, s): self.settings.update(s); return True
    def AddRenderJob(self):
        jid = "probe%04d" % len(self.jobs); self.jobs.append({"JobId": jid, "OutputFilename": self.settings.get("CustomName", "") + ".mp4", "status": "Ready"}); return jid


class ProjectManager:
    def GetCurrentProject(self): return PROJECT
    def SaveProject(self): PROJECT.saved += 1; return True


class Resolve:
    page = "edit"
    def GetProjectManager(self): return ProjectManager()
    def GetCurrentPage(self): return self.page
    def OpenPage(self, p): self.page = p; return True


def scriptapp(name):
    assert name == "Resolve"
    return RESOLVE or Resolve()
