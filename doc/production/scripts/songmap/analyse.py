"""Per-song map: sections with musical names, who is featured, and events (REF seconds).

Inputs per band: the feature cache from `features.py`, mix-assist's `<set>/<song>.grid.json`
(song boundaries, bars, lettered sections) when present, and the FOH camera crowd curve.

Method (details and validation in README.md):

* **Vocal activity** per mic = mic level (200 Hz-4 kHz) minus the overheads' level in the same
  band (the overheads hear the same stage bleed), minus that difference's 25th percentile over
  the song. Idle mics sit at 0-3 dB, a singer at 12-25 dB. On > 9 dB (hysteresis off < 6 dB),
  phrases joined across gaps < 1.5 s.
* **Instrument activity**: DI/close tracks on when > 15 dB over the track's own floor.
* **Lead score** per melodic instrument: monophony (chroma entropy below its own median),
  level boost over its own median while playing, and spectral centroid lift; featured when it
  leads the others by a margin while the vocals are off.
* **Sections**: mix-assist's bar-snapped sections, split where the vocal state changes for
  >= 2 bars; names from vocal state, energy, repetition (grid letter + chroma similarity),
  dual vocals and position.
* **Events**: vocal entries, solo start/end, tom fills (T1/T2/FT onsets), stops (band drops
  > 15 dB for 0.2-3 s) and the hit after, crowd cheers (FOH camera minus desk).
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

import numpy as np
from scipy.ndimage import maximum_filter1d, median_filter, minimum_filter1d, uniform_filter1d

from . import config as C

DEC = 0.5  # decision frame (s) for featured spans


# --------------------------------------------------------------------------- data


class Feats:
    def __init__(self, band: str):
        p = C.OUT / "_cache" / f"{band}_features.npz"
        z = np.load(p)
        self.d = {k: z[k] for k in z.files}
        self.band = band
        self.t0 = float(self.d["t0"])
        self.fps = float(self.d["fps"])
        self.env_fps = float(self.d["env_fps"])

    def idx(self, a, b, fps=None):
        fps = fps or self.fps
        return int(round((a - self.t0) * fps)), int(round((b - self.t0) * fps))

    def get(self, track, key, a, b):
        if track == "KEYS" and key not in ("chent", "flat", "cent"):
            x = self.get("KEYS 2L", key, a, b)
            y = self.get("KEYS 2R", key, a, b)
            return 10 * np.log10(10 ** (x / 10) + 10 ** (y / 10))
        if track == "KEYS":
            track = "KEYS 2L"
        if key == "env":
            i0, i1 = self.idx(a, b, self.env_fps)
        else:
            i0, i1 = self.idx(a, b)
        return self.d[f"{track}/{key}"][i0:i1].astype(np.float64)

    def group(self, name, a, b):
        i0, i1 = self.idx(a, b)
        return self.d[name][i0:i1].astype(np.float64)


def pow_sum(*dbs):
    return 10 * np.log10(sum(10 ** (np.asarray(x) / 10) for x in dbs) + 1e-15)


def runs(mask, min_len=1):
    """[(start, end_exclusive)] of True runs with length >= min_len."""
    m = np.r_[0, np.asarray(mask, int), 0]
    e = np.flatnonzero(np.diff(m))
    return [(s, t) for s, t in zip(e[::2], e[1::2]) if t - s >= min_len]


def close_gaps(mask, max_gap):
    """Fill False runs shorter than max_gap that sit between True runs."""
    out = np.asarray(mask, bool).copy()
    for s, t in runs(~out):
        if s > 0 and t < len(out) and t - s < max_gap:
            out[s:t] = True
    return out


def drop_short(mask, min_len):
    out = np.asarray(mask, bool).copy()
    for s, t in runs(out):
        if t - s < min_len:
            out[s:t] = False
    return out


def hysteresis(x, on, off):
    out = np.zeros(len(x), bool)
    state = False
    for i, v in enumerate(x):
        state = v > on if not state else v > off
        out[i] = state
    return out


# --------------------------------------------------------------------------- song list


def slugify(title):
    s = re.sub(r"[^A-Za-z0-9]+", "-", title.replace("'", "").replace("é", "e")).strip("-")
    return s


@lru_cache(maxsize=None)
def grid_index():
    p = C.OUT / "index.json"
    if not p.exists():
        return []
    return json.loads(p.read_text()).get("songs", [])


def load_grid(band: str, title: str):
    """mix-assist's grid for this song, matched by order within the set (titles differ a little)."""
    cfg = C.BANDS[band]
    rows = [r for r in grid_index() if r["set"].replace(" ", "-").lower().startswith(cfg["dir"].lower()[:6])]
    titles = [t for t, _ in cfg["songs"] if not t.lower().startswith("alexa")]
    if title not in titles:
        return None
    # match by nearest start to the provisional start
    prov = dict(cfg["songs"])[title]
    best = None
    for r in rows:
        if abs(r["start_s"] - prov) < 45 and (best is None or abs(r["start_s"] - prov) < abs(best["start_s"] - prov)):
            best = r
    if best is None:
        return None
    return json.loads((C.OUT / best["file"]).read_text())


# --------------------------------------------------------------------------- measures


@dataclass
class SongCtx:
    band: str
    title: str
    a: float  # song start (REF)
    b: float  # song end (REF)
    F: Feats
    grid: dict | None
    overrides: dict = field(default_factory=dict)
    hooks: list = field(default_factory=list)

    @property
    def cfg(self):
        return C.BANDS[self.band]

    def t(self):
        i0, i1 = self.F.idx(self.a, self.b)
        return self.a + (np.arange(i1 - i0)) / self.F.fps


def oh_mid(F, a, b):
    sm = lambda x: uniform_filter1d(x, 6)
    return pow_sum(sm(F.get("OH L", "mid", a, b)), sm(F.get("OH R", "mid", a, b)))


def vocal_excess(F, mics, a, b, ref_a=None, ref_b=None):
    """Excess dB over the overhead-referenced bleed, per mic, at the feature rate."""
    ref_a = a if ref_a is None else ref_a
    ref_b = b if ref_b is None else ref_b
    oh = oh_mid(F, a, b)
    ohr = oh_mid(F, ref_a, ref_b)
    out = {}
    for m in mics:
        y = uniform_filter1d(F.get(m, "mid", a, b), 6)
        yr = uniform_filter1d(F.get(m, "mid", ref_a, ref_b), 6)
        k = np.percentile(yr - ohr, 25)
        e = y - oh - k
        # absolute gate: within 12 dB of the mic's own noise floor is never a voice
        noise = np.percentile(yr, 2)
        e = np.where(y > noise + 12, e, np.minimum(e, 0))
        out[m] = e
    return out


