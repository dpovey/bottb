#!/usr/bin/env python3
"""Unit tests for fcpxml_retarget.py.  Run: python3 -m unittest -v."""

from __future__ import annotations

import contextlib
import io
import os
import sys
import tempfile
import unittest
import xml.etree.ElementTree as ET
from fractions import Fraction

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import fcpxml_retarget as fr  # noqa: E402


# --------------------------------------------------------------------------
# A miniature but structurally faithful FCPXML.
#
# Numbers for the "Full Stage" angle are the real CAM A ones from the Melbourne
# 2026 Jumbo timeline:
#   old_offset 11611/24s = 483.792s, old_start 29963/12s = 2496.917s
#   the band's first cut sits at multicam start 56549/8s = 7068.625s, i.e.
#   3468.625s into the angle (tcStart is 3600s).
# The "Roving Camera" angle is 25 fps (CAM D, C86xx.MP4) inside a 24 fps
# multicam, which is the rate trap this tool has to get right.
# --------------------------------------------------------------------------

ANGLE_A = "0e5c29f9-9dc5-41e7-89b2-9cae8ea93a23"  # Full Stage, 24 fps
ANGLE_D = "03db14e2-fdc9-4962-b124-2b73ef6514ea"  # Roving Camera, 25 fps

FIXTURE = """<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.10">
    <resources>
        <format width="3840" frameDuration="1/24s" id="r0" height="2160" name="FFVideoFormat3840x2160p24"/>
        <format width="3840" frameDuration="1/25s" id="r1" height="2160" name="FFVideoFormat3840x2160p25"/>
        <format width="4096" frameDuration="1/24s" id="r12" height="2160" name="FFVideoFormat4096x2160p24"/>
        <media id="r16" name="A001_05200041_C001 Multicam">
            <multicam format="r0" tcStart="3600/1s" tcFormat="NDF">
                <mc-angle angleID="{d}" name="Roving Camera">
                    <gap offset="0/1s" duration="9457/12s" start="3600/1s" name="Gap"/>
                    <asset-clip offset="9457/12s" duration="8363/24s" format="r1" start="1829861/25s" ref="r2" name="C8666.MP4" tcFormat="NDF" enabled="1">
                        <adjust-transform scale="1 1" anchor="0 0" position="0 0"/>
                    </asset-clip>
                </mc-angle>
                <mc-angle angleID="{a}" name="Full Stage">
                    <gap offset="0/1s" duration="11611/24s" start="3600/1s" name="Gap"/>
                    <asset-clip offset="11611/24s" duration="19115/2s" format="r12" start="29963/12s" ref="r13" name="A001_05200041_C001.braw" tcFormat="NDF" enabled="1">
                        <adjust-transform scale="1 1" anchor="0 0" position="0 0"/>
                    </asset-clip>
                </mc-angle>
            </multicam>
        </media>
        <asset duration="8712/25s" format="r1" start="1829861/25s" id="r2" hasVideo="1" name="C8666.MP4">
            <media-rep src="file:///Volumes/Battle%20Of%20Band%202025/Video/CAM%20D/CLIP/C8666.MP4" kind="original-media"/>
        </asset>
        <asset duration="19115/2s" format="r12" start="29963/12s" id="r13" hasVideo="1" name="A001_05200041_C001.braw">
            <media-rep src="file:///Volumes/Battle%20Of%20Band%202025/Video/CAM%20A/A001_05200041_C001.braw" kind="original-media"/>
        </asset>
    </resources>
    <library>
        <event name="Timeline 1 (Resolve)">
            <project name="Timeline 1 (Resolve)">
                <sequence format="r0" duration="6711/4s" tcStart="0/1s" tcFormat="NDF">
                    <spine>
                        <mc-clip offset="0/1s" duration="60/1s" start="56549/8s" ref="r16" name="A001_05200041_C001 Multicam">
                            <mc-source srcEnable="video" angleID="{a}"/>
                        </mc-clip>
                        <mc-clip offset="60/1s" duration="30/1s" start="56909/8s" ref="r16" name="A001_05200041_C001 Multicam">
                            <mc-source srcEnable="video" angleID="{d}"/>
                        </mc-clip>
                    </spine>
                </sequence>
            </project>
        </event>
    </library>
</fcpxml>
""".format(a=ANGLE_A, d=ANGLE_D)

# The band's first cut, in angle-local seconds (mc-clip start minus tcStart).
BAND_START = Fraction(56549, 8) - 3600  # 3468.625
CAM_A_TRIM_START_TC = "01:31:19:18"  # 5479.75s -- two seconds of handle


def write_fixture(tmpdir: str, name: str = "Info.fcpxml") -> str:
    path = os.path.join(tmpdir, name)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(FIXTURE)
    return path


class TempDocMixin(unittest.TestCase):
    def cli(self, argv):
        """Run the CLI with stdout captured, so tests stay quiet."""
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(io.StringIO()):
            rc = fr.main(argv)
        self.last_stdout = buf.getvalue()
        return rc

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.infile = write_fixture(self.tmp.name)
        self.outfile = os.path.join(self.tmp.name, "out.fcpxml")

    def doc(self):
        return fr.load_doc(self.infile)


