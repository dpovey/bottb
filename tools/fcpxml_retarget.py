#!/usr/bin/env python3
"""Retarget FCPXML multicam angle assets at trimmed media files.

Background
----------
A Resolve timeline built on a MULTICAM clip stores, per cut, only an
``angleID`` UUID inside ``<mc-source>``.  The angle contents themselves live
once, in ``<media><multicam><mc-angle>``.  That means the camera masters can be
swapped for trimmed excerpts by rewriting only the angle definitions -- the
585 per-cut angle selections keep working because they reference UUIDs that are
defined in the same document.

For every asset being replaced::

    new_start    = trimmed file's start timecode, in seconds
    new_offset   = old_offset + (new_start - old_start)
    new_duration = trimmed file's duration, in seconds

where ``old_offset`` / ``old_start`` come from the ``<asset-clip>`` inside the
``<mc-angle>``.  The ``<asset>`` element's own ``start`` / ``duration`` and its
``<media-rep src=...>`` are updated to match.

Everything else -- every ``angleID``, every ``<mc-source>``, the whole
``<spine>`` -- is left byte-identical.

Usage
-----
::

    fcpxml_retarget.py --in Info.fcpxml --out new.fcpxml \\
        --map 'A001_05200041_C001.braw=/trim/A001.braw@01:31:19:18+00:02:04:00'

    fcpxml_retarget.py --in Info.fcpxml --out new.fcpxml --map-file trim.json

Pure stdlib.  Rational time values are kept exact (``fractions.Fraction``) and
re-emitted in reduced ``num/dens`` form.
"""

from __future__ import annotations

import argparse
import copy
import json
import os
import re
import sys
import urllib.parse
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from fractions import Fraction
from typing import Iterable, Optional, Sequence

XML_HEADER = '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE fcpxml>\n'

TIME_RE = re.compile(r"^\s*(-?\d+)(?:/(\d+))?s?\s*$")
TC_RE = re.compile(r"^\s*(\d+):([0-5]?\d):([0-5]?\d)([:;])(\d+)\s*$")


class RetargetError(Exception):
    """Any validation or input failure.  Always fatal -- we fail loudly."""


# --------------------------------------------------------------------------
# Rational time helpers
# --------------------------------------------------------------------------


def parse_time(value: str) -> Fraction:
    """Parse an FCPXML rational time such as ``2387/6s``, ``0/1s``, ``3600s``."""
    if value is None:
        raise RetargetError("missing time value")
    m = TIME_RE.match(value)
    if not m:
        raise RetargetError(f"not an FCPXML rational time: {value!r}")
    num = int(m.group(1))
    den = int(m.group(2)) if m.group(2) else 1
    if den == 0:
        raise RetargetError(f"zero denominator in time value: {value!r}")
    return Fraction(num, den)


def format_time(value: Fraction) -> str:
    """Render a Fraction back as FCPXML ``num/dens`` (always reduced)."""
    f = Fraction(value)  # normalises ints / reduces
    return f"{f.numerator}/{f.denominator}s"


def parse_timecode(tc: str, rate: Fraction) -> Fraction:
    """Convert ``HH:MM:SS:FF`` to exact seconds at ``rate`` frames per second.

    Non-drop only.  Drop-frame (``;``) is rejected: none of the formats in this
    pipeline (24 / 25 fps) can be drop-frame, so a ``;`` means bad input.
    """
    m = TC_RE.match(tc)
    if not m:
        raise RetargetError(f"not a timecode (HH:MM:SS:FF): {tc!r}")
    if m.group(4) == ";":
        raise RetargetError(
            f"drop-frame timecode {tc!r} is not supported "
            "(this pipeline is 24/25 fps, both non-drop)"
        )
    hh, mm, ss, ff = int(m.group(1)), int(m.group(2)), int(m.group(3)), int(m.group(5))
    rate = Fraction(rate)
    if ff >= rate:
        raise RetargetError(f"frame {ff} out of range for {rate} fps in {tc!r}")
    frames = ((hh * 60 + mm) * 60 + ss) * rate + ff
    return Fraction(frames) / rate


def parse_duration_or_time(value, rate: Optional[Fraction]) -> Fraction:
    """Accept a timecode, an FCPXML rational, or a plain number of seconds."""
    if isinstance(value, (int, float)):
        return Fraction(str(value))
    if not isinstance(value, str):
        raise RetargetError(f"unsupported time value: {value!r}")
    s = value.strip()
    if TC_RE.match(s):
        if rate is None:
            raise RetargetError(
                f"timecode {s!r} given but the frame rate is unknown; "
                "add an explicit 'rate'"
            )
        return parse_timecode(s, rate)
    if TIME_RE.match(s):
        return parse_time(s)
    try:
        return Fraction(s)
    except (ValueError, ZeroDivisionError) as exc:
        raise RetargetError(f"cannot parse time value {value!r}: {exc}") from exc


def seconds_to_timecode(seconds: Fraction, rate: Fraction) -> str:
    """Render seconds as HH:MM:SS:FF (floor to frame; ``*`` marks off-frame)."""
    rate = Fraction(rate)
    frames_exact = Fraction(seconds) * rate
    frames = frames_exact.numerator // frames_exact.denominator  # floor
    off = "" if frames_exact == frames else "*"
    fps = int(rate) if rate.denominator == 1 else int(round(float(rate)))
    sign = "-" if frames < 0 else ""
    frames = abs(frames)
    ff = frames % fps
    total_s = frames // fps
    return (
        f"{sign}{total_s // 3600:02d}:{total_s % 3600 // 60:02d}:"
        f"{total_s % 60:02d}:{ff:02d}{off}"
    )


def fmt_secs(value: Fraction) -> str:
    return f"{float(value):.3f}"


# --------------------------------------------------------------------------
# Document model
# --------------------------------------------------------------------------