def vocal_activity(ex: dict, fps, on=9.0, off=6.0):
    act = {}
    for m, e in ex.items():
        h = hysteresis(e, on, off)
        h = close_gaps(h, int(1.5 * fps))
        act[m] = drop_short(h, int(0.4 * fps))
    return act


def live_mics(F, a, b, cands, min_frac=0.03):
    ex = vocal_excess(F, cands, a, b)
    act = vocal_activity(ex, F.fps)
    return [m for m in cands if act[m].mean() >= min_frac], ex, act


def inst_on(F, track, a, b, ref=None):
    """Track playing: level > floor + 15 dB (floor = 5th pct over the reference window)."""
    lv = uniform_filter1d(F.get(track, "full", a, b), 10)
    ra, rb = ref or (a, b)
    fl = np.percentile(uniform_filter1d(F.get(track, "full", ra, rb), 10), 5)
    hi = np.percentile(uniform_filter1d(F.get(track, "full", ra, rb), 10), 95)
    thr = fl + min(15.0, 0.5 * (hi - fl))
    return lv > thr, lv


def lead_scores(ctx: SongCtx, tracks):
    """Per-track lead score (feature rate), each term vs the track's own playing median in this song:
    monophony (chroma entropy down), level boost, brightness (centroid up) and exposure (its level
    over the power sum of the other melodic tracks)."""
    F, a, b = ctx.F, ctx.a, ctx.b
    out, on_all, lvl = {}, {}, {}
    w = int(2 * F.fps)
    for tr in tracks:
        on, lv = inst_on(F, tr, a, b)
        on_all[tr] = on
        lvl[tr] = uniform_filter1d(lv, w)
    for tr in tracks:
        on = on_all[tr]
        if on.mean() < 0.02:
            out[tr] = np.full(len(on), -1.0)
            continue
        ch = uniform_filter1d(F.get(tr, "chent", a, b), w)
        ce = uniform_filter1d(np.log2(F.get(tr, "cent", a, b) + 50), w)
        lvs = lvl[tr]
        others = [lvl[o] for o in tracks if o != tr and on_all[o].mean() > 0.02]
        rel = lvs - pow_sum(*others) if others else np.zeros(len(lvs))
        med_ch, med_ce, med_lv, med_rel = (np.median(ch[on]), np.median(ce[on]), np.median(lvs[on]),
                                           np.median(rel[on]))
        iqr = max(0.15, np.subtract(*np.percentile(ch[on], [75, 25])))
        mono = np.clip((med_ch - ch) / (2 * iqr), -1, 1.5)
        boost = np.clip((lvs - med_lv) / 4.0, -1, 1.5)
        bright = np.clip((ce - med_ce) / 0.5, -1, 1.5)
        expose = np.clip((rel - med_rel) / 6.0, -1, 1.5)
        fx = chroma_flux(F, tr, a, b, w)
        fluxz = np.clip((fx - np.median(fx[on])) / 0.08, -1, 1.5) if fx is not None else np.zeros(len(on))
        s = 0.25 * mono + 0.2 * boost + 0.1 * bright + 0.2 * expose + 0.25 * fluxz
        if tr in ctx.cfg.get("lead_instruments", []):
            s = s + 0.4  # a melodic lead instrument (erhu): featured whenever it plays and nobody sings
        s[~on] = -1
        out[tr] = s
    return out, on_all


def chroma_flux(F, tr, a, b, w):
    """Pitch-change rate: 1 - cosine between chroma frames 0.1 s apart, smoothed over w frames.
    Solos change notes far more often than rhythm parts (validated: Life Is a Highway 0.25 vs 0.14
    in the verse; Pokemon 0.33 vs 0.19; So Easy BASS Q 0.27 vs 0.15)."""
    key = f"{tr if tr != 'KEYS' else 'KEYS 2L'}/chroma"
    if key not in F.d:
        return None
    i0, i1 = F.idx(a, b)
    c = F.d[key][i0:i1].astype(np.float64)
    c = c / (np.linalg.norm(c, axis=1, keepdims=True) + 1e-12)
    f = np.r_[0.0, 0.0, 1 - np.sum(c[2:] * c[:-2], axis=1)]
    return uniform_filter1d(f, w)


def tom_fills(F, a, b):
    """Tom hits (T1/T2/FT onsets) and fill clusters: >= 3 hits within 1.5 s."""
    hits = []
    for tr in ("T1", "T2", "FT"):
        e = F.get(tr, "env", a, b)
        fl = np.percentile(e, 20)
        de = e - np.r_[np.full(3, e[0]), e[:-3]]
        cand = (de > 9) & (e > fl + 15)
        idx = np.flatnonzero(cand & ~np.r_[False, cand[:-1]])
        # one hit per 60 ms
        last = -100
        for i in idx:
            if i - last >= 6:
                hits.append(a + i / F.env_fps)
                last = i
    hits = np.sort(np.array(hits))
    fills = []
    i = 0
    while i < len(hits):
        j = i
        while j + 1 < len(hits) and hits[j + 1] - hits[j] < 0.5:
            j += 1
        if j - i + 1 >= 3 and hits[j] - hits[i] <= 3.0:
            fills.append((hits[i], hits[j], j - i + 1))
        i = j + 1
    return hits, fills


def band_level(F, a, b, tracks):
    return pow_sum(*[uniform_filter1d(F.get(tr, "full", a, b), 4) for tr in tracks])


def stops(F, a, b, tracks):
    """Whole-band stops: level falls > 15 dB under its 4 s running median for 0.2-3 s, then back."""
    lv = band_level(F, a, b, tracks)
    ref = median_filter(lv, size=int(4 * F.fps), mode="nearest")
    low = lv < ref - 15
    out = []
    for s, t in runs(low, int(0.2 * F.fps)):
        dur = (t - s) / F.fps
        if dur <= 3.0 and t < len(lv) - 2 and s > 2:
            out.append((a + s / F.fps, a + t / F.fps))
    return out, lv


# --------------------------------------------------------------------------- sections


