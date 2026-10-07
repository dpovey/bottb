#!/usr/bin/env python3
"""Rebuild a Resolve multicam timeline onto trimmed media, and verify it.

Companion to ``fcpxml_retarget.py``.  FCPXML carries cuts, angle selections
and media references, and nothing else.  This tool does the Resolve-side work
around it: dumping the in-point truth (GetSourceStartTime) before the export, importing the
retargeted FCPXML, transferring everything FCPXML drops, and verifying the
result against the source timeline.

The full procedure, and every detour that was tried and is wrong, is in
``doc/media-archive-findings.md`` section 0.  Read it before changing this.

Subcommands
-----------
::

    resolve_finish.py inpoints --src "Timeline 1" --out inpoints.txt
    fcpxml_retarget.py --in Info.fcpxml --out band.fcpxml \\
        --map-file trim.json --inpoints inpoints.txt --verify
    resolve_finish.py import  --fcpxml band.fcpxml --name "FINAL"
    resolve_finish.py finish  --src "Timeline 1" --dst "FINAL" --timeline-grade tl.drx
    #   ...then ColorTrace in the UI (clip grades cannot be scripted; see below)
    resolve_finish.py dynzoom --src "Timeline 1" --dst "FINAL" --name "FINAL DZ"
    resolve_finish.py verify  --src "Timeline 1" --dst "FINAL DZ"

Runs against the project currently open in Resolve.  Resolve must allow
external scripting (Preferences > System > General > "Local").  Run from the
shell, not through the MCP ``run_script`` tool: that has a 10 s timeout and
this work takes longer.

What cannot be scripted
-----------------------
* **Clip grades.**  ``TimelineItem.CopyGrades()`` returns True and copies
  nothing across timelines on multicam items -- even with the destination
  current and the Color page open.  ``Graph.ApplyGradeFromDRX()`` on a
  multicam item hung and crashed Resolve 21.1.  Use ColorTrace in the UI.
* **Dynamic Zoom rects.**  No API, and FCPXML drops them.  Handled by the
  ``dynzoom`` step, which transplants them through a ``.drt`` round trip.
* **Stabilisation.**  No read API at all.
* **Grabbing the timeline-level grade.**  ``GrabStill()`` captures whichever
  graph the Color page is showing, and the Clip/Timeline toggle is GUI-only, so
  the ``.drx`` for ``--timeline-grade`` must be grabbed with the Color page in
  Timeline mode.  Applying it to the *timeline* graph is safe.
"""

from __future__ import annotations

import argparse
import os
import sys
from collections import Counter

RESOLVE_API = "/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Scripting"
RESOLVE_LIB = (
    "/Applications/DaVinci Resolve/DaVinci Resolve.app/Contents/Libraries/Fusion/fusionscript.so"
)

#: Video item properties that FCPXML drops and SetProperties restores.  The
#: scaling keys are essential: omitting ``Scaling`` alone left every
#: 4096x2160 clip reframed in a 3840x2160 timeline.  SetProperties validates
#: all-or-nothing, so one bad key kills the whole dict -- keep this list exact.
VIDEO_KEYS = [
    "TransformEnabled", "Pan", "Tilt", "ZoomX", "ZoomY", "ZoomGang", "RotationAngle",
    "AnchorPointX", "AnchorPointY", "Pitch", "Yaw", "FlipX", "FlipY", "CroppingEnabled",
    "CropLeft", "CropRight", "CropTop", "CropBottom", "CropSoftness", "CropRetain",
    "DynamicZoomEnabled", "DynamicZoomEase", "CompositeEnabled", "CompositeMode", "Opacity",
    "LensCorrectionEnabled", "Distortion", "RetimeAndScalingEnabled", "RetimeProcess",
    "MotionEstimation", "Scaling", "ResizeFilter",
]

#: Audio item properties.  Kept separate from VIDEO_KEYS because of the
#: all-or-nothing validation.
AUDIO_KEYS = [
    "AudioVolumeEnabled", "AudioVolume", "AudioPanEnabled", "AudioPan",
    "AudioPitchEnabled", "AudioPitchSemiTones", "AudioPitchCents",
]