def path_to_file_url(path: str) -> str:
    """``/Volumes/X/a b.braw`` -> ``file:///Volumes/X/a%20b.braw``."""
    if path.startswith("file://"):
        return path
    abspath = os.path.abspath(os.path.expanduser(path))
    return "file://" + urllib.parse.quote(abspath)


def file_url_to_path(url: str) -> str:
    if url.startswith("file://"):
        return urllib.parse.unquote(url[len("file://") :])
    return url


@dataclass
class Mapping:
    """One requested replacement, straight from --map / --map-file."""

    key: str
    path: str
    start: object  # raw, resolved against the asset's rate later
    duration: object
    rate: Optional[Fraction] = None


@dataclass
class Asset:
    el: ET.Element
    id: str
    name: str
    start: Fraction
    duration: Fraction
    format_id: Optional[str]
    rate: Optional[Fraction]
    src: str

    @property
    def basename(self) -> str:
        return os.path.basename(file_url_to_path(self.src))


@dataclass
class AngleClip:
    """An ``<asset-clip>`` living inside an ``<mc-angle>``."""

    el: ET.Element
    angle_id: str
    angle_name: str
    asset_id: str
    offset: Fraction
    duration: Fraction
    start: Fraction


@dataclass
class Angle:
    el: ET.Element
    angle_id: str
    name: str
    clips: list = field(default_factory=list)


class FcpxmlDoc:
    """Parsed view over one FCPXML file."""

    def __init__(self, tree: ET.ElementTree):
        self.tree = tree
        self.root = tree.getroot()
        if self.root.tag != "fcpxml":
            raise RetargetError(f"not an FCPXML document (root <{self.root.tag}>)")
        self.resources = self.root.find("resources")
        if self.resources is None:
            raise RetargetError("no <resources> element")
        self.formats = {
            f.get("id"): f for f in self.resources.findall("format") if f.get("id")
        }
        self.assets = {}
        for el in self.resources.findall("asset"):
            aid = el.get("id")
            rep = el.find("media-rep")
            self.assets[aid] = Asset(
                el=el,
                id=aid,
                name=el.get("name", ""),
                start=parse_time(el.get("start", "0/1s")),
                duration=parse_time(el.get("duration", "0/1s")),
                format_id=el.get("format"),
                rate=self.rate_of_format(el.get("format")),
                src=(rep.get("src") if rep is not None else ""),
            )
        self.media = self.resources.find("media")
        self.multicam = self.media.find("multicam") if self.media is not None else None
        if self.multicam is None:
            raise RetargetError("no <media><multicam> element -- not a multicam export")
        self.tc_start = parse_time(self.multicam.get("tcStart", "0/1s"))
        self.angles = []
        for ael in self.multicam.findall("mc-angle"):
            angle = Angle(el=ael, angle_id=ael.get("angleID"), name=ael.get("name", ""))
            for cel in ael.findall("asset-clip"):
                angle.clips.append(
                    AngleClip(
                        el=cel,
                        angle_id=angle.angle_id,
                        angle_name=angle.name,
                        asset_id=cel.get("ref"),
                        offset=parse_time(cel.get("offset", "0/1s")),
                        duration=parse_time(cel.get("duration", "0/1s")),
                        start=parse_time(cel.get("start", "0/1s")),
                    )
                )
            self.angles.append(angle)
        self.sequence = self.root.find(".//sequence")
        self.spine = self.root.find(".//sequence/spine")
        if self.spine is None:
            raise RetargetError("no <sequence><spine> element")

    # -- lookups ---------------------------------------------------------

    def rate_of_format(self, format_id: Optional[str]) -> Optional[Fraction]:
        if not format_id:
            return None
        fel = self.formats.get(format_id)
        if fel is None:
            return None
        fd = fel.get("frameDuration")
        if not fd:
            return None  # e.g. FFVideoFormatRateUndefined
        d = parse_time(fd)
        if d == 0:
            return None
        return 1 / d

    def mc_clips(self) -> list:
        return list(self.root.iter("mc-clip"))

    def angle_ids(self) -> list:
        return [a.angle_id for a in self.angles]

    def mc_source_angle_ids(self) -> list:
        return [s.get("angleID") for s in self.root.iter("mc-source")]

    def find_angle_clips(self, key: str) -> list:
        """Resolve a --map key to angle clips: asset id, asset name, or basename."""
        matches = []
        for angle in self.angles:
            for clip in angle.clips:
                asset = self.assets.get(clip.asset_id)
                if asset is None:
                    continue
                if key in (asset.id, asset.name, asset.basename, clip.el.get("name")):
                    matches.append(clip)
        return matches


def load_doc(path: str) -> FcpxmlDoc:
    try:
        tree = ET.parse(path)
    except ET.ParseError as exc:
        raise RetargetError(f"{path}: XML parse error: {exc}") from exc
    return FcpxmlDoc(tree)


# --------------------------------------------------------------------------
# Used-source-range analysis
# --------------------------------------------------------------------------


def merge_intervals(intervals: Iterable) -> list:
    out = []
    for lo, hi in sorted(intervals):
        if out and lo <= out[-1][1]:
            if hi > out[-1][1]:
                out[-1] = (out[-1][0], hi)
        else:
            out.append((lo, hi))
    return out


def used_angle_intervals(doc: FcpxmlDoc) -> dict:
    """Angle-local intervals actually used by the edit, per angleID.

    ``mc-clip/@start`` is in the multicam's own timebase, which is offset by
    ``multicam/@tcStart``; angle children are laid out from 0.
    """
    used = {}
    for mc in doc.mc_clips():
        start = parse_time(mc.get("start", "0/1s")) - doc.tc_start
        dur = parse_time(mc.get("duration", "0/1s"))
        for src in mc.findall("mc-source"):
            aid = src.get("angleID")
            used.setdefault(aid, []).append((start, start + dur))
    return {k: merge_intervals(v) for k, v in used.items()}


