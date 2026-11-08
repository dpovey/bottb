# Pixel checks on frames exported by Timeline/TimelineItem.ExportFrame, and the layer helpers the frame tools share.
# Stdlib + ffmpeg only, because rr.sh runs the system Python. Import with:
#   sys.path.insert(0, os.path.dirname(os.path.abspath(sys.argv[0]))); import pix
# What each export shows (measured 2026-11-06, ~/src/personal/resolve-21.2-upgrade/notes/findings.md):
#   Timeline.ExportFrame     = the render, within 1 level of a 16-bit TIFF render. Reference frame, not a codec check.
#   TimelineItem.ExportFrame = the look-off picture: clip grade, group Pre-Clip, sizing and timeline nodes, no fades, no tracks above.
#   Proved on a plain clip under the real look. Not yet proved on a live multicam clip or a RiP'd clip with media online: run calibrate_frames.py once with the disks.
#   Both return success on offline media (a graded "Media Offline" slate) and None during a render, so check pixels and check for a render.
import collections, os, subprocess

def _raw(path, w, h, fmt):
    return subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf", "scale=%d:%d,format=%s" % (w, h, fmt), "-frames:v", "1", "-f", "rawvideo", "-"],
                          capture_output=True, check=True).stdout

def bands(path):  # same test as edge_scan.py: full-height or full-width bands of exact black at 480x270 (L, R, T, B in px)
    F = _raw(path, 480, 270, "gray")
    col = [max(F[y * 480 + x] for y in range(270)) for x in range(480)]
    row = [max(F[y * 480:(y + 1) * 480]) for y in range(270)]
    first = lambda v: next((i for i, c in enumerate(v) if c > 2), len(v))
    return first(col), first(col[::-1]), first(row), first(row[::-1])

def banded(b):
    return max(b[0], b[1]) >= 10 or max(b[2], b[3]) >= 8

def level(path):  # mean luma 0-255
    F = _raw(path, 96, 54, "gray"); return sum(F) / len(F)

def diff(a, b):  # mean |luma difference|, 0-255, at 96x54 (Y only, and a hue-only change barely moves it: use rgb_diff for a look)
    A, B = _raw(a, 96, 54, "gray"), _raw(b, 96, 54, "gray")
    return sum(abs(x - y) for x, y in zip(A, B)) / len(A)

def rgb_diff(a, b):  # mean |channel difference|, 0-255, at 96x54
    A, B = _raw(a, 96, 54, "rgb24"), _raw(b, 96, 54, "rgb24")
    return sum(abs(x - y) for x, y in zip(A, B)) / len(A)