def chroma_ssm_sim(ctx: SongCtx, segs):
    """Pairwise harmonic similarity of segments: best mean diagonal of the 0.5 s chroma SSM."""
    F = ctx.F
    ch = F.group("chroma_inst", ctx.a, ctx.b)  # dB
    step = int(DEC * F.fps)
    n = len(ch) // step
    c = 10 ** (ch[: n * step].reshape(n, step, 12).mean(1) / 10)
    c = c / (np.linalg.norm(c, axis=1, keepdims=True) + 1e-12)
    # 2 s time-delay embedding
    emb = np.concatenate([np.roll(c, -k, axis=0) for k in range(4)], axis=1) / 2.0
    S = emb @ emb.T
    idx = [(int((s0 - ctx.a) / DEC), int((s1 - ctx.a) / DEC)) for s0, s1 in segs]
    k = len(segs)
    M = np.eye(k)
    for i in range(k):
        for j in range(i + 1, k):
            (a0, a1), (b0, b1) = idx[i], idx[j]
            L = min(a1 - a0, b1 - b0)
            if L < 4:
                continue
            best = 0
            # slide the shorter within the longer
            if a1 - a0 <= b1 - b0:
                for off in range(0, (b1 - b0) - L + 1, 2):
                    best = max(best, float(np.mean(np.diag(S[a0:a0 + L, b0 + off:b0 + off + L]))))
            else:
                for off in range(0, (a1 - a0) - L + 1, 2):
                    best = max(best, float(np.mean(np.diag(S[a0 + off:a0 + off + L, b0:b0 + L]))))
            M[i, j] = M[j, i] = best
    return M


def snap_to_bar(t, bars):
    if not bars:
        return t
    arr = np.array(bars)
    return float(arr[np.argmin(np.abs(arr - t))])


# --------------------------------------------------------------------------- boundaries

INST_EXCLUDE = {"TRAX"}  # playback is "music" only where a band says so (see overrides)


def music_tracks(band):
    cfg = C.BANDS[band]
    tr = [t for t in cfg["instruments"] if t not in INST_EXCLUDE]
    return tr + ["Kick", "Snare", "OH L", "OH R"]


def song_bounds(F, band, title, grid, prev_end=None, next_start=None, ov=None):
    """(start, end, how, conf, notes). start = first musical transient (count-in excluded),
    end = last note's decay (instrument sum back within 10 dB of the following gap's floor)."""
    ov = ov or {}
    tracks = music_tracks(band)
    prov = dict(C.BANDS[band]["songs"])[title]
    g0 = grid["start_s"] if grid else None
    g1 = grid["end_s"] if grid else None
    lo = max(prev_end or prov - 60, (g0 or prov) - 40)
    hi = min(next_start or (g1 or prov + 600) + 60, (g1 or prov + 600) + 60)
    t_end = F.t0 + len(F.d["Kick/full"]) / F.fps
    lo, hi = max(lo, F.t0 + 0.1), min(hi, t_end - 0.1)
    lv = band_level(F, lo, hi, tracks)
    melodic = [t for t in tracks if t not in ("Kick", "Snare", "OH L", "OH R")]
    mlv = band_level(F, lo, hi, melodic)
    fps = F.fps
    floor = np.percentile(lv, 3)
    notes = []
    # ---- start
    if "start" in ov:
        start, how_s = ov["start"], "override (looked at the curves)"
    else:
        ref = g0 if g0 is not None else prov
        i_ref = int((ref - lo) * fps)
        thr = floor + 15
        above = lv > thr
        above = drop_short(above, int(0.15 * fps))
        # walk back from the reference over continuous playing (gaps < 1.5 s)
        i = min(i_ref, len(above) - 1)
        if not above[i]:
            nxt = np.flatnonzero(above[i:])
            i = i + (nxt[0] if len(nxt) else 0)
        j = i
        while j > 0:
            k = j - 1
            gap = 0
            while k > 0 and not above[k] and gap < int(1.5 * fps):
                k -= 1
                gap += 1
            if above[k] and gap < int(1.5 * fps):
                j = k
                while j > 0 and above[j - 1]:
                    j -= 1
            else:
                break
        start = lo + j / fps
        how_s = "first frame of the instrument sum > changeover floor + 15 dB, walked back over gaps < 1.5 s"
        # count-in: drum-only clicks before the first melodic note
        mel_on = mlv[j: i_ref + int(2 * fps)] > np.percentile(mlv, 3) + 15
        head_music = False
        if g0 is not None and g0 - start > 5:
            # music in the grid-trimmed head (e.g. ShipReX's slow Careless Whisper on erhu before Uprising)?
            j_g = int((g0 - lo) * fps)
            mm = mlv[j:j_g] > np.percentile(mlv, 3) + 15
            head_music = mm.mean() >= 0.6 and not ov.get("no_head_music")
        if head_music:
            notes.append(f"music before the grid's first downbeat: {start:.2f}-{g0:.2f} (melodic instruments on "
                         f"{(mlv[j:int((g0 - lo) * fps)] > np.percentile(mlv, 3) + 15).mean():.0%}); song start kept at the "
                         f"first note, grid start {g0:.2f} noted")
            how_s = "first note of a section the grid left unmapped (instrument sum > floor + 15 dB, melodic)"
        elif g0 is not None:
            if abs(start - g0) > 0.3:
                notes.append(f"instrument onset measured at {start:.2f}; the grid's first downbeat {g0:.2f} is used "
                             f"(it trims count-ins, walk-on noodling and pickups)")
            start = g0
            how_s = "mix-assist grid's first downbeat (first musical transient; count-in excluded)"
        elif False:
            first_mel = j + (np.flatnonzero(mel_on)[0] if mel_on.any() else 0)
            if (first_mel - j) / fps > 0.8 and (lo + first_mel / fps) >= g0 - 0.3:
                notes.append(f"drum-only lead-in {start:.2f}-{g0:.2f} (count-in or pickup) excluded")
                start = g0
                how_s = "grid's first downbeat; drum-only lead-in before it excluded as a count-in"
            else:
                notes.append(f"music starts {g0 - start:.2f} s before the grid's first downbeat (pickup)")
        elif g0 is not None and abs(start - g0) <= 0.3:
            start = g0
            how_s = "grid's first downbeat (agrees with the instrument onset within 0.3 s)"
    # ---- a cappella / vocal pickup straight into the first downbeat (e.g. Beggin')
    if "start" not in ov and not ov.get("no_vocal_pickup"):
        mics = list(C.BANDS[band]["vocals"])
        w0 = max(lo, start - 30)
        if start - w0 > 2 and mics:
            ex = vocal_excess(F, mics, w0, start + 0.5, start, (g1 or start + 120))
            act = vocal_activity(ex, fps)
            anyv = np.zeros(len(next(iter(act.values()))), bool)
            for v in act.values():
                anyv |= v
            anyv = close_gaps(anyv, int(1.6 * fps))
            e = len(anyv) - int(0.5 * fps)  # index of `start`
            if anyv[max(0, e - int(1.0 * fps)):e].any():
                j = e - 1
                while j > 0 and anyv[j - 1]:
                    j -= 1
                span = (e - j) / fps
                raw = np.zeros(len(anyv), bool)
                for v in act.values():
                    raw |= v
                dens = raw[j:e].mean() if e > j else 0
                # one singer holding it (talk and shouted count-ins alternate and chop)
                lead_m = max(act, key=lambda q: act[q][j:e].sum())
                switches = sum(int(np.sum(np.diff(act[q][j:e].astype(int)) == 1)) for q in act if q != lead_m)
                if 4.0 <= span <= 30 and dens >= 0.9 and switches <= 2:
                    notes.append(f"vocal pickup {w0 + j / fps:.2f}-{start:.2f} ({span:.1f} s, voiced {dens:.0%}) runs "
                                 f"straight into the first downbeat: song start moved to the vocal")
                    start = w0 + j / fps
                    how_s = "first sung note of an unaccompanied vocal intro that runs into the first downbeat"

    # ---- end
    if "end" in ov:
        end, how_e = ov["end"], "override (looked at the curves)"
    else:
        ref = g1 if g1 is not None else prov + 200
        i_ref = int((ref - lo) * fps)
        tail = lv[i_ref:]
        if len(tail) < 2:
            end = ref
            how_e = "grid end (no tail to measure)"
        else:
            tfloor = np.percentile(tail, 10)
            i_a = int(((g0 if g0 is not None else prov) - lo) * fps)
            song_med = np.median(lv[max(0, i_a):i_ref]) if i_ref > i_a + fps else np.median(lv)
            thr = max(tfloor + 10, floor + 10, song_med - 18)
            above = lv > thr
            k = i_ref
            # continue while playing (gaps < 1.0 s)
            while k < len(above) - 1:
                nxt = np.flatnonzero(above[k + 1: k + 1 + int(0.5 * fps)])
                if len(nxt):
                    k = k + 1 + nxt[-1]
                    if k >= len(above) - 1:
                        break
                else:
                    break
            end = lo + k / fps
            how_e = ("last note's decay: instrument sum falls > 18 dB under the song's median (or within 10 dB "
                     "of the following gap's floor), gaps < 0.5 s bridged")
            if g1 is not None and end - g1 > 0.5:
                notes.append(f"ring-out/last note continues {end - g1:.1f} s past the grid's last bar line")
    if next_start is not None and end > next_start:
        notes.append(f"segue: runs straight into the next song at {next_start:.2f} (end clamped from {end:.2f})")
        end = next_start
        how_e = "segue into the next song (its first downbeat)"
    conf = 0.9 if grid else 0.7
    return start, end, how_s, how_e, conf, notes