#: The delivered mix is on A3; the original has A3 *soloed*.  Solo is invisible
#: to FCPXML and to the API, so it is mirrored by disabling the other tracks'
#: clips -- without this the rebuild renders ~2x loud.
MUTED_AUDIO_TRACKS = (1, 2, 4)


class FinishError(Exception):
    pass


# --------------------------------------------------------------------------
# Resolve plumbing
# --------------------------------------------------------------------------


def connect():
    os.environ.setdefault("RESOLVE_SCRIPT_API", RESOLVE_API)
    os.environ.setdefault("RESOLVE_SCRIPT_LIB", RESOLVE_LIB)
    sys.path.append(os.path.join(os.environ["RESOLVE_SCRIPT_API"], "Modules"))
    import DaVinciResolveScript as dvr  # noqa: E402

    resolve = dvr.scriptapp("Resolve")
    if resolve is None:
        raise FinishError("cannot reach Resolve -- is it running with local scripting on?")
    project = resolve.GetProjectManager().GetCurrentProject()
    if project is None:
        raise FinishError("no project open in Resolve")
    return resolve, project


def timelines(project) -> dict:
    return {
        project.GetTimelineByIndex(i).GetName(): project.GetTimelineByIndex(i)
        for i in range(1, project.GetTimelineCount() + 1)
    }


def get_timeline(project, name):
    tl = timelines(project).get(name)
    if tl is None:
        raise FinishError(f"no timeline named {name!r} in project {project.GetName()!r}")
    return tl


def clips(tl, kind, track):
    """Items on a track, transitions excluded."""
    return [i for i in (tl.GetItemListInTrack(kind, track) or []) if i.GetType() != "transition"]


def transitions(tl, kind, track):
    return [i for i in (tl.GetItemListInTrack(kind, track) or []) if i.GetType() == "transition"]


def tools_of(item):
    g = item.GetNodeGraph()
    return tuple(g.GetToolsInNode(1) or []) if g else ()


# --------------------------------------------------------------------------
# inpoints
# --------------------------------------------------------------------------


def tc_to_seconds(tc: str, rate: float) -> float:
    hh, mm, ss, ff = (int(x) for x in tc.replace(";", ":").split(":"))
    return ((hh * 60 + mm) * 60 + ss) + ff / rate


def true_inpoint(item) -> float:
    """Source in-point in frames, from GetSourceStartTime() (see cmd_inpoints)."""
    mpi = item.GetMediaPoolItem()
    rate = float(mpi.GetClipProperty("FPS"))
    return (item.GetSourceStartTime() - tc_to_seconds(mpi.GetClipProperty("Start TC"), rate)) * rate


def cmd_inpoints(project, args):
    """Dump ``timelineFrame:inpointFrame`` for every V1 item.

    Truth comes from ``GetSourceStartTime()`` -- the only one of the three
    in-point fields that was right on all 585 Jumbo cuts:

    * ``GetSourceStartFrame()`` is one frame LOW on 160 cuts.  Patching from it
      leaves those cuts rendering one frame early.
    * ``GetLeftOffset()`` matches on ordinary cuts but is meaningless on
      retimed ones (off by 24,068 frames on the 80 % clip).
    * ``GetSourceStartTime()`` agrees with ``GetLeftOffset()`` on all 584
      ordinary cuts and with the verified value on the retimed one.
    """
    tl = get_timeline(project, args.src)
    items = clips(tl, "video", 1)
    pairs = []
    vs_frame, vs_left, retimed, fractional = Counter(), Counter(), [], []
    for it in items:
        mpi = it.GetMediaPoolItem()
        rate = float(mpi.GetClipProperty("FPS"))
        t0 = tc_to_seconds(mpi.GetClipProperty("Start TC"), rate)
        exact = (it.GetSourceStartTime() - t0) * rate
        frame = round(exact)
        if abs(exact - frame) > 1e-3:
            # sub-frame in-point (retimed clips): keep it, don't round it away
            frame = round(exact, 3)
            fractional.append((it.GetStart(), frame))
        vs_frame[frame - it.GetSourceStartFrame()] += 1
        vs_left[frame - int(it.GetLeftOffset())] += 1
        sp = (it.GetSpeed() or {}).get("Percentage", 100.0)
        if abs(sp - 100.0) > 1e-6:
            retimed.append((it.GetStart(), round(sp, 2), frame))
        pairs.append(f"{it.GetStart()}:{frame}")
    with open(args.out, "w", encoding="utf-8") as fh:
        fh.write(";".join(pairs) + "\n")
    print(f"wrote {len(pairs)} in-points to {args.out}  (from GetSourceStartTime)")
    print(f"  vs GetSourceStartFrame(): {dict(sorted(vs_frame.items()))}")
    print(f"  vs GetLeftOffset()      : {dict(sorted(vs_left.items()))}")
    if retimed:
        print(f"  retimed cuts (GetLeftOffset is invalid on these): {retimed}")
    if fractional:
        print(f"  sub-frame in-points, kept exact: {fractional}")