def required_source_range(doc: FcpxmlDoc, clip: AngleClip, used: dict):
    """The source-media range of ``clip``'s asset the edit actually needs.

    Returns ``(lo, hi)`` in the source file's own timebase, or ``None`` when no
    cut touches this clip.
    """
    spans = used.get(clip.angle_id, [])
    clip_lo, clip_hi = clip.offset, clip.offset + clip.duration
    lo = hi = None
    for a, b in spans:
        o_lo, o_hi = max(a, clip_lo), min(b, clip_hi)
        if o_hi <= o_lo:
            continue
        s_lo = clip.start + (o_lo - clip.offset)
        s_hi = clip.start + (o_hi - clip.offset)
        lo = s_lo if lo is None else min(lo, s_lo)
        hi = s_hi if hi is None else max(hi, s_hi)
    if lo is None:
        return None
    return (lo, hi)


# --------------------------------------------------------------------------
# Mapping input
# --------------------------------------------------------------------------

MAP_SYNTAX = "ASSET=PATH@START+DURATION[#RATE]"


def parse_map_arg(arg: str) -> Mapping:
    """Parse ``ASSET=PATH@01:31:19:18+00:02:04:00[#24]``.

    Split right-to-left so paths may contain ``=`` or ``@``.  START and
    DURATION may also be rationals (``131514/24s``) or plain seconds.
    """
    if "=" not in arg:
        raise RetargetError(f"--map needs {MAP_SYNTAX}, got {arg!r}")
    key, rest = arg.split("=", 1)
    key = key.strip()
    if not key:
        raise RetargetError(f"--map has an empty asset key: {arg!r}")
    rate = None
    if "#" in rest:
        rest, rate_s = rest.rsplit("#", 1)
        try:
            rate = Fraction(rate_s.strip())
        except (ValueError, ZeroDivisionError) as exc:
            raise RetargetError(f"bad rate {rate_s!r} in --map {arg!r}") from exc
    if "+" not in rest:
        raise RetargetError(f"--map is missing '+DURATION' ({MAP_SYNTAX}): {arg!r}")
    rest, duration = rest.rsplit("+", 1)
    if "@" not in rest:
        raise RetargetError(f"--map is missing '@START' ({MAP_SYNTAX}): {arg!r}")
    path, start = rest.rsplit("@", 1)
    if not path.strip():
        raise RetargetError(f"--map has an empty path: {arg!r}")
    return Mapping(
        key=key,
        path=path.strip(),
        start=start.strip(),
        duration=duration.strip(),
        rate=rate,
    )


def load_map_file(path: str) -> list:
    """Load the JSON mapping file.

    Schema::

        {
          "version": 1,
          "mappings": [
            {"asset": "A001_05200041_C001.braw",
             "path":  "/Volumes/Archive/CAM A/A001_trim.braw",
             "start": "01:31:19:18",
             "duration": "00:02:04:00",
             "rate": 24}
          ]
        }

    ``mappings`` may also be an object keyed by asset.  ``asset`` matches an
    asset id (``r13``), an asset ``name``, or the basename of its current
    ``media-rep`` path.  ``start`` / ``duration`` accept a timecode, an FCPXML
    rational (``131514/24s``) or plain seconds.  ``rate`` is optional and
    defaults to the rate of the asset's own ``<format>``.
    """
    try:
        with open(path, "r", encoding="utf-8") as fh:
            data = json.load(fh)
    except OSError as exc:
        raise RetargetError(f"cannot read --map-file {path}: {exc}") from exc
    except json.JSONDecodeError as exc:
        raise RetargetError(f"{path}: invalid JSON: {exc}") from exc

    if isinstance(data, list):
        entries = [(None, e) for e in data]
    elif isinstance(data, dict):
        raw = data.get("mappings", data.get("maps"))
        if raw is None:
            raise RetargetError(f"{path}: no 'mappings' key")
        if isinstance(raw, dict):
            entries = list(raw.items())
        elif isinstance(raw, list):
            entries = [(None, e) for e in raw]
        else:
            raise RetargetError(f"{path}: 'mappings' must be a list or an object")
    else:
        raise RetargetError(f"{path}: top level must be an object or a list")

    out = []
    for key, entry in entries:
        if not isinstance(entry, dict):
            raise RetargetError(f"{path}: each mapping must be an object, got {entry!r}")
        key = key or entry.get("asset") or entry.get("assetId") or entry.get("id")
        if not key:
            raise RetargetError(f"{path}: mapping without an 'asset' key: {entry!r}")
        target = entry.get("path") or entry.get("file")
        if not target:
            raise RetargetError(f"{path}: mapping {key!r} has no 'path'")
        start = entry.get("start", entry.get("start_tc"))
        duration = entry.get("duration", entry.get("duration_tc"))
        if start is None:
            raise RetargetError(f"{path}: mapping {key!r} has no 'start'")
        if duration is None:
            raise RetargetError(f"{path}: mapping {key!r} has no 'duration'")
        rate = entry.get("rate")
        out.append(
            Mapping(
                key=str(key),
                path=str(target),
                start=start,
                duration=duration,
                rate=Fraction(str(rate)) if rate is not None else None,
            )
        )
    return out


# --------------------------------------------------------------------------
# The transformation
# --------------------------------------------------------------------------


@dataclass
class Change:
    key: str
    angle_name: str
    angle_id: str
    asset_id: str
    asset_name: str
    rate: Fraction
    old_offset: Fraction
    new_offset: Fraction
    old_start: Fraction
    new_start: Fraction
    old_duration: Fraction
    new_duration: Fraction
    old_path: str
    new_path: str
    required: Optional[tuple]
    head_handle: Optional[Fraction]
    tail_handle: Optional[Fraction]
    #: The new file is the SAME media extent as the asset (a whole-file copy,
    #: e.g. a long-GOP MP4 Media Management would not trim): only the path is
    #: swapped and the angle clip keeps its exported timing.  Rewriting it would
    #: replace Resolve's 24 fps-grid duration with the file's exact 25 fps one
    #: and push the following gaps off the multicam grid (seen on OUA, where
    #: four adjacent Roving clips are all used).
    path_only: bool = False

    @property
    def shortfall(self) -> bool:
        return (self.head_handle is not None and self.head_handle < 0) or (
            self.tail_handle is not None and self.tail_handle < 0
        )