# --------------------------------------------------------------------------- the map


def _dec(x, fps, n):
    """Mean over 0.5 s decision frames."""
    step = int(round(DEC * fps))
    x = np.asarray(x, float)[: n * step]
    if len(x) < n * step:
        x = np.r_[x, np.full(n * step - len(x), x[-1] if len(x) else 0)]
    return x.reshape(n, step).mean(1)


def _spans(labels, t0, min_len_frames=4):
    """Run-length encode a list of labels into spans, absorbing runs shorter than min_len."""
    labs = list(labels)
    changed = True
    while changed:
        changed = False
        rr = []
        s = 0
        for i in range(1, len(labs) + 1):
            if i == len(labs) or labs[i] != labs[s]:
                rr.append((s, i, labs[s]))
                s = i
        for k, (s, e, l) in enumerate(rr):
            if e - s < min_len_frames and len(rr) > 1:
                # absorb into the longer neighbour
                left = rr[k - 1] if k > 0 else None
                right = rr[k + 1] if k + 1 < len(rr) else None
                nb = max([x for x in (left, right) if x], key=lambda x: x[1] - x[0])
                for i in range(s, e):
                    labs[i] = nb[2]
                changed = True
                break
    out = []
    s = 0
    for i in range(1, len(labs) + 1):
        if i == len(labs) or labs[i] != labs[s]:
            out.append((t0 + s * DEC, t0 + i * DEC, labs[s]))
            s = i
    return out