def kind(path):  # black | offline | flat | picture. The slate is one dark red with pink text, and the grade above moves the red, so test its shape.
    F = _raw(path, 64, 36, "rgb24"); px = [F[i:i + 3] for i in range(0, len(F), 3)]
    (mode, n), = collections.Counter(bytes(c // 8 for c in p) for p in px).most_common(1)
    r, g, b = [c * 8 for c in mode]; share = n / len(px)
    if sum(F) / len(F) < 4: return "black"
    if share >= .55 and r >= 32 and r >= 2 * max(g, b): return "offline"
    return "flat" if share >= .9 else "picture"

def rendering(p):
    if p.IsRenderingInProgress(): raise SystemExit("A render is in progress: ExportFrame returns None and property reads are empty. Wait for it, then rerun.")

def writable(p, tl):  # a write mid-render leaves the output unknown, and a multicam open in the timeline takes the edit
    rendering(p)
    if "multicam" in tl.GetName().lower(): raise SystemExit("A multicam is open in the timeline (%s): go back to the show timeline." % tl.GetName())

def export(src, offset, path, **opts):  # src = a timeline or an item. The result, or None on a failed export; removes any old file so it can't pass as this frame
    if os.path.exists(path): os.remove(path)
    x = src.ExportFrame(offset, dict(opts, outputType="file", filePath=path))
    return x if x and x.get("success") and os.path.exists(path) else None

def look_item(tl, rec):  # the Adjustment Clip over rec, on any track (the look has moved between tracks, and one song's can differ), or None
    for t in range(1, tl.GetTrackCount("video") + 1):
        for i in tl.GetItemListInTrack("video", t) or []:
            if i.GetName() == "Adjustment Clip" and i.GetStart() <= rec < i.GetEnd(): return i

def look_track(tl, rec):
    i = look_item(tl, rec); return i.GetTrackTypeAndIndex()[1] if i else None

def picture_item(tl, rec):  # the top clip the viewer sees at rec under the look (a gigsteady overlay beats V1)
    top = look_track(tl, rec) or tl.GetTrackCount("video") + 1
    for t in range(top - 1, 0, -1):
        if not tl.GetIsTrackEnabled("video", t): continue
        for i in tl.GetItemListInTrack("video", t) or []:
            if i.GetStart() <= rec < i.GetEnd() and i.GetClipEnabled(): return i

def v1_cuts(tl, lo, hi):
    return [i for i in tl.GetItemListInTrack("video", 1) or [] if i.GetEnd() > lo and i.GetStart() <= hi]

def src_type(i):
    m = i.GetMediaPoolItem(); return m.GetClipProperty("Type") if m else None

def camera(i):  # a colour group's name, or for a live multicam clip (which reads no group) its angle from the item name
    g = i.GetColorGroup(); return g.GetName() if g else i.GetName().split(" Render ")[0]

def tc(f):
    f = int(f); return "%02d:%02d:%02d:%02d" % (f // 90000, f // 1500 % 60, f // 25 % 60, f % 25)



def marker_range(f, m, st):
    """(IN, OUT) a RELEASE marker records, absolute record frames. The name wins when it carries the range, because a chapter
    marker can hold the In frame and push the RELEASE marker to In+1 (No One Knows, Say It Ain't So): "(In 76611, Out 82928)",
    or a "HH:MM:SS:FF - HH:MM:SS:FF" range in the name or the note (Everlong, Covered in Chrome). Else start .. start+duration-1.
    Timecodes are read at 25 fps, like tc(): every BotTB show timeline is 25p. state.py keeps an inline copy of this rule."""
    import re
    IN, OUT = st + int(f), st + int(f) + int(m.get("duration", 1)) - 1
    fr = re.search(r"\(In (\d+), Out (\d+)\)", m["name"])
    tcs = re.findall(r"(\d\d):(\d\d):(\d\d):(\d\d)\s*-\s*(\d\d):(\d\d):(\d\d):(\d\d)", m["name"] + " " + (m.get("note") or ""))
    if fr: return int(fr.group(1)), int(fr.group(2))
    if tcs:
        x = list(map(int, tcs[0])); return ((x[0] * 60 + x[1]) * 60 + x[2]) * 25 + x[3], ((x[4] * 60 + x[5]) * 60 + x[6]) * 25 + x[7]
    return IN, OUT


def release_range(tl, key):
    """(IN, OUT, name) from the one Cyan "RELEASE: ..." marker whose name contains key (case-insensitive). 25p timelines only."""
    fps = float(tl.GetSetting("timelineFrameRate") or 25)
    if abs(fps - 25) > 0.01: raise SystemExit("release_range reads timecodes at 25 fps; this timeline is %s fps" % fps)
    rel = [(f, m) for f, m in (tl.GetMarkers() or {}).items() if m["name"].startswith("RELEASE") and key.lower() in m["name"].lower()]
    if len(rel) != 1: raise SystemExit("need exactly one RELEASE marker matching %r: %s" % (key, [m["name"] for _, m in rel]))
    f0, m = rel[0]; IN, OUT = marker_range(f0, m, tl.GetStartFrame())
    return IN, OUT, m["name"]


def set_inout(tl, IN, OUT):
    """Timeline In/Out from absolute frames (SetMarkInOut counts from the timeline start), retried and read back."""
    st = tl.GetStartFrame()
    for _ in range(3):
        tl.SetMarkInOut(IN - st, OUT - st, "all")
        if tl.GetMarkInOut().get("video") == {"in": IN - st, "out": OUT - st}: return True
    return False