# --------------------------------------------------------------------------
# import
# --------------------------------------------------------------------------


def cmd_import(project, args):
    if args.name in timelines(project):
        raise FinishError(f"timeline {args.name!r} already exists -- pick another --name")
    path = os.path.abspath(args.fcpxml)
    if os.path.isdir(path):  # an .fcpxmld bundle
        path = os.path.join(path, "Info.fcpxml")
    tl = project.GetMediaPool().ImportTimelineFromFile(path, {"timelineName": args.name})
    if not tl:
        raise FinishError(f"import failed: {path}")
    print(f"imported {path} as {tl.GetName()!r}: "
          f"{len(clips(tl, 'video', 1))} V1 items")


# --------------------------------------------------------------------------
# finish
# --------------------------------------------------------------------------


def transfer_video_track(src, dst, track):
    a, b = clips(src, "video", track), clips(dst, "video", track)
    if len(a) != len(b):
        raise FinishError(f"V{track}: {len(a)} source items vs {len(b)} rebuilt -- not 1:1")
    props = fades = speeds = 0
    for x, y in zip(a, b):
        pr = x.GetProperties()
        if y.SetProperties({k: pr[k] for k in VIDEO_KEYS if k in pr}):
            props += 1
        fd = x.GetFades()
        if fd and (fd.get("FadeIn") or fd.get("FadeOut")) and y.SetFades(fd):
            fades += 1
        sp = x.GetSpeed()
        pct = sp.get("Percentage", 100.0) if sp else 100.0
        if pct > 0 and abs(pct - 100.0) > 1e-6:
            # RippleTimeline False keeps every cut in place; linked audio follows.
            if y.SetSpeed({"Percentage": pct,
                           "PitchCorrection": sp.get("PitchCorrection", True),
                           "RippleTimeline": False}):
                speeds += 1
    print(f"V{track}: {len(a)} items, properties={props} fades={fades} speed-changes={speeds}")


