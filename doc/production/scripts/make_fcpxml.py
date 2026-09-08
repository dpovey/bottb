#!/usr/bin/env python3
"""
make_fcpxml.py — build a Final Cut Pro XML (.fcpxml) that drops one audio track per
stem into Logic Pro, each region placed at an exact show-timecode position.

    make_fcpxml.py <stem_folder> --file-start-tc HH:MM:SS:FF \
        [--project-start-tc HH:MM:SS:FF] [--fps 25] [--sample-rate 48000] -o out.fcpxml

Import in Logic: File › Import › Final Cut Pro XML… (or double-click the .fcpxml in the
All Files browser). Logic creates one audio track per clip, named from the clip `name`,
with the region at the clip `offset`. Verify with Event List in SMPTE units.

Python 3 stdlib only. WAV headers are parsed directly (RIFF/WAVE fmt + data chunks) because
the `wave` module rejects 24-bit / WAVE_FORMAT_EXTENSIBLE files.

What Logic Pro actually supports (researched 2026-08-30, Logic Pro 12.2 on macOS 26)
------------------------------------------------------------------------------------
Sources:
  [1] Apple, "Final Cut Pro XML files in Logic Pro for Mac" —
      https://support.apple.com/guide/logicpro/final-cut-pro-xml-files-lgcp9b2d2456/mac
      "The Final Cut Pro XML format is used to import and export audio data between Final
      Cut Pro X and Logic Pro. … Choose File > Import > Final Cut Pro XML, then choose the
      file in the Import dialog", or double-click it in the browser. "When you import
      Final Cut Pro sequences into Logic Pro, automation data—volume and pan, for
      example—is retained." Sample-rate mismatches prompt a convert-or-change dialog.
      (mirror: https://logicpro.skydocu.com/en/use-prerecorded-media/
      supported-media-and-file-formats/finalcutpro-xml-files/)
  [2] Apple, "Export a Logic Pro project as a Final Cut Pro XML file" —
      https://support.apple.com/guide/logicpro/lgcpc38ca549/mac
  [3] Logic Pro 12.2 application bundle (inspected locally):
      /Applications/Logic Pro.app/Contents/Resources/FinalCutProX_DTD_v1.0.dtd … v1.8.dtd
      — Logic ships DTDs for fcpxml 1.0–1.8 only, and its importer
      (MAVideo.framework: `claimedFCPXMLVersionInDocument:`, `FinalCutProX_DTD_v%@`)
      picks the DTD from the document's `version` attribute. So emit version="1.8"
      (highest bundled); 1.9/1.10/1.11/1.13 have no DTD in Logic and are not safe.
      MAVideo's string table contains exactly the elements/attributes it reads:
      asset, asset-clip, audio, clip, ref-clip, sync-clip, mc-clip, spine, sequence,
      lane, offset, start, duration, name, enabled, tcStart, tcFormat, audioRole, role,
      audioSources, audioChannels, audioRate, hasAudio, srcCh, outCh, adjust-volume,
      audio-channel-source, frameDuration. Logic's own exporter is
      `createFCPXMLEmptyDocWithProjectName:songStart:songDuration:sampleRate:format:
      isDropFrame:frameDuration:exportAsClip:`, i.e. it writes the song start into the
      sequence (tcStart) and uses a video `format` with a frameDuration.
  [4] FCPXML reference / time semantics — https://fcp.cafe/developers/fcpxml/ :
      time values are rational seconds ("N/Ds"), not frame counts; connected (anchored)
      clips carry a non-zero `lane`; a clip's timeline position is offset − sequence.tcStart.
  [5] Forum reports (Apple Community 8366777, 250791649, 253043602, 7110116;
      fcp.co 17954; ProVideo Coalition "Final Cut Pro X to Logic Pro X"; frame.io "The
      secret power of FCPX roles"): Logic "creates a track for each clip"; sub-roles land
      on separate tracks; some dual-mono clips come in as stereo; multicam audio is
      dropped; fades are not carried; media is referenced by path, not embedded, so the
      `src` URLs must resolve on the importing Mac; a known failure mode is a blank
      import (usually an unsupported version or unresolvable media).

Structure chosen
----------------
resources: one video-ish `format` (needed by the sequence; Logic's exporter writes one
too) and one `asset` per WAV (hasAudio=1, audioSources=1, audioChannels from the header,
audioRate=48000, absolute percent-encoded file:// src).
library › event › project › sequence(tcFormat=NDF, tcStart=0s) › spine › gap(full length)
with every stem as an `asset-clip` anchored to the gap on its own lane (lane=-1, -2, …
— negative lanes are FCP's convention for audio-only connected clips, which is what
Logic's importer sees from real FCP exports). Each clip: start=0s, duration=file length,
offset=(file start − project start), name=track name, audioRole=track name.

Why connected clips rather than sequential spine items: the stems all overlap in time
(same instant), and spine items are laid end to end. Lanes are how FCPXML expresses
"overlapping, separately addressable clips", and Logic makes one track per clip [5].
Each clip gets its own audioRole (same as the name) so that, if Logic groups by role
rather than by clip, the result is still one track per stem with the right name.

Timecode / project start
------------------------
Logic reads `tcStart` (it is in MAVideo's string table) but we could not confirm without a
real import whether it sets "Plays at SMPTE" or merely rebases clip offsets. To be
correct under either interpretation the script writes tcStart="0s" and offsets relative
to the project's bar 1 — i.e. --project-start-tc is subtracted from --file-start-tc. Use
00:00:00:00 for a whole-show project (Plays at SMPTE = 00:00:00:00) and the band's file
start TC for a per-band project (offset 0). `--sequence-tc absolute` instead writes
tcStart=project start and absolute offsets (strict FCP semantics) for experimentation.

Time values are rational seconds over the sample rate ("135537216/48000s"), never frame
rounded. Accept a start position as HH:MM:SS:FF (frame-rounded), "<secs>s", "<n>smp" or
a plain float (seconds) — pass seconds/samples when you know the sub-frame position
(e.g. Epsonics 2823.692s rather than 00:47:03:17 = 2823.68s).
"""