def map_song(band, title, F=None, prev_end=None, next_start=None, crowd=None, ov=None, words=None):
    cfg = C.BANDS[band]
    ov = dict(cfg.get("overrides", {}).get(title, {}), **(ov or {}))
    F = F or Feats(band)
    grid = load_grid(band, title)
    a, b, how_s, how_e, bconf, bnotes = song_bounds(F, band, title, grid, prev_end, next_start, ov)
    ctx = SongCtx(band, title, a, b, F, grid, ov)
    from .lyrics import hook_hits
    ctx.hooks = [(t, h) for t, h in hook_hits(title, words or []) if a - 1 <= t <= b + 1]
    n = int((b - a) / DEC)
    tdec = a + (np.arange(n) + 0.5) * DEC
    fps = F.fps

    # ---- vocals
    cands = ov.get("mics") or list(cfg["vocals"])
    live, ex, act = live_mics(F, a, b, cands)
    live = [m for m in live if m not in ov.get("ignore_mics", [])]
    exd = {m: _dec(ex[m], fps, n) for m in live}
    actd = {m: _dec(act[m], fps, n) > 0.3 for m in live}
    vany = np.zeros(n, bool)
    for m in live:
        vany |= actd[m]
    vblock = close_gaps(vany, int(3.0 / DEC))
    vblock = drop_short(vblock, 3)
    nact = sum(actd[m].astype(int) for m in live) if live else np.zeros(n, int)

    # ---- instruments
    inst = {t: w for t, w in cfg["instruments"].items() if t not in ov.get("ignore_tracks", [])}
    ls, on = lead_scores(ctx, list(inst))
    lsd = {t: _dec(ls[t], fps, n) for t in inst}
    ond = {t: _dec(on[t], fps, n) > 0.5 for t in inst}
    live_inst = [t for t in inst if ond[t].mean() > 0.05]
    # kit playing: kick or snare close mic within 20 dB of its song p95 within the 0.5 s frame
    kd = []
    for tr in ("Kick", "Snare"):
        e = F.get(tr, "env", a, b)
        step = int(DEC * F.env_fps)
        mx = e[: n * step].reshape(-1, step).max(1) if len(e) >= n * step else np.r_[e, np.full(n * step - len(e), -150)].reshape(-1, step).max(1)
        kd.append(mx > np.percentile(e, 99) - 20)
    drums_on = maximum_filter1d((kd[0] | kd[1]).astype(int), 4).astype(bool)  # 2 s hold
    blv = _dec(band_level(F, a, b, music_tracks(band)), fps, n)
    blv_rel = blv - np.median(blv)
    cym = _dec(pow_sum(F.get("OH L", "high", a, b), F.get("OH R", "high", a, b)), fps, n)
    cym_rel = cym - np.median(cym)

    # ---- featured per decision frame
    lead_th, margin = ov.get("lead_th", 0.45), ov.get("lead_margin", 0.15)
    who = []
    feat_inst = [None] * n
    w = int(3.0 / DEC)
    exs = {m: uniform_filter1d(np.where(actd[m], exd[m], 0), w) for m in live}
    for i in range(n):
        if vblock[i] and live:
            m = max(live, key=lambda q: exs[q][i])
            who.append(f"vocal:{m}")
            continue
        sc = sorted(((lsd[t][i] - (0.2 if inst[t] == "bass" else 0.0), t) for t in live_inst
                     if ond[t][i] and inst[t] != "playback"), reverse=True)
        mel_on = [t for t in live_inst if ond[t][i] and inst[t] not in ("playback",)]
        if sc and sc[0][0] > lead_th and (len(sc) == 1 or sc[0][0] - sc[1][0] > margin) and len(mel_on) > 1:
            feat_inst[i] = sc[0][1]
            who.append(inst[sc[0][1]])
        elif not mel_on and drums_on[i]:
            who.append("drums")
        elif len(mel_on) == 1 and not drums_on[i]:
            who.append(inst[mel_on[0]])
        elif not mel_on and not drums_on[i]:
            who.append("band")  # ring-out / silence inside the song
        else:
            who.append("band")
    # features confirmed by looking where no audio term separates them (config overrides "seen_features")
    seen_ev = {}
    for f0, f1, wv, why in ov.get("seen_features", []):
        for q in range(max(0, int((f0 - a) / DEC)), min(n, int((f1 - a) / DEC))):
            if who[q] == "band":
                who[q] = wv
                seen_ev[wv] = why
    # a short breath of "band" (< 6 s) between two phrases of the same singer stays on that singer
    k = 0
    while k < n:
        if who[k] == "band":
            e = k
            while e < n and who[e] == "band":
                e += 1
            if k > 0 and e < n and who[k - 1] == who[e] and who[e].startswith("vocal:") and (e - k) * DEC < 6:
                for q in range(k, e):
                    who[q] = who[e]
            k = e
        else:
            k += 1
    w2t = {v: k for k, v in inst.items()}
    for q in range(n):
        if who[q] in w2t:
            feat_inst[q] = w2t[who[q]]
    # instrument features must hold >= 3 s; vocal spans >= 2 s
    spans = _spans(who, a, min_len_frames=int(ov.get("min_feature_s", 3.0) / DEC))
    featured = []
    for s0, s1, wv in spans:
        i0, i1 = int((s0 - a) / DEC), int((s1 - a) / DEC)
        ev = {}
        if wv.startswith("vocal:"):
            m = wv.split(":", 1)[1]
            others = [o for o in live if o != m and actd[o][i0:i1].mean() > 0.3]
            strength = float(np.clip(np.mean(exd[m][i0:i1]) / 20, 0, 1))
            evid = f"{m} {np.mean(exd[m][i0:i1]):.0f} dB over bleed, active {actd[m][i0:i1].mean():.0%}"
            if others:
                ev["with"] = [f"vocal:{o}" for o in others]
                evid += "; also " + ", ".join(f"{o} {actd[o][i0:i1].mean():.0%}" for o in others)
        elif wv in ("band", "drums"):
            strength = 0.5
            evid = "vocals off; " + ("only the kit playing" if wv == "drums" else "no instrument leads")
        elif wv in seen_ev and not any(lsd[t][i0:i1].mean() > lead_th for t, x in inst.items() if x == wv):
            strength = 0.6
            evid = f"vocals off; seen, not measured: {seen_ev[wv]}"
        else:
            tr = [t for t, x in inst.items() if x == wv][0]
            strength = float(np.clip(np.mean(lsd[tr][i0:i1]), 0, 1))
            evid = f"vocals off; {tr} lead score {np.mean(lsd[tr][i0:i1]):.2f} (mono+boost+bright)"
            if len([t for t in live_inst if ond[t][i0:i1].mean() > 0.5]) == 1:
                evid = f"vocals off; {tr} plays alone"
                strength = 0.9
        featured.append(dict(start_s=round(s0, 2), end_s=round(s1, 2), who=wv, strength=round(strength, 2),
                             evidence=evid, **ev))

    # ---- secondary: an instrument playing a lead line under the vocals (fills, melodies)
    under = []
    for i in range(n):
        lab = "-"
        if vblock[i]:
            sc = sorted(((lsd[t][i] - (0.2 if inst[t] == "bass" else 0.0), t) for t in live_inst
                         if ond[t][i] and inst[t] != "playback"), reverse=True)
            if sc and sc[0][0] > ov.get("under_th", 0.6) and (len(sc) == 1 or sc[0][0] - sc[1][0] > margin):
                lab = sc[0][1]
        under.append(lab)
    secondary = []
    for s0, s1, tr in _spans(under, a, min_len_frames=1):
        if tr != "-" and s1 - s0 >= 3.0:
            i0, i1 = int((s0 - a) / DEC), int((s1 - a) / DEC)
            secondary.append(dict(start_s=round(s0, 2), end_s=round(s1, 2), who=inst[tr],
                                  strength=round(float(np.clip(np.mean(lsd[tr][i0:i1]), 0, 1)), 2),
                                  evidence=f"lead line under the vocals: {tr} lead score {np.mean(lsd[tr][i0:i1]):.2f}"))

    # ---- sections
    sections = build_sections(ctx, tdec, vblock, nact, blv_rel, cym_rel, drums_on, feat_inst, inst, exd, actd, live)

    # ---- events
    events = [dict(t_s=round(a, 2), kind="song_start", confidence=round(bconf, 2)),
              dict(t_s=round(b, 2), kind="song_end", confidence=round(bconf, 2))]
    for s, e in runs(vblock):
        if s == 0 or not vblock[max(0, s - int(4 / DEC)):s].any():
            m = max(live, key=lambda q: exd[q][s:min(e, s + 6)].mean()) if live else None
            # refine to the feature-rate onset of that mic
            t_on = a + s * DEC
            if m:
                k0 = max(0, int((t_on - 1.0 - a) * fps))
                seg = act[m][k0:k0 + int(2.5 * fps)]
                if seg.any():
                    t_on = a + (k0 + np.flatnonzero(seg)[0]) / fps
            events.append(dict(t_s=round(t_on, 2), kind="vocal_entry", confidence=0.9, who=f"vocal:{m}"))
    for f in featured:
        if f["who"] not in ("band", "drums") and not f["who"].startswith("vocal:") and f["end_s"] - f["start_s"] >= 4:
            events.append(dict(t_s=f["start_s"], kind="solo_start", confidence=f["strength"], who=f["who"]))
            events.append(dict(t_s=f["end_s"], kind="solo_end", confidence=f["strength"], who=f["who"]))
    hits, fills = tom_fills_lo(F, a, b)
    sec_starts = np.array([s["start_s"] for s in sections])
    for f0, f1, k in fills:
        into = bool(len(sec_starts) and np.min(np.abs(sec_starts - f1)) < 1.0)
        near = sum(1 for g0, g1, _ in fills if g0 != f0 and abs(g0 - f0) < 10)
        pattern = (f1 - f0) > 3.0 or near >= 2  # a tom groove repeating every bar, not a fill
        conf = 0.2 if pattern else min(1.0, 0.4 + 0.1 * k + (0.2 if into else 0))
        events.append(dict(t_s=round(f0, 2), kind="drum_fill", confidence=round(conf, 2),
                           end_s=round(f1, 2), hits=int(k), into_section=into, pattern=bool(pattern)))
    st, _ = stops(F, a, b, music_tracks(band))
    for s0, s1 in st:
        if a + 1 < s0 < b - 2:
            events.append(dict(t_s=round(s0, 2), kind="stop", confidence=0.8, end_s=round(s1, 2)))
            events.append(dict(t_s=round(s1, 2), kind="big_hit", confidence=0.7))
    # big hits at section starts with a cymbal jump
    for s in sections[1:]:
        i = int((s["start_s"] - a) / DEC)
        if 2 <= i < n - 2 and cym[i:i + 2].mean() - cym[i - 2:i].mean() > 9:
            events.append(dict(t_s=s["start_s"], kind="big_hit", confidence=0.6))
    if crowd is not None:
        ct, cover, cabs, _ = crowd
        sel = (ct >= a - 2) & (ct <= b + 20)
        tt = ct[sel]
        song = (tt >= a) & (tt <= b)
        base = np.nanmedian(cover[sel][song]) if song.any() else 0.0
        rel = np.nan_to_num(cover[sel] - base, nan=-99)
        m = close_gaps(rel > ov.get("crowd_th", 7.0), 20)
        for s0, s1 in runs(m, 20):
            events.append(dict(t_s=round(float(tt[s0]), 2), kind="crowd_cheer",
                               confidence=0.7 if tt[s0] > b - 3 else 0.5, end_s=round(float(tt[s1 - 1]), 2),
                               peak_db=round(float(np.max(rel[s0:s1])), 1)))
    events.sort(key=lambda e: e["t_s"])

    performers = {f"vocal:{m}": cfg["vocals"].get(m, "unidentified mic (live in this song)") for m in live}
    players = dict(cfg.get("players", {}), **cfg.get("song_players", {}).get(title, {}))
    for t in live_inst:
        performers[inst[t]] = players.get(inst[t], t)
    performers["drums"] = players.get("drums", "drummer")
    for k_, v_ in cfg.get("song_vocals", {}).get(title, {}).items():
        if f"vocal:{k_}" in performers:
            performers[f"vocal:{k_}"] = v_
    def role(wv):
        if wv.startswith("vocal:"):
            return "singer"
        if wv.startswith("guitar") or wv in ("acoustic",):
            return "guitarist"
        return {"keys": "keys", "bass": "bass", "drums": "drummer", "erhu": "other instrument"}.get(wv, "other")

    sx = cfg.get("stage_x", {})
    who_index = {wv: dict(role=role(wv), stage_x=sx.get(wv), desc=d) for wv, d in performers.items()}
    out = dict(
        song=title, set=cfg["name"], band_key=band,
        start_s=round(a, 2), end_s=round(b, 2),
        start_tc=C.ref_to_tc(a), end_tc=C.ref_to_tc(b),
        boundary=dict(start_how=how_s, end_how=how_e, confidence=bconf, notes=bnotes,
                      grid_start_s=grid["start_s"] if grid else None, grid_end_s=grid["end_s"] if grid else None),
        live_mics=live, live_instruments={t: inst[t] for t in live_inst},
        sections=sections, featured=featured, secondary=secondary, events=events, performers=performers,
        who=who_index,
        stage_x=cfg.get("stage_x", {}),
        lyrics=_phrases(words or [], a, b),
        hooks=[dict(t_s=t, phrase=h) for t, h in ctx.hooks],
        method="songmap.analyse v1 (bottb doc/production/scripts/songmap)",
    )
    return out