def rebuild_audio(project, src, dst):
    """Replace the imported audio with a clip-for-clip rebuild of the source.

    Audio is NOT 1:1 after FCPXML import: clips go missing (29 of 36 on
    Jumbo), tracks get reordered, and all crossfades are dropped.  So the
    imported audio is deleted and re-appended from the source, by track and
    record frame.  Verified on Jumbo: the rendered A3 is bit-identical to the
    source Logic stem.
    """
    doomed = []
    for tr in range(1, dst.GetTrackCount("audio") + 1):
        doomed += list(dst.GetItemListInTrack("audio", tr) or [])
    if doomed:
        dst.DeleteClips(doomed, False)
    rebuilt_mc = clips(dst, "video", 1)[0].GetMediaPoolItem()
    infos = []
    for tr in range(1, src.GetTrackCount("audio") + 1):
        for it in clips(src, "audio", tr):
            m = it.GetMediaPoolItem()
            # Sync audio lives in the multicam: point it at the REBUILT one.
            use = rebuilt_mc if m.GetClipProperty("Type") == "Multicam" else m
            st = int(it.GetSourceStartFrame())
            infos.append({"mediaPoolItem": use, "startFrame": st,
                          "endFrame": st + int(it.GetDuration()), "mediaType": 2,
                          "trackIndex": tr, "recordFrame": int(it.GetStart())})
    res = project.GetMediaPool().AppendToTimeline(infos)
    got = len(res) if res else 0
    if got != len(infos):
        raise FinishError(f"audio append: {got} of {len(infos)}")

    props = fades = maps = 0
    for tr in range(1, src.GetTrackCount("audio") + 1):
        for x, y in zip(clips(src, "audio", tr), clips(dst, "audio", tr)):
            pr = x.GetProperties()
            if y.SetProperties({k: pr[k] for k in AUDIO_KEYS if k in pr}):
                props += 1
            fd = x.GetFades()
            if fd and (fd.get("FadeIn") or fd.get("FadeOut")) and y.SetFades(fd):
                fades += 1
            ms = x.GetSourceAudioChannelMapping()
            if ms != y.GetSourceAudioChannelMapping() and y.SetSourceAudioChannelMapping(ms):
                maps += 1

    made = wanted = 0
    for tr in range(1, src.GetTrackCount("audio") + 1):
        dc = clips(dst, "audio", tr)
        for t in transitions(src, "audio", tr):
            wanted += 1
            ts, td = int(t.GetStart()), int(t.GetDuration())
            cand = [c for c in dc if ts <= int(c.GetStart()) <= ts + td]
            if not cand:
                continue
            cs = int(cand[0].GetStart())
            align = "left" if cs == ts + td else ("right" if cs == ts else "center")
            if cand[0].AddTransition({"type": t.GetName(), "category": "audio",
                                      "position": "start", "alignment": align,
                                      "duration": td}):
                made += 1

    muted = 0
    for tr in MUTED_AUDIO_TRACKS:
        for it in clips(dst, "audio", tr):
            if it.SetClipEnabled(False):
                muted += 1
    print(f"audio: appended {got}, properties={props} fades={fades} channel-maps={maps}, "
          f"crossfades {made}/{wanted}, clips disabled on A{'/A'.join(map(str, MUTED_AUDIO_TRACKS))}"
          f"={muted}")
    if made != wanted:
        raise FinishError(f"only {made} of {wanted} crossfades recreated")


def cmd_finish(resolve, project, args):
    src, dst = get_timeline(project, args.src), get_timeline(project, args.dst)
    # MANDATORY: many setters silently no-op unless the destination is current
    # (SetSpeed returns False, audio items expose half their property keys).
    project.SetCurrentTimeline(dst)

    for tr in range(1, src.GetTrackCount("video") + 1):
        if clips(src, "video", tr):
            transfer_video_track(src, dst, tr)

    marks = 0
    for frame, mk in (src.GetMarkers() or {}).items():
        if dst.AddMarker(frame, mk["color"], mk["name"], mk["note"], mk["duration"],
                         mk.get("customData") or ""):
            marks += 1
    print(f"markers: {marks} of {len(src.GetMarkers() or {})}")

    rebuild_audio(project, src, dst)

    # Re-assert video fades LAST.  SetFades returns True during the track pass,
    # but on Jumbo the V2 title fades were gone by the end of `finish` (a later
    # step -- speed change or audio rebuild -- clears them).  Setting them again
    # here makes them stick; `verify` checks them.
    refaded = 0
    for tr in range(1, src.GetTrackCount("video") + 1):
        for x, y in zip(clips(src, "video", tr), clips(dst, "video", tr)):
            fd = x.GetFades()
            if fd and fd != y.GetFades() and y.SetFades(fd):
                refaded += 1
    print(f"fades re-asserted: {refaded}")

    if args.timeline_grade:
        g = dst.GetNodeGraph()
        ok = g.ApplyGradeFromDRX(os.path.abspath(args.timeline_grade), 0)
        want, got = tools_of_graph(src.GetNodeGraph()), tools_of_graph(dst.GetNodeGraph())
        print(f"timeline grade: applied={ok} tools={list(got)}"
              f"{'' if want == got else f'  MISMATCH vs source {list(want)}'}")
    else:
        print("timeline grade: SKIPPED (no --timeline-grade)")

    print("\nnext: ColorTrace in the UI for the clip grades, then run `verify`.")