from __future__ import annotations

import argparse
import os
import re
import struct
import sys
from fractions import Fraction
from pathlib import Path
from urllib.parse import quote
from xml.sax.saxutils import escape, quoteattr

WAV_EXT = {".wav", ".wave", ".aif", ".aiff", ".caf"}  # only .wav headers are parsed


# ----------------------------------------------------------------------------- WAV header
def read_wav_info(path: Path) -> tuple[int, int, int, int]:
    """Return (channels, sample_rate, bits, frames) from a RIFF/WAVE header."""
    with path.open("rb") as f:
        riff = f.read(12)
        if len(riff) < 12 or riff[:4] not in (b"RIFF", b"RF64") or riff[8:12] != b"WAVE":
            raise ValueError(f"{path.name}: not a RIFF/WAVE file")
        is_rf64 = riff[:4] == b"RF64"
        ds64_data_size = None
        channels = rate = bits = block_align = None
        data_size = None
        while True:
            hdr = f.read(8)
            if len(hdr) < 8:
                break
            cid, csize = struct.unpack("<4sI", hdr)
            if cid == b"ds64" and is_rf64:
                body = f.read(csize)
                _riff_size, ds64_data_size = struct.unpack("<QQ", body[:16])
                continue
            if cid == b"fmt ":
                body = f.read(csize)
                fmt_tag, channels, rate, _byte_rate, block_align, bits = struct.unpack(
                    "<HHIIHH", body[:16]
                )
                if fmt_tag == 0xFFFE and len(body) >= 26:  # WAVE_FORMAT_EXTENSIBLE
                    fmt_tag = struct.unpack("<H", body[24:26])[0]
                if fmt_tag not in (1, 3):
                    raise ValueError(f"{path.name}: unsupported WAV format tag {fmt_tag:#x}")
                if csize % 2:
                    f.seek(1, os.SEEK_CUR)
                continue
            if cid == b"data":
                data_size = ds64_data_size if (is_rf64 and csize == 0xFFFFFFFF) else csize
                break
            f.seek(csize + (csize % 2), os.SEEK_CUR)
    if channels is None or data_size is None:
        raise ValueError(f"{path.name}: missing fmt or data chunk")
    frames = data_size // block_align
    return channels, rate, bits, frames


# ----------------------------------------------------------------------------- time parsing
_TC_RE = re.compile(r"^(\d{1,2}):(\d{2}):(\d{2})[:;](\d{1,2})$")