def plan_changes(doc: FcpxmlDoc, mappings: Sequence[Mapping]) -> list:
    """Resolve mappings into Changes, validating hard.  No mutation here."""
    used = used_angle_intervals(doc)
    changes = []
    seen_assets = {}
    for m in mappings:
        clips = doc.find_angle_clips(m.key)
        if not clips:
            known = sorted(
                {
                    doc.assets[c.asset_id].basename
                    for a in doc.angles
                    for c in a.clips
                    if c.asset_id in doc.assets
                }
            )
            raise RetargetError(
                f"mapped asset {m.key!r} not found in any <mc-angle>. "
                f"Known angle assets: {', '.join(known)}"
            )
        if len(clips) > 1:
            raise RetargetError(
                f"mapped asset {m.key!r} matches {len(clips)} angle clips "
                "(refs: "
                + ", ".join(sorted({c.asset_id for c in clips}))
                + "); use the asset id to disambiguate"
            )
        clip = clips[0]
        asset = doc.assets[clip.asset_id]
        if asset.id in seen_assets:
            raise RetargetError(
                f"asset {asset.id} ({asset.name}) mapped twice: "
                f"{seen_assets[asset.id]!r} and {m.key!r}"
            )
        seen_assets[asset.id] = m.key

        rate = m.rate if m.rate is not None else asset.rate
        if rate is None and (
            isinstance(m.start, str) and TC_RE.match(m.start.strip())
        ):
            raise RetargetError(
                f"{m.key}: format {asset.format_id!r} has no frameDuration, so a "
                "timecode cannot be converted; give an explicit rate"
            )
        new_start = parse_duration_or_time(m.start, rate)
        new_duration = parse_duration_or_time(m.duration, rate)
        if new_duration <= 0:
            raise RetargetError(f"{m.key}: new duration must be positive, got {new_duration}")
        if new_start < 0:
            raise RetargetError(f"{m.key}: new start must not be negative, got {new_start}")

        path_only = (new_start == asset.start and new_duration == asset.duration)
        new_offset = clip.offset + (new_start - clip.start)
        if new_offset < 0:
            raise RetargetError(
                f"{m.key}: computed angle offset is negative "
                f"({format_time(new_offset)} = {format_time(clip.offset)} + "
                f"({format_time(new_start)} - {format_time(clip.start)})). "
                "The trimmed file starts earlier than the original's own start "
                "timecode allows -- check the trim's start timecode."
            )

        req = required_source_range(doc, clip, used)
        head = tail = None
        if req is not None:
            head = req[0] - new_start
            tail = (new_start + new_duration) - req[1]

        changes.append(
            Change(
                key=m.key,
                angle_name=clip.angle_name,
                angle_id=clip.angle_id,
                asset_id=asset.id,
                asset_name=asset.name,
                rate=rate if rate is not None else Fraction(24),
                old_offset=clip.offset,
                new_offset=new_offset,
                old_start=clip.start,
                new_start=new_start,
                old_duration=clip.duration,
                new_duration=new_duration,
                old_path=file_url_to_path(asset.src),
                new_path=os.path.abspath(os.path.expanduser(m.path)),
                required=req,
                head_handle=head,
                tail_handle=tail,
                path_only=path_only,
            )
        )
    return changes


def apply_changes(doc: FcpxmlDoc, changes: Sequence[Change], gap_fixup: bool = True) -> list:
    """Mutate the document in place.  Returns notes about gap adjustments."""
    by_asset = {c.asset_id: c for c in changes}
    notes = []
    for angle in doc.angles:
        touched = False
        for clip in angle.clips:
            ch = by_asset.get(clip.asset_id)
            if ch is None:
                continue
            if ch.path_only:
                asset = doc.assets[clip.asset_id]
                rep = asset.el.find("media-rep")
                if rep is None:
                    raise RetargetError(f"asset {asset.id} has no <media-rep> to retarget")
                rep.set("src", path_to_file_url(ch.new_path))
                asset.src = rep.get("src")
                notes.append(f"angle {angle.name!r}: {asset.name} is a whole-file copy -- "
                             "path swapped, timing left as exported")
                continue
            touched = True
            clip.el.set("offset", format_time(ch.new_offset))
            clip.el.set("start", format_time(ch.new_start))
            clip.el.set("duration", format_time(ch.new_duration))
            clip.offset, clip.start, clip.duration = (
                ch.new_offset,
                ch.new_start,
                ch.new_duration,
            )
            asset = doc.assets[clip.asset_id]
            asset.el.set("start", format_time(ch.new_start))
            asset.el.set("duration", format_time(ch.new_duration))
            rep = asset.el.find("media-rep")
            if rep is None:
                raise RetargetError(f"asset {asset.id} has no <media-rep> to retarget")
            rep.set("src", path_to_file_url(ch.new_path))
            asset.src = rep.get("src")
        if touched and gap_fixup:
            mc_rate = doc.rate_of_format(doc.multicam.get("format"))
            grid = (1 / mc_rate) if mc_rate else None
            notes.extend(rebuild_angle_gaps(doc, angle, grid=grid))
    return notes