def tools_of_graph(g):
    return tuple(g.GetToolsInNode(1) or []) if g and g.GetNumNodes() else ()


# --------------------------------------------------------------------------
# verify
# --------------------------------------------------------------------------


def cmd_verify(project, args):
    src, dst = get_timeline(project, args.src), get_timeline(project, args.dst)
    project.SetCurrentTimeline(dst)
    a, b = clips(src, "video", 1), clips(dst, "video", 1)
    problems = []
    if len(a) != len(b):
        problems.append(f"V1 item count {len(a)} vs {len(b)}")

    pos = ang = 0
    left = Counter()
    grade_set = prop = dz = v1fade = fade_capped = 0
    for x, y in zip(a, b):
        if (x.GetStart(), x.GetEnd()) != (y.GetStart(), y.GetEnd()):
            pos += 1
        if x.GetName() != y.GetName():
            ang += 1
        left[round(true_inpoint(y) - true_inpoint(x))] += 1
        if tools_of(x) != tools_of(y):
            grade_set += 1
        px, py = x.GetProperties(), y.GetProperties()
        if any(px.get(k) != py.get(k) for k in VIDEO_KEYS):
            prop += 1
        if px.get("DynamicZoomEnabled"):
            dz += 1
        if x.GetFades() != y.GetFades():
            # Resolve caps a fade at duration-1 frames: a whole-clip fade comes back one short.
            dur = x.GetDuration()
            capped = all(x.GetFades().get(k) == y.GetFades().get(k) or
                         (x.GetFades().get(k) == dur and y.GetFades().get(k) == dur - 1)
                         for k in ("FadeIn", "FadeOut"))
            if capped:
                fade_capped += 1
            else:
                v1fade += 1

    n = min(len(a), len(b))
    off = n - left.get(0, 0)
    print(f"V1 items            : {len(a)} source, {len(b)} rebuilt")
    print(f"position mismatches : {pos}")
    print(f"angle mismatches    : {ang}")
    print(f"in-point deltas     : {dict(sorted(left.items()))}   (want {{0: {n}}})")
    print(f"clip-grade tool sets: {grade_set} differ   (want 0 after ColorTrace. Swaps between "
          "adjacent cuts mean the in-points are wrong -- ColorTrace matches on them)")
    print(f"property mismatches : {prop}")
    print(f"V1 fade mismatches  : {v1fade}" + (f"   (+{fade_capped} whole-clip fade capped at duration-1 by Resolve -- known limit)" if fade_capped else ""))
    print(f"dynamic zoom cuts   : {dz}   (run `dynzoom` for these; even then they render ~57-69 dB, "
          "not bit-identical)")

    # Every video track, not just V1: the connected-clip drift (title overlays
    # and End Card one frame early) was invisible to a V1-only check.
    for tr in range(2, max(src.GetTrackCount("video"), dst.GetTrackCount("video")) + 1):
        sa, sb = clips(src, "video", tr), clips(dst, "video", tr)
        misplaced = [(x.GetName(), y.GetStart() - x.GetStart()) for x, y in zip(sa, sb)
                     if (x.GetStart(), x.GetEnd()) != (y.GetStart(), y.GetEnd())]
        misfaded = [x.GetName() for x, y in zip(sa, sb) if x.GetFades() != y.GetFades()]
        if misfaded:
            print(f"V{tr} fades           : {len(misfaded)} differ  e.g. {misfaded[:3]}")
            problems.append(f"V{tr}: {len(misfaded)} fades differ")
        print(f"V{tr} positions        : {len(sa)}/{len(sb)} items, {len(misplaced)} misplaced"
              + (f"  e.g. {misplaced[:3]}" if misplaced else ""))
        if len(sa) != len(sb) or misplaced:
            problems.append(f"V{tr}: {len(misplaced)} misplaced of {len(sa)}/{len(sb)}")

    ga, gb = tools_of_graph(src.GetNodeGraph()), tools_of_graph(dst.GetNodeGraph())
    print(f"timeline grade      : {'match' if ga == gb else f'DIFFERS {list(ga)} vs {list(gb)}'}")

    for tr in range(1, max(src.GetTrackCount("audio"), dst.GetTrackCount("audio")) + 1):
        sa, sb = clips(src, "audio", tr), clips(dst, "audio", tr)
        ta, tb = transitions(src, "audio", tr), transitions(dst, "audio", tr)
        en = sum(1 for i in sb if i.GetClipEnabled())
        print(f"A{tr}                  : clips {len(sa)}/{len(sb)}  crossfades {len(ta)}/{len(tb)}"
              f"  enabled {en}")
        if (len(sa), len(ta)) != (len(sb), len(tb)):
            problems.append(f"A{tr} clip/transition counts differ")

    if pos:
        problems.append(f"{pos} position mismatches")
    if ang:
        problems.append(f"{ang} angle mismatches")
    if off:
        problems.append(f"{off} cuts with a non-zero in-point delta")
    if prop:
        problems.append(f"{prop} property mismatches")
    if v1fade:
        problems.append(f"{v1fade} V1 fade mismatches")
    if ga != gb:
        problems.append("timeline grade differs")

    print()
    if problems:
        for p in problems:
            print(f"FAIL: {p}")
        print("\nStructural checks cannot see grade VALUES or Dynamic Zoom rects: finish with a "
              "control render and a per-frame PSNR (doc section 0, step 6).")
        return 1
    print("structural checks OK -- now do the control render + per-frame PSNR "
          "(doc section 0, step 6).")
    return 0