# --------------------------------------------------------------------------
# Rational arithmetic
# --------------------------------------------------------------------------


class TestRationalTime(unittest.TestCase):
    def test_parse_forms(self):
        self.assertEqual(fr.parse_time("2387/6s"), Fraction(2387, 6))
        self.assertEqual(fr.parse_time("0/1s"), Fraction(0))
        self.assertEqual(fr.parse_time("3600/1s"), Fraction(3600))
        self.assertEqual(fr.parse_time("16s"), Fraction(16))
        self.assertEqual(fr.parse_time("-5/2s"), Fraction(-5, 2))

    def test_format_is_reduced(self):
        self.assertEqual(fr.format_time(Fraction(11611, 24)), "11611/24s")
        self.assertEqual(fr.format_time(Fraction(24, 48)), "1/2s")
        self.assertEqual(fr.format_time(Fraction(0)), "0/1s")
        self.assertEqual(fr.format_time(Fraction(3600)), "3600/1s")

    def test_round_trip_exact(self):
        for s in ("2387/6s", "11611/24s", "1897106/25s", "301529/24s", "639644/375s"):
            self.assertEqual(fr.format_time(fr.parse_time(s)), s)

    def test_no_float_drift(self):
        # 1/3 of a second added 3 times must be exactly 1 second.
        third = fr.parse_time("1/3s")
        self.assertEqual(third * 3, Fraction(1))
        self.assertEqual(fr.format_time(third * 3), "1/1s")

    def test_mixed_denominator_arithmetic(self):
        # 24 fps offset + 25 fps delta stays exact.
        result = Fraction(83471, 24) + (Fraction(1897056, 25) - Fraction(1897106, 25))
        self.assertEqual(result, Fraction(83423, 24))
        self.assertEqual(fr.format_time(result), "83423/24s")

    def test_bad_values_raise(self):
        for bad in ("", "abc", "1/0s", "12//3s"):
            with self.assertRaises(fr.RetargetError):
                fr.parse_time(bad)


# --------------------------------------------------------------------------
# Timecode, including 24 vs 25 fps
# --------------------------------------------------------------------------


class TestTimecode(unittest.TestCase):
    def test_cam_a_24fps(self):
        # (1*3600 + 31*60 + 19) * 24 + 18 = 131514 frames = 5479.75s
        self.assertEqual(
            fr.parse_timecode(CAM_A_TRIM_START_TC, Fraction(24)), Fraction(21919, 4)
        )
        self.assertEqual(float(fr.parse_timecode(CAM_A_TRIM_START_TC, Fraction(24))), 5479.75)

    def test_same_timecode_differs_by_rate(self):
        at24 = fr.parse_timecode("00:00:10:12", Fraction(24))
        at25 = fr.parse_timecode("00:00:10:12", Fraction(25))
        self.assertEqual(at24, Fraction(10) + Fraction(12, 24))
        self.assertEqual(at25, Fraction(10) + Fraction(12, 25))
        self.assertNotEqual(at24, at25)

    def test_cam_d_25fps_round_trip(self):
        # asset C8666.MP4 starts at 1829861/25s -> 20:19:54:11 at 25 fps.
        secs = Fraction(1829861, 25)
        self.assertEqual(fr.seconds_to_timecode(secs, Fraction(25)), "20:19:54:11")
        self.assertEqual(fr.parse_timecode("20:19:54:11", Fraction(25)), secs)

    def test_duration_timecode(self):
        self.assertEqual(fr.parse_timecode("00:02:04:00", Fraction(24)), Fraction(124))

    def test_frame_out_of_range(self):
        with self.assertRaises(fr.RetargetError):
            fr.parse_timecode("00:00:01:25", Fraction(25))
        # ...but 24 is a legal frame at 25 fps.
        self.assertEqual(
            fr.parse_timecode("00:00:01:24", Fraction(25)), Fraction(1) + Fraction(24, 25)
        )

    def test_drop_frame_rejected(self):
        with self.assertRaises(fr.RetargetError) as cm:
            fr.parse_timecode("01:00:00;00", Fraction(24))
        self.assertIn("drop-frame", str(cm.exception))

    def test_malformed(self):
        for bad in ("1:2:3", "aa:bb:cc:dd", "01:99:00:00", ""):
            with self.assertRaises(fr.RetargetError):
                fr.parse_timecode(bad, Fraction(24))

    def test_off_grid_marked(self):
        # A 24 fps duration landing on a 25 fps source is not frame aligned.
        self.assertTrue(fr.seconds_to_timecode(Fraction(1, 3), Fraction(25)).endswith("*"))
        self.assertFalse(fr.seconds_to_timecode(Fraction(2), Fraction(25)).endswith("*"))


# --------------------------------------------------------------------------
# Document parsing, rate inference
# --------------------------------------------------------------------------