def rebuild_angle_gaps(doc: FcpxmlDoc, angle: Angle, grid: Optional[Fraction] = None) -> list:
    """Re-lay the angle's ``<gap>`` fillers so the angle stays contiguous.

    Angle children carry absolute offsets, but Resolve writes explicit ``<gap>``
    fillers between them; once a clip moves, a stale gap leaves an overlap or a
    hole.  Existing gap elements are reused (and re-timed) where possible so the
    diff stays minimal; only gaps are touched, clips are authoritative.

    ``grid`` is the multicam's frame duration; gap boundaries that do not land
    on it are reported, because a 25 fps angle re-timed inside a 24 fps multicam
    can leave a sub-frame filler.
    """
    notes = []
    children = list(angle.el)
    if not children:
        return notes
    gap_template = next((c for c in children if c.tag == "gap"), None)
    gap_start = (
        gap_template.get("start") if gap_template is not None else format_time(doc.tc_start)
    )
    # The indent that separates siblings is the parent's leading text (the
    # whitespace before the first child), not the last child's tail -- that one
    # closes the element and is one level shallower.
    indent_tail = angle.el.text
    if not (indent_tail and indent_tail.strip() == ""):
        indent_tail = next((c.tail for c in children if c.tail), None)
    last_tail = children[-1].tail

    clips = [c for c in children if c.tag != "gap"]
    clips.sort(key=lambda c: parse_time(c.get("offset", "0/1s")))
    spare_gaps = [c for c in children if c.tag == "gap"]

    new_children = []
    cursor = Fraction(0)
    for c in clips:
        off = parse_time(c.get("offset", "0/1s"))
        dur = parse_time(c.get("duration", "0/1s"))
        if off < cursor:
            raise RetargetError(
                f"angle {angle.name!r}: clip {c.get('name')} starts at "
                f"{format_time(off)} but the previous clip ends at "
                f"{format_time(cursor)}; the retargeted ranges overlap"
            )
        if off > cursor:
            if spare_gaps:
                gap = spare_gaps.pop(0)
                was = (gap.get("offset"), gap.get("duration"))
            else:
                gap = ET.Element("gap")
                gap.set("offset", "0/1s")
                gap.set("duration", "0/1s")
                gap.set("start", gap_start)
                gap.set("name", "Gap")
                gap.tail = indent_tail
                was = None
            now = (format_time(cursor), format_time(off - cursor))
            gap.set("offset", now[0])
            gap.set("duration", now[1])
            if was != now:
                notes.append(
                    f"angle {angle.name!r}: gap before {c.get('name')} "
                    f"{'created' if was is None else was[0] + ' +' + was[1] + ' ->'} "
                    f"{now[0]} +{now[1]}"
                )
            if grid and ((cursor % grid) or ((off - cursor) % grid)):
                notes.append(
                    f"angle {angle.name!r}: gap before {c.get('name')} is not on the "
                    f"multicam frame grid ({format_time(grid)}); Resolve may round it. "
                    "Harmless while the clips either side are unused by the edit."
                )
            new_children.append(gap)
        new_children.append(c)
        cursor = off + dur

    for gap in spare_gaps:
        notes.append(f"angle {angle.name!r}: dropped a now-unnecessary trailing/stale gap")

    if [id(x) for x in new_children] != [id(x) for x in children]:
        for c in list(angle.el):
            angle.el.remove(c)
        for c in new_children:
            if c.tail is None:
                c.tail = indent_tail
            angle.el.append(c)
        new_children[-1].tail = last_tail
    return notes


# --------------------------------------------------------------------------
# Serialisation
# --------------------------------------------------------------------------


# --------------------------------------------------------------------------
# mc-clip source in-point patching
# --------------------------------------------------------------------------

#: Rounding nudge, in frames.  Resolve mis-rounds irreducible rational times on
#: import -- ``182671/24s`` came back as frame 96270 rather than 96271 -- so
#: every patched in-point is nudged just past the boundary.
#:
#: Keep it TINY.  A 0.1-frame nudge is harmless on 24 fps angles but not on the
#: 25 fps Roving camera inside the 24 fps multicam, whose sample positions are
#: already fractional: it flipped the chosen source frame about once a second
#: (40 frames wrong in a 100 s window) and 13 frames of the 80 % retimed clip.
#: At 1/1000 both went to zero, and the 24 fps rounding fix still holds.
INPOINT_EPSILON_FRAMES = Fraction(1, 1000)


def parse_inpoint_file(path: str) -> dict:
    """Parse ``timelineFrame:sourceFrame`` pairs, ``;`` and/or whitespace separated.

    Produce it with ``resolve_finish.py inpoints``, which derives each value
    from ``TimelineItem.GetSourceStartTime()`` -- see ``patch_inpoints`` for why
    the other two in-point fields are wrong.
    """
    with open(path, "r", encoding="utf-8") as fh:
        text = fh.read()
    out = {}
    for tok in re.split(r"[;\s]+", text.strip()):
        if not tok:
            continue
        if ":" not in tok:
            raise RetargetError(f"bad in-point token (want START:INPOINT): {tok!r}")
        a, b = tok.split(":", 1)
        try:
            # the in-point may be sub-frame (retimed clips): keep it exact
            start, inpoint = int(a), Fraction(b)
        except (ValueError, ZeroDivisionError):
            raise RetargetError(f"bad in-point token: {tok!r}")
        if start in out and out[start] != inpoint:
            raise RetargetError(f"conflicting in-points for timeline frame {start}")
        out[start] = inpoint
    if not out:
        raise RetargetError(f"no in-points found in {path}")
    return out


def crop_to_fill(doc: FcpxmlDoc) -> list:
    """Make angles wider than the multicam crop (as the original did), not letterbox.

    On FCPXML import Resolve FITS an angle clip whose format is wider than the
    multicam's (4096x2160 into 3840x2160: scale 0.9375, black bars, darker
    frame), where the original multicam CROPPED.  Setting each such clip's
    ``<adjust-transform scale>`` to fill/fit undoes that.  Measured on Jumbo:
    PSNR 21.58 -> 26.43 dB.  Clips already matching the multicam are untouched.
    """
    mfmt = self_format_dims(doc, doc.multicam.get("format"))
    if mfmt is None:
        raise RetargetError("multicam format has no width/height")
    wm, hm = mfmt
    notes = []
    for angle in doc.angles:
        for clip in angle.clips:
            dims = self_format_dims(doc, clip.el.get("format"))
            if dims is None:
                continue
            wc, hc = dims
            fit = min(Fraction(wm, wc), Fraction(hm, hc))
            fill = max(Fraction(wm, wc), Fraction(hm, hc))
            if fit == fill:
                continue
            scale = f"{float(fill / fit):.7f}"
            at = clip.el.find("adjust-transform")
            if at is None:
                at = ET.SubElement(clip.el, "adjust-transform",
                                   {"scale": "1 1", "anchor": "0 0", "position": "0 0"})
            at.set("scale", f"{scale} {scale}")
            notes.append(f"crop-to-fill: angle {angle.name!r} {clip.el.get('name')} "
                         f"{wc}x{hc} in {wm}x{hm} -> scale {scale}")
    return notes