# --------------------------------------------------------------------------
# media: make trimmed clips carry the originals' colour interpretation
# --------------------------------------------------------------------------


def _pool_clips(folder):
    for c in folder.GetClipList():
        yield c
    for sub in folder.GetSubFolderList():
        yield from _pool_clips(sub)


def cmd_media(project, args):
    """Copy Input Color Space / Input Gamma from each original onto its trim.

    Media Management keeps these for BRAW and ProRes, but the Sony MP4s (Roving,
    S-Gamut3.Cine/S-Log3) came back as "Project" -- on Jumbo and again on OUA.
    Left alone they render washed-out/wrong.  Matched by file name; originals
    are pool clips NOT under --trim-dir.
    """
    trim_dir = os.path.abspath(args.trim_dir)
    trims, originals = [], {}
    for c in _pool_clips(project.GetMediaPool().GetRootFolder()):
        fp = c.GetClipProperty("File Path") or ""
        if not fp:
            continue
        name = os.path.basename(fp)
        if os.path.abspath(fp).startswith(trim_dir + os.sep):
            trims.append((name, c))
        else:
            originals.setdefault(name, c)
    if not trims:
        raise FinishError(f"no pool clips under {trim_dir} -- import the trimmed media first")
    fixed = 0
    for name, c in sorted(trims, key=lambda x: x[0]):
        o = originals.get(name)
        if o is None:
            print(f"  {name}: no original in the pool -- left as is")
            continue
        for key in ("Input Color Space", "Input Gamma"):
            want, got = o.GetClipProperty(key), c.GetClipProperty(key)
            if want and want != got:
                c.SetClipProperty(key, want)
                now = c.GetClipProperty(key)
                print(f"  {name}: {key} {got!r} -> {now!r}" + ("" if now == want else f"  FAILED (want {want!r})"))
                fixed += now == want
    print(f"media: {len(trims)} trimmed clips checked, {fixed} settings corrected")