def _phrases(words, a, b):
    """Whisper phrases (segment timestamps) inside the song, for the editor and the cutter."""
    out, seen = [], set()
    for w in words:
        k = (w.get("phrase_start"), w.get("phrase_end"))
        if k[0] is None or k in seen or not (a - 1 <= k[0] <= b + 1):
            continue
        seen.add(k)
        out.append(dict(start_s=k[0], end_s=k[1], text=" ".join(x["w"] for x in words
                                                                if (x.get("phrase_start"), x.get("phrase_end")) == k)))
    return out


def tom_fills_lo(F, a, b):
    """Tom hits from the 300 Hz low-passed envelopes: a >= 8 dB rise within 30 ms to within 10 dB
    of that tom's song p99 (snare/kick bleed sits lower); fill = >= 3 hits, gaps < 0.5 s."""
    hits = []
    for tr in ("T1", "T2", "FT"):
        e = F.get(tr, "envlo", a, b)
        top = np.percentile(e, 99.5)
        de = e - np.r_[np.full(3, e[0]), e[:-3]]
        cand = (de > 8) & (e > top - 10)
        idx = np.flatnonzero(cand & ~np.r_[False, cand[:-1]])
        last = -100
        for i in idx:
            if i - last >= 6:
                hits.append(a + i / F.env_fps)
                last = i
    hits = np.sort(np.array(hits))
    fills = []
    i = 0
    while i < len(hits):
        j = i
        while j + 1 < len(hits) and hits[j + 1] - hits[j] < 0.5:
            j += 1
        if j - i + 1 >= 3:
            fills.append((float(hits[i]), float(hits[j]), j - i + 1))
        i = j + 1
    return hits, fills