def self_format_dims(doc: FcpxmlDoc, format_id):
    fel = doc.formats.get(format_id) if format_id else None
    if fel is None or not fel.get("width") or not fel.get("height"):
        return None
    return int(fel.get("width")), int(fel.get("height"))


def reanchor_connected(mc, parent_offset: Fraction, old_start: Fraction,
                       new_start: Fraction, rate: Fraction) -> int:
    """Keep a patched mc-clip's connected clips on their timeline frame.

    A connected clip's ``offset`` is in its PARENT's source timebase, so its
    timeline position is ``parent.offset + child.offset - parent.start``.
    Moving ``parent.start`` therefore drags every child the other way -- and
    even the +0.1 frame epsilon is enough: Resolve floors the child's position,
    so 13701.9 lands on 13701.  Measured on Jumbo 2026-09-23: 8 of 9 title
    overlays and the End Card were one frame early.

    Each child is re-anchored to the whole frame nearest its position under
    the OLD parent start.  That position is only trustworthy in Resolve's
    ORIGINAL export, where parent start and child offset are self-consistent:
    always run ``--inpoints`` on the original export, never on a file an
    earlier in-point patch has already moved (a 0.9-frame parent shift then
    rounds the child the wrong way -- seen on Jumbo, audio at 489 not 488).
    """
    moved = 0
    for ch in list(mc):
        if ch.get("lane") is None or ch.get("offset") is None:
            continue
        pos = parent_offset + parse_time(ch.get("offset")) - old_start
        want = Fraction(round(pos * rate)) / rate
        new_off = want - parent_offset + new_start
        if format_time(new_off) != ch.get("offset"):
            ch.set("offset", format_time(new_off))
            moved += 1
    return moved


def patch_inpoints(doc: FcpxmlDoc, truth: Mapping, rate: Fraction,
                   epsilon_frames: Fraction = None) -> list:
    """Rewrite each top-level ``<mc-clip start>`` from measured in-points.

    Resolve's FCPXML *export* writes wrong ``start`` values for some mc-clips,
    so they must be restored from the live project rather than trusted.

    **Truth must come from ``GetSourceStartTime()``.**  Resolve exposes three
    in-point fields and, measured on all 585 Jumbo cuts 2026-09-23, only that
    one is right everywhere:

    * ``GetSourceStartFrame()`` is one frame LOW on 160 cuts.  Patching from it
      makes every source-start value "agree" while those cuts still render one
      frame early -- the rebuilt frame is bit-identical to the *previous* frame
      of the original.
    * ``GetLeftOffset()`` is right on ordinary cuts but meaningless on retimed
      ones: 120339 vs a true 96271 on the 80 % clip.
    * ``GetSourceStartTime()`` (converted to frames) matches the rendered frame
      on all 584 ordinary cuts and on the retimed one.

    ``start`` is expressed in the multicam's own timebase, which is offset by
    ``multicam/@tcStart``; the angle children are laid out from zero.
    """
    rate = Fraction(rate)
    if rate <= 0:
        raise RetargetError(f"bad rate for in-point patching: {rate}")
    eps = (INPOINT_EPSILON_FRAMES if epsilon_frames is None
           else Fraction(epsilon_frames)) / rate
    notes, changed, missing, reanchored = [], 0, [], 0
    for mc in doc.spine.findall("mc-clip"):
        offset = parse_time(mc.get("offset", "0/1s"))
        frame = int(round(offset * rate))
        if frame not in truth:
            missing.append(frame)
            continue
        new_start = doc.tc_start + Fraction(truth[frame]) / rate + eps
        old = mc.get("start")
        old_start = parse_time(old) if old else Fraction(0)
        mc.set("start", format_time(new_start))
        if mc.get("start") != old:
            changed += 1
        reanchored += reanchor_connected(mc, offset, old_start, new_start, rate)
    notes.append(
        f"in-points: {changed} of {len(doc.spine.findall('mc-clip'))} mc-clips patched"
    )
    notes.append(f"in-points: {reanchored} connected clips re-anchored to their timeline frame")
    if missing:
        notes.append(
            f"in-points: no truth value for {len(missing)} mc-clips "
            f"(first few timeline frames: {missing[:5]})"
        )
    return notes


def serialize(doc: FcpxmlDoc) -> bytes:
    """Serialise, re-attaching the doctype ElementTree drops.

    ``ET`` writes ``<x />``; Resolve writes ``<x/>``.  Normalising that back
    makes an untouched document round-trip byte-for-byte.
    """
    body = ET.tostring(doc.root, encoding="unicode")
    body = re.sub(r"\s+/>", "/>", body)
    return (XML_HEADER + body + "\n").encode("utf-8")


# --------------------------------------------------------------------------
# Reporting / verification
# --------------------------------------------------------------------------


def print_change_table(changes: Sequence[Change], notes: Sequence[str], stream=sys.stdout):
    if not changes:
        print("no changes", file=stream)
        return
    hdr = f"{'ANGLE':<14} {'ASSET':<28} {'FIELD':<9} {'OLD':>16} {'NEW':>16}"
    print(hdr, file=stream)
    print("-" * len(hdr), file=stream)
    for c in changes:
        rows = [
            ("offset", c.old_offset, c.new_offset),
            ("start", c.old_start, c.new_start),
            ("duration", c.old_duration, c.new_duration),
        ]
        for i, (label, old, new) in enumerate(rows):
            angle = c.angle_name if i == 0 else ""
            asset = c.asset_name if i == 0 else ""
            print(
                f"{angle:<14} {asset:<28} {label:<9} "
                f"{format_time(old):>16} {format_time(new):>16}"
                f"   ({fmt_secs(old)}s -> {fmt_secs(new)}s)",
                file=stream,
            )
        print(f"{'':<14} {'':<28} path      {c.old_path}", file=stream)
        print(f"{'':<14} {'':<28}        -> {c.new_path}", file=stream)
        print("", file=stream)
    for n in notes:
        print(f"note: {n}", file=stream)