class TestDocModel(TempDocMixin):
    def test_angles_and_assets(self):
        doc = self.doc()
        self.assertEqual(doc.tc_start, Fraction(3600))
        self.assertEqual(doc.angle_ids(), [ANGLE_D, ANGLE_A])
        self.assertEqual(len(doc.mc_clips()), 2)
        self.assertEqual(doc.assets["r13"].start, Fraction(29963, 12))

    def test_rate_inferred_per_asset(self):
        doc = self.doc()
        self.assertEqual(doc.assets["r13"].rate, Fraction(24))  # r12 = 1/24s
        self.assertEqual(doc.assets["r2"].rate, Fraction(25))  # r1  = 1/25s

    def test_lookup_by_id_name_and_basename(self):
        doc = self.doc()
        for key in ("r13", "A001_05200041_C001.braw"):
            self.assertEqual(len(doc.find_angle_clips(key)), 1)
            self.assertEqual(doc.find_angle_clips(key)[0].asset_id, "r13")
        self.assertEqual(doc.find_angle_clips("C8666.MP4")[0].asset_id, "r2")

    def test_used_ranges_from_spine(self):
        doc = self.doc()
        used = fr.used_angle_intervals(doc)
        self.assertEqual(used[ANGLE_A], [(BAND_START, BAND_START + 60)])
        clip = doc.find_angle_clips("r13")[0]
        lo, hi = fr.required_source_range(doc, clip, used)
        # 2496.917 + (3468.625 - 483.792) = 5481.75  == 01:31:21:18 @24
        self.assertEqual(lo, Fraction(21927, 4))
        self.assertEqual(fr.seconds_to_timecode(lo, Fraction(24)), "01:31:21:18")
        self.assertEqual(hi - lo, Fraction(60))

    def test_serialize_round_trip_is_byte_identical(self):
        doc = self.doc()
        self.assertEqual(fr.serialize(doc), FIXTURE.encode("utf-8"))


# --------------------------------------------------------------------------
# The offset formula -- the load-bearing arithmetic
# --------------------------------------------------------------------------


class TestOffsetFormula(TempDocMixin):
    def plan(self, **over):
        spec = dict(
            key="A001_05200041_C001.braw",
            path="/trim/A001.braw",
            start=CAM_A_TRIM_START_TC,
            duration="00:28:21:10",
        )
        spec.update(over)
        return fr.plan_changes(self.doc(), [fr.Mapping(**spec)])

    def test_verified_cam_a_numbers(self):
        (ch,) = self.plan()
        self.assertEqual(ch.old_offset, Fraction(11611, 24))
        self.assertEqual(float(ch.old_offset), 483.7916666666667)
        self.assertEqual(ch.old_start, Fraction(29963, 12))
        self.assertEqual(float(ch.old_start), 2496.9166666666665)
        self.assertEqual(ch.new_start, Fraction(21919, 4))  # 5479.75
        # 483.792 + (5479.75 - 2496.917) == 3466.625 == 27733/8
        self.assertEqual(ch.new_offset, Fraction(27733, 8))
        self.assertEqual(float(ch.new_offset), 3466.625)

    def test_handle_is_exactly_two_seconds(self):
        (ch,) = self.plan()
        self.assertEqual(BAND_START - ch.new_offset, Fraction(2))
        self.assertEqual(ch.head_handle, Fraction(2))  # 48 frames @ 24 fps
        self.assertEqual(ch.head_handle * 24, 48)

    def test_new_duration_is_the_trimmed_duration(self):
        (ch,) = self.plan(duration="00:02:04:00")
        self.assertEqual(ch.new_duration, Fraction(124))

    def test_accepts_rational_and_plain_seconds(self):
        (a,) = self.plan(start="131514/24s", duration="124/1s")
        (b,) = self.plan(start=5479.75, duration=124)
        (c,) = self.plan(duration="00:02:04:00")
        self.assertEqual(a.new_offset, c.new_offset)
        self.assertEqual(b.new_offset, c.new_offset)
        self.assertEqual(a.new_duration, Fraction(124))

    def test_rate_override_changes_the_result(self):
        (at24,) = self.plan()
        (at25,) = self.plan(rate=Fraction(25))
        self.assertNotEqual(at24.new_start, at25.new_start)
        self.assertEqual(at25.new_start, fr.parse_timecode(CAM_A_TRIM_START_TC, Fraction(25)))


class TestTwentyFiveFps(TempDocMixin):
    def plan(self, **over):
        spec = dict(key="C8666.MP4", path="/trim/C8666.MP4", start="20:19:52:11", duration="00:05:00:00")
        spec.update(over)
        return fr.plan_changes(self.doc(), [fr.Mapping(**spec)])

    def test_rate_comes_from_the_assets_own_format(self):
        (ch,) = self.plan()
        self.assertEqual(ch.rate, Fraction(25))
        # 20:19:52:11 @25 is exactly 2s before the original start 1829861/25s.
        self.assertEqual(ch.new_start, Fraction(1829811, 25))
        self.assertEqual(ch.old_start - ch.new_start, Fraction(2))

    def test_offset_shift_is_exact_across_rates(self):
        # angle offset is on the 24 fps multicam grid, start on the 25 fps grid.
        (ch,) = self.plan()
        self.assertEqual(ch.old_offset, Fraction(9457, 12))
        self.assertEqual(ch.new_offset, Fraction(9457, 12) - 2)
        self.assertEqual(ch.new_offset, Fraction(9433, 12))

    def test_misreading_it_as_24fps_would_be_wrong(self):
        (at25,) = self.plan()
        (at24,) = self.plan(rate=Fraction(24))
        self.assertNotEqual(at25.new_offset, at24.new_offset)
        # the 11-frame difference between the grids
        self.assertEqual(at24.new_start - at25.new_start, Fraction(11, 24) - Fraction(11, 25))

    def test_duration_of_25fps_trim(self):
        (ch,) = self.plan(duration="00:05:00:00")
        self.assertEqual(ch.new_duration, Fraction(300))