def build_sections(ctx, tdec, vblock, nact, blv_rel, cym_rel, drums_on, feat_inst, inst, exd, actd, live):
    a, b, grid = ctx.a, ctx.b, ctx.grid
    n = len(tdec)
    # ---- base boundaries
    if grid:
        base = [(max(a, s["start_s"]), min(b, s["end_s"]), s["label"], s["desc"]) for s in grid["sections"]
                if min(b, s["end_s"]) - max(a, s["start_s"]) > 0.5]
        bars = [x["t"] for x in grid["bars"]]
        # pad head/tail outside the grid window
        if base and base[0][0] - a > 1.5:
            base.insert(0, (a, base[0][0], "-", "before the grid's first bar"))
        if base and b - base[-1][1] > 1.5:
            base.append((base[-1][1], b, "-", "after the grid's last bar (ring-out)"))
        elif base:
            base[-1] = (base[-1][0], b, base[-1][2], base[-1][3])
    else:
        base = novelty_sections(ctx)
        bars = []
    # ---- split on vocal state changes: none / one singer / two or more (>= 6 s each side, bar-snapped)
    dual = uniform_filter1d((nact >= 2).astype(float), 4) > 0.5
    state = np.where(~vblock, 0, np.where(dual, 2, 1))
    # smooth the state: runs shorter than 4 s take the neighbour's state
    st = state.copy()
    changed = True
    while changed:
        changed = False
        b_ = [0] + [i for i in range(1, len(st)) if st[i] != st[i - 1]] + [len(st)]
        for x0, x1 in zip(b_[:-1], b_[1:]):
            if x1 - x0 < int(4 / DEC) and (x0 > 0 or x1 < len(st)):
                st[x0:x1] = st[x0 - 1] if x0 > 0 else st[x1]
                changed = True
                break
    segs = []
    for s0, s1, let, desc in base:
        i0, i1 = int((s0 - a) / DEC), max(int((s0 - a) / DEC) + 1, int((s1 - a) / DEC))
        v = st[i0:i1]
        cut_pts = [c for c in range(1, len(v)) if v[c] != v[c - 1]]
        pieces = [s0]
        for c in cut_pts:
            tc = snap_to_bar(s0 + c * DEC, bars) if bars else s0 + c * DEC
            if tc - pieces[-1] >= 6 and s1 - tc >= 6:
                pieces.append(tc)
        pieces.append(s1)
        for p0, p1 in zip(pieces[:-1], pieces[1:]):
            j0, j1 = int((p0 - a) / DEC), max(int((p0 - a) / DEC) + 1, int((p1 - a) / DEC))
            stv = int(np.round(np.median(st[j0:j1])))
            key = let + ["·0", "·1", "·2"][stv]
            segs.append(dict(start_s=p0, end_s=p1, letter=let, key=key, desc=desc, split=len(pieces) > 2))
    # merge pieces whose vocal state equals the neighbour's and were split for nothing (keep grid letters)
    # ---- measure
    for s in segs:
        i0, i1 = int((s["start_s"] - a) / DEC), max(int((s["start_s"] - a) / DEC) + 1, int((s["end_s"] - a) / DEC))
        s["voc"] = float(vblock[i0:i1].mean())
        s["dual"] = float((nact[i0:i1] >= 2).mean()) if live else 0.0
        s["energy"] = float(np.mean(blv_rel[i0:i1]))
        s["cym"] = float(np.mean(cym_rel[i0:i1]))
        s["drums"] = float(drums_on[i0:i1].mean())
        fi = [x for x in feat_inst[i0:i1] if x]
        s["feat"] = max(set(fi), key=fi.count) if fi and len(fi) > 0.35 * (i1 - i0) else None
        s["feat_frac"] = (fi.count(s["feat"]) / (i1 - i0)) if s["feat"] else 0.0
        if live:
            sc = {m: float(np.mean(np.where(actd[m][i0:i1], exd[m][i0:i1], 0))) for m in live}
            s["lead"] = max(sc, key=sc.get) if s["voc"] > 0.3 else None
        else:
            s["lead"] = None
    label_sections(ctx, segs)
    out = []
    for s in segs:
        out.append(dict(start_s=round(s["start_s"], 2), end_s=round(s["end_s"], 2), label=s["label"],
                        confidence=round(s["conf"], 2), evidence=s["evidence"], grid_letter=s["letter"],
                        group=s["key"],
                        energy_db=round(s["energy"], 1), vocals=round(s["voc"], 2), dual_vocals=round(s["dual"], 2),
                        lead=f"vocal:{s['lead']}" if s["lead"] else (inst.get(s["feat"]) if s["feat"] else None)))
    # merge consecutive same-label sections with the same grid letter
    merged = []
    for s in out:
        if merged and merged[-1]["label"] == s["label"] and merged[-1]["group"] == s["group"] \
                and merged[-1]["lead"] == s["lead"]:
            merged[-1]["end_s"] = s["end_s"]
        else:
            merged.append(s)
    return merged