def print_report(doc: FcpxmlDoc, changes: Sequence[Change], stream=sys.stdout):
    """Per angle: the source range the edit needs vs what the trim provides."""
    used = used_angle_intervals(doc)
    by_asset = {c.asset_id: c for c in changes}
    print("SOURCE RANGE REPORT (per angle asset)", file=stream)
    print(
        f"{'ANGLE':<14} {'ASSET':<26} {'FPS':>5} {'NEEDED':>26} {'PROVIDED':>26} "
        f"{'HEAD':>9} {'TAIL':>9}",
        file=stream,
    )
    shortfalls = []
    for angle in doc.angles:
        for clip in angle.clips:
            asset = doc.assets.get(clip.asset_id)
            rate = (asset.rate if asset else None) or Fraction(24)
            req = required_source_range(doc, clip, used)
            ch = by_asset.get(clip.asset_id)
            prov_lo = ch.new_start if ch else clip.start
            prov_hi = (ch.new_start + ch.new_duration) if ch else (clip.start + clip.duration)
            if req is None:
                needed = "(unused by the edit)"
                head = tail = None
            else:
                needed = (
                    f"{seconds_to_timecode(req[0], rate)}..{seconds_to_timecode(req[1], rate)}"
                )
                head = req[0] - prov_lo
                tail = prov_hi - req[1]
            provided = (
                f"{seconds_to_timecode(prov_lo, rate)}..{seconds_to_timecode(prov_hi, rate)}"
            )
            flag = ""
            if head is not None and (head < 0 or tail < 0):
                flag = "  <<< SHORTFALL"
                shortfalls.append((angle.name, asset.name if asset else clip.asset_id, head, tail))
            print(
                f"{angle.name:<14} {(asset.name if asset else clip.asset_id):<26} "
                f"{str(rate):>5} {needed:>26} {provided:>26} "
                f"{(fmt_secs(head) if head is not None else '-'):>9} "
                f"{(fmt_secs(tail) if tail is not None else '-'):>9}{flag}",
                file=stream,
            )
    if shortfalls:
        print("", file=stream)
        for angle, asset, head, tail in shortfalls:
            print(
                f"SHORTFALL {angle}/{asset}: head handle {fmt_secs(head)}s, "
                f"tail handle {fmt_secs(tail)}s",
                file=stream,
            )
    return shortfalls


def _spine_signature(doc: FcpxmlDoc, ignore_mc_start: bool) -> str:
    """Serialise the spine, optionally neutralising top-level mc-clip @start.

    In-point patching is the ONLY sanctioned edit inside the spine, so it gets
    an explicit opt-in rather than a relaxed comparison everywhere.
    """
    spine = copy.deepcopy(doc.spine)
    if ignore_mc_start:
        for mc in spine.findall("mc-clip"):
            if "start" in mc.attrib:
                mc.set("start", "@@START@@")
            for ch in mc:  # connected clips are re-anchored alongside
                if ch.get("lane") is not None and "offset" in ch.attrib:
                    ch.set("offset", "@@OFFSET@@")
    return ET.tostring(spine, encoding="unicode")


def verify(original: FcpxmlDoc, produced: FcpxmlDoc,
           allow_inpoint_changes: bool = False) -> list:
    """Assert the output preserves everything that must not change.

    ``allow_inpoint_changes`` permits top-level ``mc-clip/@start`` to differ
    (see :func:`patch_inpoints`); every other spine byte must still match.
    """
    problems = []
    a, b = original.mc_clips(), produced.mc_clips()
    if len(a) != len(b):
        problems.append(f"mc-clip count changed: {len(a)} -> {len(b)}")
    if sorted(original.angle_ids()) != sorted(produced.angle_ids()):
        problems.append(
            f"mc-angle angleID set changed: {sorted(original.angle_ids())} -> "
            f"{sorted(produced.angle_ids())}"
        )
    if original.mc_source_angle_ids() != produced.mc_source_angle_ids():
        problems.append("mc-source angleID sequence changed")
    sa = _spine_signature(original, allow_inpoint_changes)
    sb = _spine_signature(produced, allow_inpoint_changes)
    if sa != sb:
        problems.append("spine content changed (the edit itself was modified)")
    if original.tc_start != produced.tc_start:
        problems.append(
            f"multicam tcStart changed: {format_time(original.tc_start)} -> "
            f"{format_time(produced.tc_start)}"
        )
    return problems


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="fcpxml_retarget.py",
        description="Point an FCPXML multicam's angle assets at trimmed media.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=f"--map syntax: {MAP_SYNTAX}\n"
        "  e.g. 'A001_05200041_C001.braw=/trim/A001.braw@01:31:19:18+00:02:04:00'\n"
        "  START/DURATION may be a timecode, an FCPXML rational (131514/24s) or seconds.\n"
        "  #RATE overrides the fps inferred from the asset's <format>.\n",
    )
    p.add_argument("--in", dest="infile", required=True, help="input FCPXML")
    p.add_argument("--out", dest="outfile", help="output FCPXML (required unless --dry-run)")
    p.add_argument("--map", dest="maps", action="append", default=[], help=MAP_SYNTAX)
    p.add_argument("--map-file", dest="map_file", help="JSON mapping file")
    p.add_argument("--dry-run", action="store_true", help="print changes, write nothing")
    p.add_argument("--report", action="store_true", help="print the source-range report")
    p.add_argument("--verify", action="store_true", help="re-parse the output and check it")
    p.add_argument(
        "--inpoints",
        dest="inpoints",
        help=(
            "file of START:INPOINT frame pairs used to rewrite each mc-clip's "
            "source in-point. Generate it with `resolve_finish.py inpoints` "
            "(GetSourceStartTime). GetSourceStartFrame() leaves ~27%% of cuts one "
            "frame early; GetLeftOffset() breaks retimed cuts."
        ),
    )
    p.add_argument(
        "--crop-to-fill",
        action="store_true",
        help="scale angle clips wider than the multicam to fill it (as the original "
             "multicam cropped) instead of Resolve's import-time letterbox",
    )
    p.add_argument(
        "--inpoint-epsilon",
        dest="inpoint_epsilon",
        default=None,
        help="nudge added to each patched in-point, in frames (default 0.001)",
    )
    p.add_argument(
        "--inpoint-rate",
        dest="inpoint_rate",
        type=float,
        default=24.0,
        help="frame rate of the multicam timebase for --inpoints (default 24)",
    )
    p.add_argument(
        "--allow-shortfall",
        action="store_true",
        help="downgrade 'trim does not cover the cuts' from fatal to a warning",
    )
    p.add_argument(
        "--no-gap-fixup",
        action="store_true",
        help="do not re-lay <gap> fillers inside touched angles",
    )
    return p


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        return run(args)
    except RetargetError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1


