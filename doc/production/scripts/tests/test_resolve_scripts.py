"""Offline tests for resolve scripts against the fake Resolve module (no Resolve, no media).
Run: python3 -I -m unittest discover -s doc/production/scripts/tests -v
They prove each script's logic. How Resolve itself behaves (RiP names, enable reads, SetLUT) still needs a live check.
"""
import hashlib, json, os, sys, tempfile, unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import run, fake  # noqa: E402

I = fake.Item
TMP = tempfile.mkdtemp(prefix="bottb_tests_")


def tmp(name): return os.path.join(TMP, name)


def song_timeline(name="BOTTB Test - final cut"):
    """Song range 1000-1999 from a RELEASE marker; Orange in range on V1 and V3, Orange outside on V2."""
    v1 = [I(900, 1000, "Multicam - Wide", "Orange"), I(1000, 1100, "Multicam - SR", "Orange"), I(1100, 1500, "Multicam - Pit"),
          I(1500, 2000, "Multicam - Drum", "Orange")]
    v2 = [I(500, 600, "Mustang overlay", "Orange")]
    v3 = [I(1200, 1300, "gigsteady 01", "Orange"), I(1300, 1400, "gigsteady 02", "Blue")]
    markers = {1000: {"name": "RELEASE: Band - Song", "color": "Cyan", "duration": 1000, "note": ""}}
    return fake.Timeline(name, 0, video=[("Video 1", True, v1), ("gigsteady", True, v2), ("gigsteady", True, v3)],
                         audio=[("Mix", True, [I(1000, 2000, "mix.wav")]), ("Desk scratch", False, [I(0, 5000, "scratch.wav")])],
                         markers=markers)


class PostDelivery(unittest.TestCase):
    def test_clears_orange_on_every_video_track_in_range(self):
        tl = song_timeline(); p = fake.Project([tl])
        code, out = run("resolve/post_delivery.py", ["Band - Song"], p)
        self.assertEqual(code, 0, out)
        colours = {(t, i.GetStart()): i.GetClipColor() for t in (1, 2, 3) for i in tl.GetItemListInTrack("video", t)}
        self.assertEqual(colours[(1, 1000)], ""); self.assertEqual(colours[(1, 1500)], ""); self.assertEqual(colours[(3, 1200)], "")
        self.assertEqual(colours[(1, 900)], "Orange", "item ending at the In is outside the song")
        self.assertEqual(colours[(2, 500)], "Orange", "another song's Orange is reported, not cleared")
        self.assertEqual(colours[(3, 1300)], "Blue")
        self.assertIn("2 orange cleared 3 {'V1': 2, 'V3': 1} left 0", out)
        self.assertIn("NOTE orange outside this song", out); self.assertIn("'V2': 1", out)
        self.assertEqual(tl.inout, {"in": 1000, "out": 1999}); self.assertEqual(p.saved, 1)


class ClipColours(unittest.TestCase):
    def test_clear_matches_by_position_after_render_in_place_renames(self):
        tl = song_timeline(); p = fake.Project([tl]); b = tmp("cc_backup.json")
        code, out = run("resolve/clip_colours.py", ["backup", 1000, 1999, "Orange", b], p)
        self.assertEqual(code, 0, out); self.assertEqual(len(json.load(open(b))["items"]), 3)
        for t in (1, 3):  # RiP renames every baked item
            for i in tl.GetItemListInTrack("video", t): i.name = "Render in Place %d" % i.start
        code, out = run("resolve/clip_colours.py", ["clear", b], p)
        self.assertEqual(code, 0, out); self.assertIn("clear 3, failed 0, skipped 0, not found 0, renamed 3", out)
        code, out = run("resolve/clip_colours.py", ["restore", b], p)
        self.assertEqual(code, 0, out); self.assertEqual(tl.GetItemListInTrack("video", 3)[0].GetClipColor(), "Orange")

    def test_same_start_on_two_tracks_named_alike_stay_separate(self):
        v = [("gigsteady", True, [I(10, 20, "a", "Orange")]), ("gigsteady", True, [I(10, 20, "b", "Orange")])]
        tl = fake.Timeline("T", video=v); p = fake.Project([tl]); b = tmp("cc2.json")
        run("resolve/clip_colours.py", ["backup", 0, 100, "Orange", b], p)
        tl.tracks["video"][1][2][0].color = "Green"  # recoloured since: must be skipped, not cleared
        code, out = run("resolve/clip_colours.py", ["clear", b], p)
        self.assertIn("clear 1, failed 0, skipped 1", out)
        self.assertEqual([x[2][0].GetClipColor() for x in tl.tracks["video"]], ["", "Green"])

    def test_moved_item_fails(self):
        tl = song_timeline(); p = fake.Project([tl]); b = tmp("cc3.json")
        run("resolve/clip_colours.py", ["backup", 1000, 1999, "Orange", b], p)
        tl.GetItemListInTrack("video", 3)[0].start = 1201
        code, out = run("resolve/clip_colours.py", ["clear", b], p)
        self.assertEqual(code, 1, out); self.assertIn("not found 1", out)