# --------------------------------------------------------------------------
# dynzoom: transplant Dynamic Zoom via Resolve's native .drt format
# --------------------------------------------------------------------------
#
# Dynamic Zoom rects and curve have no scripting API, FCPXML drops them, and
# setting DynamicZoomEase through the API changes nothing in the render.
# Resolve's own .drt timeline export stores them in each clip's
# <EffectFiltersBA>: u32 version, u32 length, then a flag byte (0x80 raw,
# 0x81 zstd) and a protobuf payload.  Copying the source clip's blob verbatim
# onto the rebuilt clip and re-importing the .drt reproduces the zoom (Jumbo:
# 22 dB -> 57-69 dB, visually identical) while keeping angles, grades and
# media, because .drt is Resolve's native format.
#
# Dead end, for the record: OTIO import (it carries the zoom too) can only be
# made to work with importSourceClips=False, and then gives every cut the
# multicam's FIRST angle -- OTIO does not record the active angle.

import re as _re
import shutil as _shutil
import tempfile as _tempfile
import zipfile as _zipfile


def _drt_v1_items(xml: str):
    """[(start, EffectFiltersBA hex or None, (span_start, span_end))] for V1."""
    vt = xml.index("<VideoTrackVec>")
    t0 = xml.index("<Sm2TiTrack", vt)
    t1 = xml.index("</Sm2TiTrack>", t0)
    out = []
    for m in _re.finditer(r'<Sm2TiVideoClip DbId="[^"]+">', xml[t0:t1]):
        a = t0 + m.end()
        b = xml.index("</Sm2TiVideoClip>", a)
        body = xml[a:b]
        st = int(_re.search(r"<Start>(\d+)</Start>", body).group(1))
        em = _re.search(r"<EffectFiltersBA>([0-9a-fA-F]*)</EffectFiltersBA>", body)
        out.append((st, em.group(1) if em else None,
                    (a + em.start(1), a + em.end(1)) if em else None))
    return out


def _drt_sequence(folder: str):
    """Path of the SeqContainer XML holding the main timeline (most V1 clips)."""
    best, n = None, -1
    for f in os.listdir(os.path.join(folder, "SeqContainer")):
        path = os.path.join(folder, "SeqContainer", f)
        text = open(path, encoding="utf-8").read()
        if "<VideoTrackVec>" not in text:
            continue
        k = len(_drt_v1_items(text))
        if k > n:
            best, n = path, k
    if best is None:
        raise FinishError(f"no timeline XML in {folder}")
    return best


def cmd_dynzoom(resolve, project, args):
    src, dst = get_timeline(project, args.src), get_timeline(project, args.dst)
    if args.name in timelines(project):
        raise FinishError(f"timeline {args.name!r} already exists -- pick another --name")
    project.SetCurrentTimeline(src)
    dz = {it.GetStart() for it in clips(src, "video", 1)
          if it.GetProperty().get("DynamicZoomEnabled")}
    print(f"source cuts with Dynamic Zoom: {len(dz)}")
    work = _tempfile.mkdtemp(prefix="dynzoom_", dir=args.workdir)
    try:
        paths = {}
        for tag, tl in (("src", src), ("dst", dst)):
            drt = os.path.join(work, f"{tag}.drt")
            if not tl.Export(drt, resolve.EXPORT_DRT):
                raise FinishError(f"export failed: {tl.GetName()}")
            folder = os.path.join(work, tag)
            _zipfile.ZipFile(drt).extractall(folder)
            paths[tag] = (drt, folder, _drt_sequence(folder))
        a = _drt_v1_items(open(paths["src"][2], encoding="utf-8").read())
        xml = open(paths["dst"][2], encoding="utf-8").read()
        b = _drt_v1_items(xml)
        if [x[0] for x in a] != [y[0] for y in b]:
            raise FinishError("V1 cut positions differ between the two .drt exports")
        edits = [(y[2], x[1]) for x, y in zip(a, b) if x[0] in dz]
        if any(sp is None or hx is None for sp, hx in edits):
            raise FinishError("a Dynamic Zoom cut has no EffectFiltersBA to transplant")
        for (s0, s1), hx in sorted(edits, key=lambda e: -e[0][0]):
            xml = xml[:s0] + hx + xml[s1:]
        open(paths["dst"][2], "w", encoding="utf-8").write(xml)
        # Resolve names an imported .drt after the FILE, not the option.
        out = os.path.join(work, f"{args.name}.drt")
        members = _zipfile.ZipFile(paths["dst"][0]).infolist()
        with _zipfile.ZipFile(out, "w", _zipfile.ZIP_DEFLATED) as z:
            for info in members:
                z.write(os.path.join(paths["dst"][1], info.filename), info.filename)
        tl = project.GetMediaPool().ImportTimelineFromFile(out, {"timelineName": args.name})
        if not tl:
            raise FinishError(f"import of {out} failed")
        if tl.GetName() != args.name:
            tl.SetName(args.name)
        print(f"transplanted {len(edits)} Dynamic Zoom blobs; imported as {tl.GetName()!r}")
        # The .drt round trip does not keep every fade (seen: V1/V2 fades lost).
        project.SetCurrentTimeline(tl)
        refaded = 0
        for tr in range(1, src.GetTrackCount("video") + 1):
            for x, y in zip(clips(src, "video", tr), clips(tl, "video", tr)):
                if x.GetFades() and x.GetFades() != y.GetFades() and y.SetFades(x.GetFades()):
                    refaded += 1
        print(f"fades re-asserted: {refaded}")
        print("next: `verify`, then render + per-frame PSNR.  Expect only the Dynamic Zoom "
              "cuts to differ, at ~57-69 dB.")
    finally:
        if not args.keep:
            _shutil.rmtree(work, ignore_errors=True)
        else:
            print(f"work files kept in {work}")

# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------


def build_parser():
    p = argparse.ArgumentParser(
        description="Rebuild a Resolve multicam timeline onto trimmed media, and verify it.",
        epilog="Procedure and known detours: doc/media-archive-findings.md section 0.",
    )
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("inpoints", help="dump GetLeftOffset() in-point truth for --inpoints")
    s.add_argument("--src", required=True, help="source timeline name")
    s.add_argument("--out", required=True, help="output file (START:INPOINT;...)")

    s = sub.add_parser("media", help="copy colour space/gamma from originals onto trimmed clips")
    s.add_argument("--trim-dir", required=True, help="folder holding the trimmed media")

    s = sub.add_parser("import", help="import a retargeted FCPXML as a new timeline")
    s.add_argument("--fcpxml", required=True, help=".fcpxml file or .fcpxmld bundle")
    s.add_argument("--name", required=True, help="name for the new timeline")

    s = sub.add_parser("finish", help="transfer what FCPXML drops (not clip grades)")
    s.add_argument("--src", required=True, help="source timeline name")
    s.add_argument("--dst", required=True, help="rebuilt timeline name")
    s.add_argument("--timeline-grade", help=".drx grabbed from the source in Timeline mode")

    s = sub.add_parser("dynzoom", help="transplant Dynamic Zoom via .drt into a new timeline")
    s.add_argument("--src", required=True, help="source timeline name")
    s.add_argument("--dst", required=True, help="rebuilt timeline (after ColorTrace)")
    s.add_argument("--name", required=True, help="name for the new, zoom-corrected timeline")
    s.add_argument("--workdir", help="where to put the .drt work files (default: $TMPDIR)")
    s.add_argument("--keep", action="store_true", help="keep the .drt work files")

    s = sub.add_parser("verify", help="structural comparison of source vs rebuilt")
    s.add_argument("--src", required=True, help="source timeline name")
    s.add_argument("--dst", required=True, help="rebuilt timeline name")
    return p


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)
    try:
        resolve, project = connect()
        if args.cmd == "inpoints":
            cmd_inpoints(project, args)
        elif args.cmd == "media":
            cmd_media(project, args)
        elif args.cmd == "import":
            cmd_import(project, args)
        elif args.cmd == "finish":
            cmd_finish(resolve, project, args)
        elif args.cmd == "dynzoom":
            cmd_dynzoom(resolve, project, args)
        elif args.cmd == "verify":
            return cmd_verify(project, args)
        return 0
    except FinishError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    rc = main()
    # Resolve's fusionscript library segfaults during interpreter teardown
    # (exit 139), which turns a successful run into a failure for `&&` chains.
    # Flush and leave before teardown runs.
    sys.stdout.flush()
    sys.stderr.flush()
    os._exit(rc)