def parse_position(text: str, fps: Fraction, sample_rate: int) -> int:
    """Parse HH:MM:SS:FF | '<secs>s' | '<n>smp' | '<float>' → integer samples."""
    text = text.strip()
    m = _TC_RE.match(text)
    if m:
        h, mi, s, ff = (int(g) for g in m.groups())
        if ff >= fps:
            raise ValueError(f"frame {ff} >= fps {fps}")
        secs = Fraction(h * 3600 + mi * 60 + s) + Fraction(ff) / fps
        return round(secs * sample_rate)
    if text.endswith("smp"):
        return int(text[:-3])
    if text.endswith("s"):
        text = text[:-1]
    return round(Fraction(text) * sample_rate)


def samples_to_tc(samples: int, fps: Fraction, sample_rate: int) -> str:
    secs = Fraction(samples, sample_rate)
    sign = "-" if secs < 0 else ""
    secs = abs(secs)
    whole = int(secs)
    frames = int((secs - whole) * fps)
    return f"{sign}{whole // 3600:02d}:{whole % 3600 // 60:02d}:{whole % 60:02d}:{frames:02d}"


def rational(samples: int, sample_rate: int) -> str:
    return "0s" if samples == 0 else f"{samples}/{sample_rate}s"


# ----------------------------------------------------------------------------- naming
_PREFIX_RE = re.compile(r"^\s*\d+[\s_.-]*")


def track_name(path: Path) -> str:
    name = _PREFIX_RE.sub("", path.stem).strip()
    return name or path.stem


def natural_key(p: Path):
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", p.name)]


# ----------------------------------------------------------------------------- main
def build(args: argparse.Namespace) -> tuple[str, list[dict]]:
    folder = Path(args.stem_folder).expanduser().resolve()
    if not folder.is_dir():
        sys.exit(f"not a directory: {folder}")
    fps = Fraction(args.fps)
    sr = args.sample_rate
    files = sorted(
        (p for p in folder.iterdir() if p.suffix.lower() == ".wav" and not p.name.startswith("._")),
        key=natural_key,
    )
    if not files:
        sys.exit(f"no .wav files in {folder}")

    file_start = parse_position(args.file_start_tc, fps, sr)
    project_start = parse_position(args.project_start_tc, fps, sr)
    rel = file_start - project_start
    seq_tc_start = project_start if args.sequence_tc == "absolute" else 0
    clip_offset = file_start if args.sequence_tc == "absolute" else rel

    rows = []
    for p in files:
        ch, rate, bits, frames = read_wav_info(p)
        if rate != sr:
            print(f"warning: {p.name} is {rate} Hz, expected {sr}", file=sys.stderr)
        rows.append(dict(path=p, name=track_name(p), channels=ch, bits=bits, frames=frames))

    start_trim = 0
    offset = clip_offset
    if offset < seq_tc_start:  # region would start before bar 1: trim its head
        start_trim = seq_tc_start - offset
        offset = seq_tc_start
        print(
            f"warning: file start is {rational(start_trim, sr)} before project start; "
            "trimming region heads",
            file=sys.stderr,
        )

    band = folder.name
    # FCP writes frame durations over a 100x denominator (25 fps → 100/2500s); mimic that.
    fd = Fraction(1, 1) / fps
    frame_duration = f"{fd.numerator * 100}/{fd.denominator * 100}s"

    seq_end = max(offset + (r["frames"] - start_trim) for r in rows)
    seq_dur = seq_end - seq_tc_start

    L: list[str] = []
    a = L.append
    a('<?xml version="1.0" encoding="UTF-8"?>')
    a("<!DOCTYPE fcpxml>")
    a(f'<fcpxml version="{args.version}">')
    a("  <resources>")
    a(
        f'    <format id="r1" name="FFVideoFormat1080p{int(fps) if fps.denominator == 1 else fps}" '
        f'frameDuration="{frame_duration}" width="1920" height="1080"/>'
    )
    for i, r in enumerate(rows, start=2):
        src = "file://" + quote(str(r["path"]), safe="/")
        a(
            f'    <asset id="r{i}" name={quoteattr(r["name"])} src={quoteattr(src)} '
            f'start="0s" duration="{rational(r["frames"], sr)}" hasVideo="0" hasAudio="1" '
            f'audioSources="1" audioChannels="{r["channels"]}" audioRate="{sr}"/>'
        )
        r["id"] = f"r{i}"
    a("  </resources>")
    a("  <library>")
    a(f"    <event name={quoteattr(band)}>")
    a(f"      <project name={quoteattr(band + ' stems')}>")
    a(
        f'        <sequence format="r1" duration="{rational(seq_dur, sr)}" '
        f'tcStart="{rational(seq_tc_start, sr)}" tcFormat="NDF" '
        f'audioLayout="stereo" audioRate="{sr // 1000}k">'
    )
    a("          <spine>")
    a(
        f'            <gap name="Gap" offset="{rational(seq_tc_start, sr)}" start="0s" '
        f'duration="{rational(seq_dur, sr)}">'
    )
    for lane, r in enumerate(rows, start=1):
        dur = r["frames"] - start_trim
        a(
            f'              <asset-clip ref="{r["id"]}" lane="-{lane}" '
            f'offset="{rational(offset, sr)}" name={quoteattr(r["name"])} '
            f'start="{rational(start_trim, sr)}" duration="{rational(dur, sr)}" '
            f'audioRole={quoteattr(r["name"])}/>'
        )
        r["offset"] = offset
        r["duration"] = dur
    a("            </gap>")
    a("          </spine>")
    a("        </sequence>")
    a("      </project>")
    a("    </event>")
    a("  </library>")
    a("</fcpxml>")
    xml = "\n".join(L) + "\n"

    meta = dict(
        file_start=file_start,
        project_start=project_start,
        rel=rel,
        offset=offset,
        start_trim=start_trim,
        fps=fps,
        sr=sr,
        band=band,
    )
    return xml, rows, meta  # type: ignore[return-value]