# --------------------------------------------------------------------------
# Validation: must fail loudly
# --------------------------------------------------------------------------


class TestValidation(TempDocMixin):
    def plan(self, **over):
        spec = dict(
            key="A001_05200041_C001.braw",
            path="/trim/A001.braw",
            start=CAM_A_TRIM_START_TC,
            duration="00:28:21:10",
        )
        spec.update(over)
        return fr.plan_changes(self.doc(), [fr.Mapping(**spec)])

    def test_unknown_asset(self):
        with self.assertRaises(fr.RetargetError) as cm:
            self.plan(key="NOPE.braw")
        self.assertIn("not found", str(cm.exception))

    def test_asset_not_in_any_angle(self):
        # An asset id that exists nowhere at all.
        with self.assertRaises(fr.RetargetError):
            self.plan(key="r999")

    def test_negative_offset_rejected(self):
        # A trim starting far earlier than the original start pushes the angle
        # offset below zero, which is nonsense.
        with self.assertRaises(fr.RetargetError) as cm:
            self.plan(start="00:00:10:00")
        self.assertIn("negative", str(cm.exception))

    def test_zero_or_negative_duration_rejected(self):
        with self.assertRaises(fr.RetargetError):
            self.plan(duration="00:00:00:00")
        with self.assertRaises(fr.RetargetError):
            self.plan(duration="-5/1s")

    def test_duplicate_mapping_rejected(self):
        m = fr.Mapping("r13", "/a.braw", CAM_A_TRIM_START_TC, "00:28:21:10")
        m2 = fr.Mapping("A001_05200041_C001.braw", "/b.braw", CAM_A_TRIM_START_TC, "00:28:21:10")
        with self.assertRaises(fr.RetargetError) as cm:
            fr.plan_changes(self.doc(), [m, m2])
        self.assertIn("mapped twice", str(cm.exception))

    def test_shortfall_detected_head(self):
        # Trim starts *after* the first cut needs it.
        (ch,) = self.plan(start="01:31:30:00")
        self.assertTrue(ch.shortfall)
        self.assertLess(ch.head_handle, 0)

    def test_shortfall_detected_tail(self):
        (ch,) = self.plan(duration="00:00:30:00")  # far shorter than the cuts need
        self.assertTrue(ch.shortfall)
        self.assertLess(ch.tail_handle, 0)

    def test_exact_cover_is_not_a_shortfall(self):
        # Start exactly at the first needed frame, duration exactly the cut.
        (ch,) = self.plan(start="01:31:21:18", duration="00:01:00:00")
        self.assertEqual(ch.head_handle, Fraction(0))
        self.assertEqual(ch.tail_handle, Fraction(0))
        self.assertFalse(ch.shortfall)

    def test_cli_refuses_to_write_on_shortfall(self):
        rc = self.cli(
            [
                "--in", self.infile, "--out", self.outfile,
                "--map", "A001_05200041_C001.braw=/trim/A001.braw@01:31:30:00+00:01:00:00",
            ]
        )
        self.assertEqual(rc, 1)
        self.assertFalse(os.path.exists(self.outfile))

    def test_cli_allow_shortfall_writes(self):
        rc = self.cli(
            [
                "--in", self.infile, "--out", self.outfile, "--allow-shortfall",
                "--map", "A001_05200041_C001.braw=/trim/A001.braw@01:31:30:00+00:10:00:00",
            ]
        )
        self.assertEqual(rc, 0)
        self.assertTrue(os.path.exists(self.outfile))


class TestMapParsing(unittest.TestCase):
    def test_basic(self):
        m = fr.parse_map_arg(
            "A001_05200041_C001.braw=/path/to/trimmed/A001.braw@01:31:19:18+00:02:04:00"
        )
        self.assertEqual(m.key, "A001_05200041_C001.braw")
        self.assertEqual(m.path, "/path/to/trimmed/A001.braw")
        self.assertEqual(m.start, "01:31:19:18")
        self.assertEqual(m.duration, "00:02:04:00")
        self.assertIsNone(m.rate)

    def test_rate_suffix(self):
        m = fr.parse_map_arg("C8670.MP4=/t/C8670.MP4@21:04:42:06+00:28:16:11#25")
        self.assertEqual(m.rate, Fraction(25))
        self.assertEqual(m.duration, "00:28:16:11")

    def test_path_may_contain_at_and_equals(self):
        m = fr.parse_map_arg("r13=/Vol/a=b@c/A001.braw@01:00:00:00+00:00:10:00")
        self.assertEqual(m.path, "/Vol/a=b@c/A001.braw")
        self.assertEqual(m.start, "01:00:00:00")

    def test_malformed(self):
        for bad in (
            "no-equals-sign",
            "key=/path@01:00:00:00",       # no duration
            "key=/path+00:00:10:00",       # no start
            "=/path@01:00:00:00+00:00:10:00",
            "key=@01:00:00:00+00:00:10:00",
        ):
            with self.assertRaises(fr.RetargetError):
                fr.parse_map_arg(bad)