def three_gigsteady(name, v3_end=1300, insert=False, a2_on=False):
    v = [("Video 1", True, [I(0, 100, "c1"), I(100, 200, "c2")]), ("gigsteady", True, [I(0, 50, "g1")]),
         ("gigsteady", True, [I(1200, v3_end, "g2")]), ("gigsteady", True, [I(2000, 2100, "g3")])]
    if insert: v.insert(1, ("gigsteady", True, [I(5000, 5100, "new overlay")]))
    return fake.Timeline(name, video=v, audio=[("Mix", True, [I(0, 9000, "mix")]), ("Desk", a2_on, [I(0, 9000, "s")])])


class CompareTimelines(unittest.TestCase):
    def cmp(self, A, B, *extra):
        p = fake.Project([A, B]); j = tmp("cmp.json")
        code, out = run("compare_timelines.py", [A.GetName(), B.GetName(), 9000, 9001, j] + list(extra), p)
        self.assertIs(p.GetCurrentTimeline(), A, "current timeline restored"); return code, out, json.load(open(j))

    def test_identical(self):
        code, out, _ = self.cmp(three_gigsteady("A"), three_gigsteady("B"))
        self.assertEqual(code, 0, out); self.assertIn("RESULT SAME", out)

    def test_difference_on_a_duplicate_named_track_is_seen(self):
        code, out, res = self.cmp(three_gigsteady("A"), three_gigsteady("B", v3_end=1301))
        self.assertEqual(code, 1, out); self.assertIn("V3 gigsteady", out)
        self.assertEqual(res["duplicate_video_track_names"]["A"], ["gigsteady"])

    def test_track_enable_is_compared(self):
        code, out, _ = self.cmp(three_gigsteady("A"), three_gigsteady("B", a2_on=True))
        self.assertEqual(code, 1); self.assertIn("'enabled', False, True", out)

    def test_inserted_track_offset(self):
        code, out, res = self.cmp(three_gigsteady("A"), three_gigsteady("B", insert=True), "--insert", 2)
        self.assertEqual(code, 0, out); self.assertEqual(res["inserted_track"]["items"], 1)
        code, out, _ = self.cmp(three_gigsteady("A"), three_gigsteady("B", insert=True))
        self.assertEqual(code, 1, "without --insert the shifted tracks differ")


class LutRefs(unittest.TestCase):
    def test_missing_lut_found(self):
        sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "resolve"))
        import pix
        root = tmp("lutroot"); os.makedirs(os.path.join(root, "amk"), exist_ok=True)
        open(os.path.join(root, "amk", "here.cube"), "w").write("x")
        os.symlink(os.path.join(root, "amk"), os.path.join(root, "linked"))
        v = [("Video 1", True, [I(0, 100, "a", luts=["amk/here.cube"]), I(100, 200, "b", luts=["", "amk/gone.cube"]),
                                I(300, 400, "out of range", luts=["amk/gone.cube"])]),
             ("overlay", True, [I(150, 160, "o", luts=["linked/here.cube"])])]
        refs = pix.lut_refs(fake.Timeline("T", video=v), 0, 199, roots=[root])
        self.assertEqual([(r[0], r[1], r[3], r[4], r[5]) for r in refs],
                         [(1, 0, 1, "amk/here.cube", True), (1, 100, 2, "amk/gone.cube", False), (2, 150, 1, "linked/here.cube", True)])