def print_summary(rows, meta) -> None:
    sr, fps = meta["sr"], meta["fps"]
    print(f"band: {meta['band']}   files: {len(rows)}   fps: {fps}   sample rate: {sr}")
    print(
        f"file start : {samples_to_tc(meta['file_start'], fps, sr)}  "
        f"= {Fraction(meta['file_start'], sr)} s ({meta['file_start']} smp)"
    )
    print(
        f"proj start : {samples_to_tc(meta['project_start'], fps, sr)}  "
        f"= {Fraction(meta['project_start'], sr)} s ({meta['project_start']} smp)"
    )
    off = meta["offset"]
    print(
        f"region pos : {float(Fraction(off, sr)):.6f} s from bar 1 = {rational(off, sr)} "
        f"({samples_to_tc(off, fps, sr)} rel)"
        + (f"; head trimmed {meta['start_trim']} smp" if meta["start_trim"] else "")
    )
    print()
    w = max(len(r["path"].name) for r in rows)
    print(f"{'file':<{w}}  {'track':<14} ch  bits  {'samples':>10}  {'offset s':>12}  offset rational")
    for r in rows:
        print(
            f"{r['path'].name:<{w}}  {r['name']:<14} {r['channels']:>2}  {r['bits']:>4}  "
            f"{r['frames']:>10}  {float(Fraction(r['offset'], sr)):>12.6f}  {rational(r['offset'], sr)}"
        )


def main(argv=None) -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0], formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("stem_folder", help="folder of WAV stems (one per track, all starting at the same instant)")
    ap.add_argument(
        "--file-start-tc",
        required=True,
        help="show TC where sample 0 of every stem sits: HH:MM:SS:FF, '<secs>s', '<n>smp' or a float",
    )
    ap.add_argument(
        "--project-start-tc",
        default="00:00:00:00",
        help="Logic project's 'Plays at SMPTE' (bar 1). Same forms as --file-start-tc. Default 00:00:00:00",
    )
    ap.add_argument("--fps", default="25", help="timecode frame rate (default 25)")
    ap.add_argument("--sample-rate", type=int, default=48000, help="project/stem sample rate (default 48000)")
    ap.add_argument(
        "--sequence-tc",
        choices=("relative", "absolute"),
        default="relative",
        help="relative (default): tcStart=0s, offsets relative to bar 1. absolute: tcStart=project start, absolute offsets",
    )
    ap.add_argument("--version", default="1.8", help="fcpxml version attribute (Logic 12.2 bundles DTDs up to 1.8)")
    ap.add_argument("-o", "--output", required=True, help="output .fcpxml path")
    ap.add_argument("-q", "--quiet", action="store_true", help="no summary table")
    args = ap.parse_args(argv)

    xml, rows, meta = build(args)  # type: ignore[misc]
    out = Path(args.output).expanduser()
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(xml, encoding="utf-8")
    if not args.quiet:
        print_summary(rows, meta)
        print(f"\nwrote {out}")


if __name__ == "__main__":
    main()