class TestMapFile(TempDocMixin):
    def write_json(self, text: str) -> str:
        p = os.path.join(self.tmp.name, "map.json")
        with open(p, "w", encoding="utf-8") as fh:
            fh.write(text)
        return p

    def test_list_form(self):
        p = self.write_json(
            '{"version":1,"mappings":[{"asset":"r13","path":"/t/a.braw",'
            '"start":"01:31:19:18","duration":"00:28:21:10"}]}'
        )
        (m,) = fr.load_map_file(p)
        self.assertEqual(m.key, "r13")
        self.assertEqual(m.path, "/t/a.braw")

    def test_object_form_and_rate(self):
        p = self.write_json(
            '{"mappings":{"C8666.MP4":{"path":"/t/c.MP4","start":"20:19:52:11",'
            '"duration":"00:05:00:00","rate":25}}}'
        )
        (m,) = fr.load_map_file(p)
        self.assertEqual(m.key, "C8666.MP4")
        self.assertEqual(m.rate, Fraction(25))

    def test_missing_fields_raise(self):
        for text in (
            '{"mappings":[{"path":"/t/a.braw","start":"01:00:00:00","duration":"00:00:10:00"}]}',
            '{"mappings":[{"asset":"r13","start":"01:00:00:00","duration":"00:00:10:00"}]}',
            '{"mappings":[{"asset":"r13","path":"/t/a.braw","duration":"00:00:10:00"}]}',
            '{"mappings":[{"asset":"r13","path":"/t/a.braw","start":"01:00:00:00"}]}',
            '{"nope":[]}',
        ):
            with self.assertRaises(fr.RetargetError):
                fr.load_map_file(self.write_json(text))

    def test_bad_json(self):
        with self.assertRaises(fr.RetargetError):
            fr.load_map_file(self.write_json("{not json"))


# --------------------------------------------------------------------------
# Applying changes, gap fixup, verification
# --------------------------------------------------------------------------


