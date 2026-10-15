"""Unit tests for the song-map helpers (no audio needed).

Run: <venv with numpy/scipy/librosa>/python -m pytest doc/production/scripts/songmap/tests -q
(from doc/production/scripts)
"""
import numpy as np
import pytest

from songmap import analyse as A
from songmap import config as C
from songmap.lyrics import hook_hits


def test_ref_to_tc_matches_the_timeline_definition():
    assert C.ref_to_frame(C.REF_AT_TC0) == 90000
    assert C.ref_to_tc(C.REF_AT_TC0) == "01:00:00:00"
    # 1 s later = 25 frames
    assert C.ref_to_tc(C.REF_AT_TC0 + 1.0) == "01:00:01:00"
    assert C.ref_to_tc(C.REF_AT_TC0 + 3600 + 0.48) == "02:00:00:12"


def test_runs_and_gap_helpers():
    m = np.array([0, 1, 1, 0, 0, 1, 0, 1, 1, 1], bool)
    assert A.runs(m) == [(1, 3), (5, 6), (7, 10)]
    assert A.runs(m, 3) == [(7, 10)]
    assert A.close_gaps(m, 2).tolist() == [0, 1, 1, 0, 0, 1, 1, 1, 1, 1]
    assert A.drop_short(m, 2).tolist() == [0, 1, 1, 0, 0, 0, 0, 1, 1, 1]


def test_hysteresis_holds_between_thresholds():
    x = np.array([0, 10, 7, 7, 5, 7, 10])
    assert A.hysteresis(x, 9, 6).tolist() == [False, True, True, True, False, False, True]


def test_spans_absorb_short_runs_into_the_longer_neighbour():
    labs = ["a"] * 10 + ["b"] * 2 + ["c"] * 6
    sp = A._spans(labs, 100.0, min_len_frames=4)
    assert [s[2] for s in sp] == ["a", "c"]
    assert sp[0][0] == 100.0 and sp[-1][1] == 100.0 + 18 * A.DEC


def test_pow_sum_adds_powers():
    assert A.pow_sum(np.array([0.0]), np.array([0.0]))[0] == pytest.approx(3.0103, abs=1e-3)


def test_hook_hits_find_multiword_phrases_case_and_punctuation_free():
    words = [dict(t=10.0, w="One"), dict(t=10.4, w="night,"), dict(t=11.0, w="Thanks"), dict(t=11.3, w="for"),
             dict(t=11.5, w="the"), dict(t=11.8, w="memories."), dict(t=20.0, w="memories")]
    hits = hook_hits("Thnks fr th Mmrs", words)
    assert (11.0, "thanks for the") in hits
    assert [t for t, h in hits if h == "memories"] == [11.8, 20.0]


def test_snap_to_bar():
    assert A.snap_to_bar(10.2, [8.0, 10.0, 12.0]) == 10.0
    assert A.snap_to_bar(10.2, []) == 10.2


class _Ctx:
    """Minimal stand-in for SongCtx for label_sections (no grid, no audio)."""

    def __init__(self, segs, hooks=()):
        self.a, self.b = segs[0]["start_s"], segs[-1]["end_s"]
        self.grid = {"x": 1}  # pretend letters come from a grid
        self.overrides = {}
        self.hooks = list(hooks)


def _seg(t0, t1, voc, letter, energy=0.0, dual=0.0, feat=None, feat_frac=0.0, drums=1.0, cym=0.0):
    return dict(start_s=t0, end_s=t1, voc=voc, letter=letter, key=letter, energy=energy, dual=dual, feat=feat,
                feat_frac=feat_frac, drums=drums, cym=cym, lead=None)


def test_labels_intro_verse_chorus_solo_outro(monkeypatch):
    segs = [_seg(0, 10, 0.0, "A"), _seg(10, 30, 1.0, "B", energy=-2), _seg(30, 45, 1.0, "C", energy=2, dual=0.8),
            _seg(45, 65, 1.0, "B", energy=-2), _seg(65, 80, 1.0, "C", energy=2, dual=0.8),
            _seg(80, 95, 0.0, "D", feat="GTR SL", feat_frac=0.8), _seg(95, 110, 1.0, "C", energy=2, dual=0.8),
            _seg(110, 120, 0.0, "E")]
    monkeypatch.setattr(A, "chroma_ssm_sim", lambda ctx, s: np.eye(len(s)))
    A.label_sections(_Ctx(segs), segs)
    assert [s["label"] for s in segs] == ["intro", "verse", "chorus", "verse", "chorus", "solo", "chorus", "outro"]


def test_hook_words_override_energy_for_the_chorus(monkeypatch):
    # the loud repeated group B has no hook; the quieter C sings the title -> C is the chorus
    segs = [_seg(0, 20, 1.0, "B", energy=3, dual=0.9), _seg(20, 40, 1.0, "C", energy=-1),
            _seg(40, 60, 1.0, "B", energy=3, dual=0.9), _seg(60, 80, 1.0, "C", energy=-1)]
    monkeypatch.setattr(A, "chroma_ssm_sim", lambda ctx, s: np.eye(len(s)))
    A.label_sections(_Ctx(segs, hooks=[(25.0, "title"), (65.0, "title")]), segs)
    assert [s["label"] for s in segs] == ["verse", "chorus", "verse", "chorus"]
    assert segs[1]["conf"] == 0.8


def test_drop_loops_removes_whisper_repetition():
    from songmap.lyrics import drop_loops

    loop = [dict(t=i, w="down,", phrase_start=0, phrase_end=20) for i in range(20)]
    real = [dict(t=30 + i, w=w, phrase_start=30, phrase_end=35) for i, w in enumerate("hello I've waited here".split())]
    assert drop_loops(loop + real) == real