def run(args) -> int:
    doc = load_doc(args.infile)

    mappings = [parse_map_arg(m) for m in args.maps]
    if args.map_file:
        mappings.extend(load_map_file(args.map_file))

    if not mappings:
        # Verify-only / report-only mode.
        if args.report:
            print_report(doc, [])
        if args.verify:
            if not args.outfile:
                raise RetargetError("--verify without mappings needs --out to check")
            problems = verify(doc, load_doc(args.outfile))
            for p in problems:
                print(f"VERIFY FAIL: {p}", file=sys.stderr)
            if problems:
                return 1
            print(f"verify OK: {args.outfile} preserves the edit")
            return 0
        if args.inpoints:
            if not args.outfile:
                raise RetargetError("--inpoints needs --out")
            truth = parse_inpoint_file(args.inpoints)
            before = load_doc(args.infile)
            notes = patch_inpoints(doc, truth, Fraction(args.inpoint_rate).limit_denominator(1001),
                           None if args.inpoint_epsilon is None else Fraction(args.inpoint_epsilon))
            problems = verify(before, doc, allow_inpoint_changes=True)
            if problems:
                for pr in problems:
                    print(f"error: invariant violated: {pr}", file=sys.stderr)
                return 1
            for n in notes:
                print(n)
            if args.dry_run:
                print("--dry-run: nothing written")
                return 0
            data = serialize(doc)
            with open(args.outfile, "wb") as fh:
                fh.write(data)
            print(f"wrote {args.outfile} ({len(data)} bytes)")
            return 0
        if not args.report:
            raise RetargetError(
                "nothing to do: give --map / --map-file, --inpoints, --report or --verify"
            )
        return 0

    if not args.outfile and not args.dry_run:
        raise RetargetError("--out is required unless --dry-run")

    changes = plan_changes(doc, mappings)

    short = [c for c in changes if c.shortfall]
    if short and not args.allow_shortfall:
        for c in short:
            print(
                f"error: {c.asset_name}: the trimmed range does not cover the cuts that "
                f"use it (head handle {fmt_secs(c.head_handle)}s, tail handle "
                f"{fmt_secs(c.tail_handle)}s; needed "
                f"{format_time(c.required[0])}..{format_time(c.required[1])}, provided "
                f"{format_time(c.new_start)}.."
                f"{format_time(c.new_start + c.new_duration)})",
                file=sys.stderr,
            )
        print(
            "error: refusing to write; re-trim with wider handles or pass "
            "--allow-shortfall",
            file=sys.stderr,
        )
        return 1
    for c in short:
        print(f"warning: {c.asset_name}: trimmed range shortfall (allowed)", file=sys.stderr)

    if args.report:
        print_report(doc, changes)
        print("")

    # Snapshot what must not change, then mutate.
    before = load_doc(args.infile)
    notes = apply_changes(doc, changes, gap_fixup=not args.no_gap_fixup)

    if args.crop_to_fill:
        notes.extend(crop_to_fill(doc))
    if args.inpoints:
        truth = parse_inpoint_file(args.inpoints)
        notes.extend(
            patch_inpoints(doc, truth, Fraction(args.inpoint_rate).limit_denominator(1001),
                           None if args.inpoint_epsilon is None else Fraction(args.inpoint_epsilon))
        )

    problems = verify(before, doc, allow_inpoint_changes=bool(args.inpoints))
    if problems:
        for p in problems:
            print(f"error: invariant violated: {p}", file=sys.stderr)
        return 1

    print_change_table(changes, notes)

    if args.dry_run:
        print("--dry-run: nothing written")
        return 0

    data = serialize(doc)
    with open(args.outfile, "wb") as fh:
        fh.write(data)
    print(f"wrote {args.outfile} ({len(data)} bytes)")

    if args.verify:
        produced = load_doc(args.outfile)
        problems = verify(before, produced, allow_inpoint_changes=bool(args.inpoints))
        for p in problems:
            print(f"VERIFY FAIL: {p}", file=sys.stderr)
        if problems:
            return 1
        for c in changes:
            asset = produced.assets[c.asset_id]
            if asset.start != c.new_start or asset.duration != c.new_duration:
                print(f"VERIFY FAIL: asset {c.asset_id} time not applied", file=sys.stderr)
                return 1
            if file_url_to_path(asset.src) != c.new_path:
                print(f"VERIFY FAIL: asset {c.asset_id} path not applied", file=sys.stderr)
                return 1
        print(
            f"verify OK: {len(produced.mc_clips())} mc-clips, "
            f"{len(set(produced.mc_source_angle_ids()))} angleIDs, spine unchanged"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