class TestApplyAndVerify(TempDocMixin):
    def run_cli(self, *extra):
        return self.cli(
            [
                "--in", self.infile, "--out", self.outfile,
                "--map",
                "A001_05200041_C001.braw=/Volumes/Archive/A001_S001.braw"
                "@01:31:19:18+00:28:21:10",
                *extra,
            ]
        )

    def test_writes_and_verifies(self):
        self.assertEqual(self.run_cli("--verify"), 0)
        out = fr.load_doc(self.outfile)
        clip = out.find_angle_clips("r13")[0]
        self.assertEqual(clip.offset, Fraction(27733, 8))
        self.assertEqual(clip.start, Fraction(21919, 4))
        self.assertEqual(out.assets["r13"].start, Fraction(21919, 4))
        self.assertEqual(out.assets["r13"].duration, clip.duration)
        self.assertEqual(
            out.assets["r13"].src, "file:///Volumes/Archive/A001_S001.braw"
        )

    def test_angle_ids_and_spine_untouched(self):
        self.run_cli()
        src = fr.load_doc(self.infile)
        out = fr.load_doc(self.outfile)
        self.assertEqual(fr.verify(src, out), [])
        self.assertEqual(src.angle_ids(), out.angle_ids())
        self.assertEqual(src.mc_source_angle_ids(), out.mc_source_angle_ids())
        self.assertEqual(
            ET.tostring(src.spine, encoding="unicode"),
            ET.tostring(out.spine, encoding="unicode"),
        )
        # And literally: every angleID string survives into the output bytes.
        raw = open(self.outfile, encoding="utf-8").read()
        for aid in (ANGLE_A, ANGLE_D):
            self.assertEqual(raw.count(aid), FIXTURE.count(aid))

    def test_untouched_angle_is_byte_identical(self):
        self.run_cli()
        before = FIXTURE.split('name="Roving Camera">')[1].split("</mc-angle>")[0]
        after = (
            open(self.outfile, encoding="utf-8")
            .read()
            .split('name="Roving Camera">')[1]
            .split("</mc-angle>")[0]
        )
        self.assertEqual(before, after)

    def test_gap_fixup_keeps_angle_contiguous(self):
        self.run_cli()
        out = fr.load_doc(self.outfile)
        angle = next(a for a in out.angles if a.angle_id == ANGLE_A)
        cursor = Fraction(0)
        for child in angle.el:
            self.assertEqual(fr.parse_time(child.get("offset")), cursor)
            cursor += fr.parse_time(child.get("duration"))
        gap = angle.el[0]
        self.assertEqual(gap.tag, "gap")
        self.assertEqual(fr.parse_time(gap.get("duration")), Fraction(27733, 8))

    def test_no_gap_fixup_leaves_the_gap_alone(self):
        self.run_cli("--no-gap-fixup")
        out = fr.load_doc(self.outfile)
        angle = next(a for a in out.angles if a.angle_id == ANGLE_A)
        self.assertEqual(fr.parse_time(angle.el[0].get("duration")), Fraction(11611, 24))

    def test_leading_gap_created_when_absent(self):
        doc = self.doc()
        angle = next(a for a in doc.angles if a.angle_id == ANGLE_A)
        angle.el.remove(angle.el[0])  # drop the existing gap
        angle.clips[0].el.set("offset", "0/1s")
        angle.clips[0].offset = Fraction(0)
        changes = fr.plan_changes(
            doc,
            [fr.Mapping("r13", "/t/a.braw", "02:00:00:00", "01:00:00:00")],
        )
        fr.apply_changes(doc, changes)
        self.assertEqual(angle.el[0].tag, "gap")
        self.assertEqual(
            fr.parse_time(angle.el[0].get("duration")), changes[0].new_offset
        )

    def test_dry_run_writes_nothing(self):
        self.assertEqual(self.run_cli("--dry-run"), 0)
        self.assertFalse(os.path.exists(self.outfile))

    def test_verify_catches_a_tampered_spine(self):
        self.run_cli()
        raw = open(self.outfile, encoding="utf-8").read()
        raw = raw.replace('<mc-clip offset="60/1s" duration="30/1s"', '<mc-clip offset="60/1s" duration="31/1s"')
        with open(self.outfile, "w", encoding="utf-8") as fh:
            fh.write(raw)
        problems = fr.verify(fr.load_doc(self.infile), fr.load_doc(self.outfile))
        self.assertTrue(any("spine" in p for p in problems))

    def test_verify_catches_a_changed_angle_id(self):
        self.run_cli()
        raw = open(self.outfile, encoding="utf-8").read().replace(ANGLE_A, ANGLE_A[:-1] + "f")
        with open(self.outfile, "w", encoding="utf-8") as fh:
            fh.write(raw)
        problems = fr.verify(fr.load_doc(self.infile), fr.load_doc(self.outfile))
        self.assertTrue(problems)

    def test_verify_catches_a_dropped_mc_clip(self):
        self.run_cli()
        raw = open(self.outfile, encoding="utf-8").read()
        i = raw.index('<mc-clip offset="60/1s"')
        j = raw.index("</mc-clip>", i) + len("</mc-clip>")
        with open(self.outfile, "w", encoding="utf-8") as fh:
            fh.write(raw[:i] + raw[j:])
        problems = fr.verify(fr.load_doc(self.infile), fr.load_doc(self.outfile))
        self.assertTrue(any("mc-clip count" in p for p in problems))

    def test_input_is_never_modified(self):
        before = open(self.infile, "rb").read()
        self.run_cli("--verify")
        self.assertEqual(open(self.infile, "rb").read(), before)


class TestReport(TempDocMixin):
    def test_report_flags_shortfall(self):
        doc = self.doc()
        changes = fr.plan_changes(
            doc,
            [fr.Mapping("r13", "/t/a.braw", "01:31:30:00", "00:00:10:00")],
        )
        buf = io.StringIO()
        shortfalls = fr.print_report(doc, changes, stream=buf)
        self.assertTrue(shortfalls)
        self.assertIn("SHORTFALL", buf.getvalue())

    def test_report_shows_needed_vs_provided(self):
        doc = self.doc()
        changes = fr.plan_changes(
            doc,
            [fr.Mapping("r13", "/t/a.braw", CAM_A_TRIM_START_TC, "00:28:21:10")],
        )
        buf = io.StringIO()
        self.assertEqual(fr.print_report(doc, changes, stream=buf), [])
        text = buf.getvalue()
        self.assertIn("01:31:21:18", text)  # needed
        self.assertIn("01:31:19:18", text)  # provided
        self.assertIn("(unused by the edit)", text)  # the 25 fps angle clip


class TestPathUrls(unittest.TestCase):
    def test_quote_and_unquote(self):
        url = fr.path_to_file_url("/Volumes/Battle Of Band 2025/CAM A/A001.braw")
        self.assertEqual(
            url, "file:///Volumes/Battle%20Of%20Band%202025/CAM%20A/A001.braw"
        )
        self.assertEqual(
            fr.file_url_to_path(url), "/Volumes/Battle Of Band 2025/CAM A/A001.braw"
        )

    def test_existing_url_passes_through(self):
        self.assertEqual(fr.path_to_file_url("file:///a%20b/c"), "file:///a%20b/c")


# --------------------------------------------------------------------------
# mc-clip source in-point patching
# --------------------------------------------------------------------------