class Snapshots(unittest.TestCase):
    def test_enable_change_fails_the_identical_check(self):
        tl = song_timeline(); p = fake.Project([tl]); a, b = tmp("s1.json"), tmp("s2.json")
        self.assertEqual(run("resolve/snapshot.py", [0, 5000, a], p)[0], 0)
        tl.tracks["audio"][1][1] = True
        self.assertEqual(run("resolve/snapshot.py", [0, 5000, b], p)[0], 0)
        code, out = run("resolve/diff_snapshots.py", [a, a], p); self.assertEqual(code, 0, out)
        code, out = run("resolve/diff_snapshots.py", [a, b], p)
        self.assertEqual(code, 1); self.assertIn("TRACK ENABLE A2 Desk scratch off -> on", out)

    def test_edit_range_allows_the_edit_only(self):
        tl = song_timeline(); p = fake.Project([tl]); a, b = tmp("s3.json"), tmp("s4.json")
        run("resolve/snapshot.py", [0, 5000, a], p)
        tl.GetItemListInTrack("video", 1)[2].name = "Multicam - Trk"   # 1100-1500 on V1: the edit
        run("resolve/snapshot.py", [0, 5000, b], p)
        self.assertEqual(run("resolve/diff_snapshots.py", [a, b, "--edit", 1000, 2000, "V1"], p)[0], 0)
        tl.GetItemListInTrack("video", 3)[0].start = 1199                # and something else moved
        run("resolve/snapshot.py", [0, 5000, b], p)
        code, out = run("resolve/diff_snapshots.py", [a, b, "--edit", 1000, 2000, "V1"], p)
        self.assertEqual(code, 1); self.assertIn("ITEMS V3", out)


class ApplyDiff(unittest.TestCase):
    def test_held_row_with_a_lut_path_gets_no_lut(self):
        root = tmp("applyluts"); os.makedirs(root, exist_ok=True); sha = {}
        for n in ("c1.cube", "c2.cube"):
            open(os.path.join(root, n), "w").write(n); sha[n] = hashlib.sha256(n.encode()).hexdigest()
        os.environ["BOTTB_LUT_ROOT"] = root
        rows = [dict(index=1, record_in=0, record_out=100, angle="Wide", lut="c1.cube", sha256=sha["c1.cube"], held=False),
                dict(index=2, record_in=100, record_out=200, angle="SR", lut="c2.cube", sha256=sha["c2.cube"], held=True),
                dict(index=3, record_in=200, record_out=300, angle="Pit", lut=None, held=False)]
        json.dump({"items": rows}, open(tmp("apply.json"), "w"))
        v1 = [I(0, 100, "MC - Wide", luts=[""]), I(100, 200, "MC - SR", luts=["old.cube"]), I(200, 300, "MC - Pit", luts=[""])]
        tl = fake.Timeline("T", video=[("Video 1", True, v1)]); p = fake.Project([tl])
        try:
            code, out = run("resolve/apply_diff.py", [tmp("apply.json"), "T", tmp("before.json"), "--dry"], p)
            self.assertEqual(code, 0, out); self.assertIn("with LUT 1, held 1 (no LUT), none 1", out)
            self.assertEqual(v1[1].graph.luts, ["old.cube"], "dry run writes nothing")
            code, out = run("resolve/apply_diff.py", [tmp("apply.json"), "T", tmp("before.json")], p)
            self.assertEqual(code, 0, out)
            self.assertEqual([i.graph.luts[0] for i in v1], ["c1.cube", "", ""])
            self.assertIn("READBACK 3 cuts: with LUT 1, none 2, mismatches 0", out)
            v1[0].graph.luts = ["", "extra"]  # a hand-added node on a cut that needs a change: refuse, write nothing
            v1[2].graph.luts = ["", "extra"]  # and on an unchanged cut: only a note
            code, out = run("resolve/apply_diff.py", [tmp("apply.json"), "T", tmp("before.json")], p)
            self.assertEqual(code, 1, out); self.assertIn("REFUSED row 1: expected 1 node", out)
            self.assertIn("note: row 3 unchanged", out); self.assertEqual(v1[0].graph.luts, ["", "extra"])
        finally:
            del os.environ["BOTTB_LUT_ROOT"]

class LookTransformTest(unittest.TestCase):
    """pix.look_transform: the preflight check that caught nothing on Barracuda v1, whose look clip had Dynamic Zoom on."""
    def setUp(self):
        sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "resolve"))

    def test_identity_look_clip_passes(self):
        import pix
        it = fake.Item(310, 328519, "Adjustment Clip", props={"ZoomX": 1.0, "ZoomY": 1.0, "Pan": 0.0, "DynamicZoomEnabled": False, "Opacity": 100.0})
        self.assertEqual(pix.look_transform(it), {})

    def test_dynamic_zoom_on_look_clip_is_flagged(self):
        import pix
        it = fake.Item(310, 328519, "Adjustment Clip", props={"ZoomX": 1.0, "DynamicZoomEnabled": True})
        self.assertEqual(pix.look_transform(it), {"DynamicZoomEnabled": True})

    def test_zoom_and_crop_are_flagged_and_missing_keys_skipped(self):
        import pix
        it = fake.Item(310, 328519, "Adjustment Clip", props={"ZoomX": 1.2, "CropLeft": 12.0})
        self.assertEqual(pix.look_transform(it), {"ZoomX": 1.2, "CropLeft": 12.0})



if __name__ == "__main__":
    unittest.main()