def label_sections(ctx, segs):
    a, b = ctx.a, ctx.b
    ov = ctx.overrides
    k = len(segs)
    vocal = [s["voc"] >= 0.35 for s in segs]
    strong = [s["voc"] >= 0.5 for s in segs]
    # a vocal pickup before the grid's first bar is the intro, not a verse
    head = 0
    while head < k and segs[head]["letter"] == "-" and segs[head]["start_s"] <= a + 0.01 and ctx.grid:
        head += 1
    fv = next((i for i in range(head, k) if strong[i]), None)
    lv = next((i for i in reversed(range(k)) if strong[i]), None)
    # chroma similarity among sections (repetition)
    M = chroma_ssm_sim(ctx, [(s["start_s"], s["end_s"]) for s in segs])
    for s in segs:
        s["label"], s["conf"], s["evidence"] = "unknown", 0.3, ""
    # vocal-section clusters: same grid letter, or chroma similarity >= 0.88
    vidx = [i for i in range(k) if vocal[i]]
    cl = {i: i for i in vidx}

    def find(i):
        while cl[i] != i:
            i = cl[i]
        return i

    for x in vidx:
        for y in vidx:
            if x < y and segs[x]["key"] == segs[y]["key"] and segs[x]["letter"] != "-":
                cl[find(y)] = find(x)
    if not ctx.grid:  # no letters: chroma repetition, strict
        for x in vidx:
            for y in vidx:
                if x < y and M[x, y] >= 0.93:
                    cl[find(y)] = find(x)
    groups = {}
    for i in vidx:
        groups.setdefault(find(i), []).append(i)
    # chorus score per section: energy + cymbals + dual vocals
    def score(i):
        s = segs[i]
        return s["energy"] / 3 + s["cym"] / 4 + 1.5 * s["dual"]

    gscore = {g: np.mean([score(i) for i in m]) for g, m in groups.items()}
    rep = [g for g, m in groups.items() if len(m) >= 2]
    chorus_g = None
    if ov.get("chorus_letters"):
        cg = [g for g, m in groups.items() if any(segs[i]["letter"] in ov["chorus_letters"] for i in m)]
        chorus_g = cg[0] if cg else None
    elif rep:
        chorus_g = max(rep, key=lambda g: gscore[g])
        others = [gscore[g] for g in groups if g != chorus_g]
        marg = gscore[chorus_g] - (max(others) if others else gscore[chorus_g] - 1)
    chorus_set = set(groups.get(chorus_g, []))
    hook_n = {i: sum(1 for t, _ in ctx.hooks if segs[i]["start_s"] - 0.5 <= t < segs[i]["end_s"]) for i in range(k)}
    hook_secs = {i for i in vidx if hook_n[i] >= 1}
    use_hooks = len(hook_secs) >= 2 and not ov.get("chorus_letters")
    if use_hooks:
        chorus_set = hook_secs
    # if one huge group (everything same letter), split it by score
    if chorus_g is not None and len(chorus_set) >= 0.8 * len(vidx) and len(vidx) >= 4:
        sc = np.array([score(i) for i in vidx])
        thr = np.median(sc)
        chorus_set = {i for i in vidx if score(i) > thr + 0.15}
    first_ch = min(chorus_set) if chorus_set else None
    ch_seen = 0
    verse_groups = set()
    for i in range(k):
        s = segs[i]
        if fv is None:
            s["label"], s["conf"], s["evidence"] = ("solo" if s["feat"] else "unknown"), 0.3, "no vocals in the song"
            continue
        if i < fv:
            s["label"], s["conf"] = "intro", 0.85
            s["evidence"] = "before the first vocal" if i >= head or not vocal[i] else \
                "unaccompanied vocal pickup before the band's first downbeat"
            if s["feat"]:
                s["evidence"] += f"; {s['feat']} leads"
            continue
        if i > lv:
            s["label"], s["conf"] = "outro", 0.8
            s["evidence"] = "after the last vocal"
            continue
        if not vocal[i]:
            if s["feat"] and s["feat_frac"] > 0.4:
                s["label"], s["conf"] = "solo", float(min(0.9, 0.4 + s["feat_frac"] / 2))
                s["evidence"] = f"vocals off; {s['feat']} leads {s['feat_frac']:.0%} of it"
            elif s["energy"] < -5 or s["drums"] < 0.3:
                s["label"], s["conf"] = "breakdown", 0.6
                s["evidence"] = f"vocals off; band {s['energy']:+.0f} dB vs song median, drums {s['drums']:.0%}"
            else:
                s["label"], s["conf"] = "unknown", 0.4
                s["evidence"] = "instrumental (vocals off, no instrument clearly leads)"
            continue
        if i in chorus_set:
            ch_seen += 1
            s["label"] = "chorus"
            if use_hooks:
                hk = sorted({h for t, h in ctx.hooks if s["start_s"] - 0.5 <= t < s["end_s"]})
                s["conf"] = 0.8
                s["evidence"] = (f"sings the hook ({', '.join(repr(x) for x in hk)} x{hook_n[i]}, Whisper on the vocal "
                                 f"mics); energy {s['energy']:+.1f} dB, dual vocals {s['dual']:.0%}")
            else:
                s["conf"] = 0.6 if len(chorus_set) >= 2 else 0.4
                s["evidence"] = (f"repeated vocal section (letter {s['letter']}), loudest repeated group: "
                                 f"energy {s['energy']:+.1f} dB, cymbals {s['cym']:+.1f} dB, dual vocals {s['dual']:.0%}")
            continue
        g = find(i)
        nxt_is_ch = (i + 1 < k and (i + 1) in chorus_set)
        dur = s["end_s"] - s["start_s"]
        if nxt_is_ch and dur <= 16 and g not in verse_groups and len(groups[g]) >= 2 and first_ch is not None and i > fv:
            s["label"], s["conf"] = "pre", 0.4
            s["evidence"] = f"short vocal section ({dur:.0f} s) leading into a chorus, repeated"
            continue
        if ch_seen >= 2 and len(groups[g]) == 1 and not any(x.get("label") == "bridge" for x in segs[:i]) \
                and (i + 1 >= k or segs[i + 1].get("letter") != s["letter"]):
            s["label"], s["conf"] = "bridge", 0.45
            s["evidence"] = "vocal section after the second chorus, not heard before"
            continue
        if not use_hooks and chorus_set and len(groups[g]) == 1 and \
                score(i) >= np.mean([score(j) for j in chorus_set]) - 0.2:
            s["label"], s["conf"] = "chorus", 0.35
            s["evidence"] = (f"one-off vocal section as loud as the choruses (energy {s['energy']:+.1f} dB, "
                             f"dual {s['dual']:.0%}): a chorus variant or final chorus")
            continue
        verse_groups.add(g)
        s["label"], s["conf"] = "verse", 0.5 if chorus_set else 0.35
        s["evidence"] = f"vocal section, not the loud repeated group (energy {s['energy']:+.1f} dB, dual {s['dual']:.0%})"


def novelty_sections(ctx):
    """Fallback when there is no grid: Foote novelty on the instrument mel + chroma, 0.5 s frames."""
    F = ctx.F
    mel = F.group("mel_inst", ctx.a, ctx.b)
    ch = F.group("chroma_inst", ctx.a, ctx.b)
    step = int(DEC * F.fps)
    n = len(mel) // step
    X = np.concatenate([mel[: n * step].reshape(n, step, -1).mean(1),
                        3 * ch[: n * step].reshape(n, step, -1).mean(1)], 1)
    X = (X - X.mean(0)) / (X.std(0) + 1e-6)
    S = np.corrcoef(X)
    L = 16  # 8 s kernel half-width
    g = np.outer(np.r_[-np.ones(L), np.ones(L)], np.r_[-np.ones(L), np.ones(L)])
    nov = np.zeros(n)
    for i in range(L, n - L):
        nov[i] = np.sum(S[i - L:i + L, i - L:i + L] * g)
    peaks = [i for i in range(L, n - L) if nov[i] == nov[max(0, i - 12):i + 12].max() and nov[i] > np.percentile(nov, 70)]
    bounds = [ctx.a] + [ctx.a + p * DEC for p in peaks] + [ctx.b]
    return [(x, y, "-", "novelty (no grid)") for x, y in zip(bounds[:-1], bounds[1:]) if y - x > 0.5]