class TestInpointPatching(TempDocMixin):
    """The fixture's two mc-clips sit at timeline frames 0 and 1440 (60s @24)."""

    def write_truth(self, text, name="truth.txt"):
        path = os.path.join(self.tmp.name, name)
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(text)
        return path

    def test_parses_semicolon_and_whitespace(self):
        p1 = self.write_truth("0:83247;1440:83507")
        p2 = self.write_truth("0:83247\n1440:83507\n", "t2.txt")
        self.assertEqual(fr.parse_inpoint_file(p1), {0: 83247, 1440: 83507})
        self.assertEqual(fr.parse_inpoint_file(p1), fr.parse_inpoint_file(p2))

    def test_accepts_sub_frame_inpoints(self):
        # retimed clips can start between frames; the value must survive exactly
        self.assertEqual(fr.parse_inpoint_file(self.write_truth("12304:96271.2")),
                         {12304: Fraction(481356, 5)})

    def test_epsilon_is_tiny(self):
        # 0.1 frame broke the 25 fps Roving angle; see INPOINT_EPSILON_FRAMES
        self.assertLessEqual(fr.INPOINT_EPSILON_FRAMES, Fraction(1, 100))

    def test_rejects_garbage(self):
        for bad in ("", "nonsense", "0:abc", "0"):
            with self.assertRaises(fr.RetargetError):
                fr.parse_inpoint_file(self.write_truth(bad))

    def test_rejects_conflicting_duplicates(self):
        with self.assertRaises(fr.RetargetError):
            fr.parse_inpoint_file(self.write_truth("0:1;0:2"))
        # identical duplicates are fine
        self.assertEqual(fr.parse_inpoint_file(self.write_truth("0:1;0:1")), {0: 1})

    def test_start_is_tcstart_plus_inpoint_plus_epsilon(self):
        doc = self.doc()
        notes = fr.patch_inpoints(doc, {0: 83247, 1440: 83507}, Fraction(24))
        mcs = doc.spine.findall("mc-clip")
        got = fr.parse_time(mcs[0].get("start"))
        want = Fraction(3600) + Fraction(83247, 24) + fr.INPOINT_EPSILON_FRAMES / 24
        self.assertEqual(got, want)
        self.assertTrue(any("2 of 2" in n for n in notes))

    def test_epsilon_survives_resolve_style_floor_rounding(self):
        """The whole point of the epsilon: floor(start*rate) must land on the frame."""
        doc = self.doc()
        fr.patch_inpoints(doc, {0: 96271, 1440: 83507}, Fraction(24))
        start = fr.parse_time(doc.spine.findall("mc-clip")[0].get("start"))
        angle_local = start - doc.tc_start
        self.assertEqual(int(angle_local * 24), 96271)

    def test_missing_truth_is_reported_not_fatal(self):
        doc = self.doc()
        notes = fr.patch_inpoints(doc, {0: 83247}, Fraction(24))
        self.assertTrue(any("no truth value for 1" in n for n in notes))
        # the unmatched clip keeps its original start
        self.assertEqual(doc.spine.findall("mc-clip")[1].get("start"), "56909/8s")

    def test_rejects_bad_rate(self):
        with self.assertRaises(fr.RetargetError):
            fr.patch_inpoints(self.doc(), {0: 1}, Fraction(0))

    def test_cli_inpoints_only_preserves_the_edit(self):
        truth = self.write_truth("0:83247;1440:83507")
        rc = self.cli(["--in", self.infile, "--out", self.outfile,
                       "--inpoints", truth])
        self.assertEqual(rc, 0)
        before, after = fr.load_doc(self.infile), fr.load_doc(self.outfile)
        # angle UUIDs, cut count and spine structure must be untouched
        self.assertEqual(before.mc_source_angle_ids(), after.mc_source_angle_ids())
        self.assertEqual(len(before.mc_clips()), len(after.mc_clips()))
        self.assertEqual(fr.verify(before, after, allow_inpoint_changes=True), [])
        # the strict default must still catch the spine edit
        self.assertEqual(
            fr.verify(before, after),
            ["spine content changed (the edit itself was modified)"],
        )
        # and the starts actually moved
        self.assertNotEqual(
            [m.get("start") for m in before.spine.findall("mc-clip")],
            [m.get("start") for m in after.spine.findall("mc-clip")],
        )

    def test_cli_inpoints_requires_out(self):
        truth = self.write_truth("0:83247")
        self.assertEqual(self.cli(["--in", self.infile, "--inpoints", truth]), 1)

    def test_cli_dry_run_writes_nothing(self):
        truth = self.write_truth("0:83247;1440:83507")
        rc = self.cli(["--in", self.infile, "--out", self.outfile,
                       "--inpoints", truth, "--dry-run"])
        self.assertEqual(rc, 0)
        self.assertFalse(os.path.exists(self.outfile))


class TestConnectedClipReanchor(TempDocMixin):
    """A title on lane 1 under the first mc-clip must keep its timeline frame."""

    def setUp(self):
        super().setUp()
        text = FIXTURE.replace(
            '<mc-source srcEnable="video" angleID="{a}"/>\n                        </mc-clip>'.format(a=ANGLE_A),
            '<mc-source srcEnable="video" angleID="{a}"/>\n'
            '                            <video offset="{o}" duration="7/1s" start="0/1s" lane="1" name="title.png"/>\n'
            '                        </mc-clip>'.format(a=ANGLE_A, o="56909/8s"),  # start + 45s
            1,
        )
        assert "title.png" in text
        with open(self.infile, "w", encoding="utf-8") as fh:
            fh.write(text)

    def child_frame(self, doc):
        mc = doc.spine.findall("mc-clip")[0]
        ch = [c for c in mc if c.get("lane")][0]
        pos = (fr.parse_time(mc.get("offset")) + fr.parse_time(ch.get("offset"))
               - fr.parse_time(mc.get("start")))
        return pos * 24

    def test_child_stays_on_its_frame_after_parent_moves(self):
        doc = self.doc()
        before = self.child_frame(doc)            # 45s * 24 = 1080
        self.assertEqual(before, 1080)
        notes = fr.patch_inpoints(doc, {0: 83247, 1440: 83507}, Fraction(24))
        self.assertEqual(self.child_frame(doc), 1080)   # exact: no epsilon drift
        self.assertTrue(any("1 connected clips re-anchored" in n for n in notes))

    def test_repairs_an_already_epsilon_shifted_child(self):
        # simulate an input where the parent already carries a +0.1 frame epsilon
        doc = self.doc()
        mc = doc.spine.findall("mc-clip")[0]
        mc.set("start", fr.format_time(fr.parse_time(mc.get("start")) + Fraction(1, 240)))
        self.assertEqual(int(self.child_frame(doc)), 1079)   # the bug: floors a frame early
        fr.patch_inpoints(doc, {0: 83247, 1440: 83507}, Fraction(24))
        self.assertEqual(self.child_frame(doc), 1080)

    def test_cli_verify_accepts_reanchored_children(self):
        truth = os.path.join(self.tmp.name, "t.txt")
        with open(truth, "w") as fh:
            fh.write("0:83247;1440:83507")
        self.assertEqual(self.cli(["--in", self.infile, "--out", self.outfile,
                                   "--inpoints", truth]), 0)
        before, after = fr.load_doc(self.infile), fr.load_doc(self.outfile)
        self.assertEqual(fr.verify(before, after, allow_inpoint_changes=True), [])


class TestCropToFill(TempDocMixin):
    def scales(self, doc):
        return {a.name: [c.el.find("adjust-transform").get("scale") for c in a.clips]
                for a in doc.angles}

    def test_wide_angle_scaled_matching_angle_untouched(self):
        doc = self.doc()
        notes = fr.crop_to_fill(doc)
        sc = self.scales(doc)
        self.assertEqual(sc["Full Stage"], ["1.0666667 1.0666667"])   # 4096 in 3840
        self.assertEqual(sc["Roving Camera"], ["1 1"])                # 3840 in 3840
        self.assertEqual(len(notes), 1)

    def test_idempotent(self):
        doc = self.doc()
        fr.crop_to_fill(doc); first = self.scales(doc)
        fr.crop_to_fill(doc)
        self.assertEqual(self.scales(doc), first)

    def test_cli_flag_preserves_the_edit(self):
        rc = self.cli(["--in", self.infile, "--out", self.outfile, "--crop-to-fill",
                       "--map", "A001_05200041_C001.braw=/trim/A001.braw@"
                       + CAM_A_TRIM_START_TC + "+00:10:00:00", "--allow-shortfall"])
        self.assertEqual(rc, 0)
        before, after = fr.load_doc(self.infile), fr.load_doc(self.outfile)
        self.assertEqual(fr.verify(before, after), [])
        self.assertEqual(self.scales(after)["Full Stage"], ["1.0666667 1.0666667"])




class TestPathOnly(TempDocMixin):
    """A whole-file copy (same start and length as the asset) swaps path only."""

    ROVING = "C8666.MP4=/trim/C8666.MP4@1829861/25s+8712/25s"

    def test_timing_untouched_and_no_gap_relay(self):
        before = self.doc()
        doc = self.doc()
        changes = fr.plan_changes(doc, [fr.parse_map_arg(self.ROVING)])
        self.assertTrue(changes[0].path_only)
        notes = fr.apply_changes(doc, changes)
        b = [a for a in before.angles if a.name == "Roving Camera"][0].clips[0].el
        a = [a for a in doc.angles if a.name == "Roving Camera"][0].clips[0].el
        for k in ("offset", "start", "duration"):
            self.assertEqual(a.get(k), b.get(k))
        self.assertTrue(any("whole-file copy" in n for n in notes))
        self.assertFalse(any("gap" in n for n in notes))
        self.assertEqual(fr.file_url_to_path(doc.assets["r2"].src), "/trim/C8666.MP4")

    def test_a_real_trim_is_not_path_only(self):
        doc = self.doc()
        m = fr.parse_map_arg("A001_05200041_C001.braw=/trim/A001.braw@"
                             + CAM_A_TRIM_START_TC + "+00:10:00:00")
        self.assertFalse(fr.plan_changes(doc, [m])[0].path_only)


if __name__ == "__main__":
    unittest.main(verbosity=2)
