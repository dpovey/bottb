#!/usr/bin/env python3
"""Vocal harmony / bleed scan for live-concert multitrack vocal mics.

Answers "who is actually singing a harmony part, when, on what interval, and how
much did the processing move it?" on bleed-heavy live vocal mics, where every mic
hears every singer and a naive level or pitch reading is dominated by bleed.

    vocal_harmony_scan.py --raw RAWDIR [--proc PROCDIR] --songs "241:500,540:762,..."
        --mic v1="17 Vox 1.wav" --mic v2="15 Vox 2.wav" ... --lead v2
        [--proc-mic v1="Vox 1_1.wav" ...] [--bus "VOX_1.wav"]
        [--only-song 6] [--stages 2,3,5] [--fine]
        [--timeline 1688 1695 0.25] [--out report.json]

--raw is the folder of raw (pre-plugin) mic files; --proc the matching folder of
post-plugin exported stems (optional - without it the raw-vs-processed stages are
skipped). --bus is a stereo vocal-bus stem inside --proc. Processed files are
matched to raw mics by loose name ("15 Vox 2.wav" -> "Vox 2" -> "Vox 2 Lead_1.wav")
unless --proc-mic says otherwise. Everything is analysed mono (channels averaged).

Stages (all on by default, pick with --stages):
  1  raw-vs-processed alignment (1 ms RMS envelope cross-correlation, +-300 ms)
  2  voice-band (200-3000 Hz) activity map, per-song floor = p20, active = floor+10 dB
  3  prominence histograms (own level minus loudest other mic) - the bleed check
  4  pitch tracks (pyin at 16 kHz) and per-mic f0 percentiles
  5  interval analysis per mic pair: unison/octave %, 50-cent histogram, ET vs JI
  6  raw-vs-processed pitch shift per mic (tuning correction / within-note drift)
  7  bleed-proof note-onset timing on notes that are >=150 c away from the other voice
  8  per-voice third-octave spectrum while singing, bleed floor subtracted
  9  per-phrase level spread raw vs processed, bus-minus-sum and bus width
 10  --timeline START END [STEP] note-name table (repeatable)

Stage 4 (pyin) is the expensive one, roughly 20-60x real time per file. Results are
cached in an .npz beside --out (or --cache) keyed by file path + mtime + song range
+ resolution, so re-runs of the other stages are instant. --fine drops the pyin
resolution from 0.1 to 0.02 semitone (much slower) for close interval work.

Notes learned the hard way: use the band-limited envelope, never wideband (bass
bleed swamps the wideband gate); do NOT gate on pyin's voiced_prob, which sits
around 0.05 on these mics - gate on f0-not-NaN plus the band level; pitch frames
are 10 ms, so a song of (b-a) s has (b-a)*100 frames.
"""
import argparse, hashlib, json, math, os, re, sys, warnings
from itertools import combinations

import numpy as np
import scipy.signal as ss
import soundfile as sf

warnings.filterwarnings("ignore")

PITCH_SR = 16000
PITCH_HOP = 160            # 10 ms frames
PITCH_FRAME = 1024
FMIN, FMAX = 70.0, 1000.0
BAND = (200.0, 3000.0)     # voice band for the activity/level gate
THR_DB = 10.0              # active = per-song p20 floor + THR_DB
FPS = 100                  # pitch frames per second

# Third-octave centres 100 Hz .. 10 kHz (stage 8)
TO_CENTRES = np.array([100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000,
                       1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000], float)
TO_EDGES = np.concatenate([[TO_CENTRES[0] / 2 ** (1 / 6)], TO_CENTRES * 2 ** (1 / 6)])

# Harmonic interval classes: equal-tempered cents -> name, and the just target
IV_NAMES = {300: "m3", 400: "M3", 500: "P4", 700: "P5", 800: "m6", 900: "M6"}
IV_JUST = {300: 316, 400: 386, 500: 498, 700: 702, 800: 814, 900: 884}


# ---------------------------------------------------------------- helpers

def stem_key(path):
    """Loose stem name: '15 Vox 2.wav' -> 'Vox 2', 'Vox 2 Lead_1.wav' -> 'Vox 2 Lead'."""
    n = os.path.basename(path)
    n = re.sub(r"\.(wav|aif|aiff|flac)$", "", n, flags=re.I)
    n = re.sub(r"_\d+$", "", n)
    n = re.sub(r"^\d+\s+", "", n)
    return n.strip()


def parse_kv(s):
    name, _, val = s.partition("=")
    if not val:
        raise argparse.ArgumentTypeError(f"expected NAME=FILENAME, got {s!r}")
    return name.strip(), val.strip()


def db(power):
    return 10 * np.log10(np.asarray(power) + 1e-12)


def read_mono(path, a=None, b=None):
    """Mono float32 (channels averaged) for seconds [a, b), plus sample rate."""
    info = sf.info(path)
    sr = info.samplerate
    kw = {}
    if a is not None:
        kw["start"] = int(a * sr)
        kw["stop"] = min(int(b * sr), info.frames)
    x, _ = sf.read(path, dtype="float32", always_2d=True, **kw)
    return (x[:, 0] if x.shape[1] == 1 else x.mean(1)).astype(np.float32), sr


def env_scan(path):
    """Stream a file once -> 1 ms and 100 ms full-band envelopes plus the 100 ms
    voice-band (200-3000 Hz) envelope, all in dB. Never holds the whole file."""
    info = sf.info(path)
    sr = info.samplerate
    hop1, hop100 = sr // 1000, sr // 10
    sos = ss.butter(4, list(BAND), btype="band", fs=sr, output="sos")
    zi = np.zeros((sos.shape[0], 2))
    e1, ef, eb = [], [], []
    for blk in sf.blocks(path, blocksize=hop100 * 10, dtype="float32", always_2d=True):
        x = blk[:, 0] if blk.shape[1] == 1 else blk.mean(1)
        y, zi = ss.sosfilt(sos, x, zi=zi)
        n1 = len(x) // hop1
        if n1:
            e1.append((x[:n1 * hop1].reshape(n1, hop1) ** 2).mean(1))
        n100 = len(x) // hop100
        if n100:
            ef.append((x[:n100 * hop100].reshape(n100, hop100) ** 2).mean(1))
            eb.append((y[:n100 * hop100].reshape(n100, hop100) ** 2).mean(1))
    cat = lambda v: db(np.concatenate(v)) if v else np.zeros(0)
    return {"sr": sr, "seconds": info.frames / sr,
            "e1": cat(e1), "e100": cat(ef), "eband": cat(eb)}


def segments(mask, minlen=5, gap=5):
    """Contiguous runs of a boolean frame mask, merging gaps < `gap` frames."""
    idx = np.flatnonzero(mask)
    if not len(idx):
        return []
    out, s, p = [], idx[0], idx[0]
    for i in idx[1:]:
        if i - p > gap:
            out.append((s, p))
            s = i
        p = i
    out.append((s, p))
    return [(a, b) for a, b in out if b - a + 1 >= minlen]


def note_of(hz):
    import librosa
    return librosa.hz_to_note(float(hz))


def notes_from_track(f0, minlen=15, jump=150):
    """Segment a 10 ms pitch track (NaN = unvoiced) into notes: runs of voiced
    frames with no jump > `jump` cents from the running median.
    -> [(start_frame, end_frame, median_hz)]"""
    out, i, n = [], 0, len(f0)
    while i < n:
        if np.isnan(f0[i]):
            i += 1
            continue
        j, vals = i, [f0[i]]
        while (j + 1 < n and not np.isnan(f0[j + 1])
               and abs(1200 * np.log2(f0[j + 1] / np.median(vals[-10:]))) < jump):
            j += 1
            vals.append(f0[j])
        if j - i + 1 >= minlen:
            out.append((i, j, float(np.median(vals))))
        i = j + 1
    return out


def song_gate(env_band, a, b, n):
    """Per-song level gate: (mask over n 10 ms frames, floor dB)."""
    seg = env_band[a * 10:b * 10]
    floor = float(np.percentile(seg, 20))
    lev = np.repeat(seg, 10)[:n]
    if len(lev) < n:
        lev = np.concatenate([lev, np.full(n - len(lev), floor)])
    return lev > floor + THR_DB, floor


def to_bands(power_spec, freqs):
    return np.array([power_spec[(freqs >= lo) & (freqs < hi)].sum()
                     for lo, hi in zip(TO_EDGES[:-1], TO_EDGES[1:])])


# ---------------------------------------------------------------- pitch

class PyinCache:
    def __init__(self, path):
        self.path = path
        self.data = {}
        if path and os.path.exists(path):
            with np.load(path) as z:
                self.data = {k: z[k] for k in z.files}
        self.dirty = False

    @staticmethod
    def key(path, a, b, resolution):
        st = os.stat(path)
        raw = f"{os.path.abspath(path)}|{st.st_mtime_ns}|{st.st_size}|{a}|{b}|{resolution}|{FMIN}|{FMAX}"
        return "k" + hashlib.sha1(raw.encode()).hexdigest()[:20]

    def get(self, k):
        return self.data.get(k)

    def put(self, k, v):
        self.data[k] = v.astype(np.float32)
        self.dirty = True

    def flush(self):
        if self.path and self.dirty:
            os.makedirs(os.path.dirname(os.path.abspath(self.path)), exist_ok=True)
            np.savez(self.path, **self.data)
            self.dirty = False


def pitch_track(path, a, b, resolution, cache):
    """f0 in Hz on 10 ms frames for seconds [a, b), NaN where unvoiced."""
    k = cache.key(path, a, b, resolution)
    hit = cache.get(k)
    if hit is not None:
        return hit
    import librosa
    x, sr = read_mono(path, a, b)
    if sr != PITCH_SR:
        g = math.gcd(PITCH_SR, sr)
        x = ss.resample_poly(x, PITCH_SR // g, sr // g).astype(np.float32)
    print(f"    pyin {os.path.basename(path)} {a}-{b}s …", file=sys.stderr, flush=True)
    f0, _, _ = librosa.pyin(x, fmin=FMIN, fmax=FMAX, sr=PITCH_SR,
                            frame_length=PITCH_FRAME, hop_length=PITCH_HOP,
                            resolution=resolution, fill_na=np.nan)
    f0 = f0.astype(np.float32)
    cache.put(k, f0)
    cache.flush()
    return f0


def load_pitch(ctx, src, song):
    """{mic: f0[n]} plus the level-gated voiced masks, for one song."""
    a, b = song["start"], song["end"]
    files = ctx["raw_files"] if src == "raw" else ctx["proc_files"]
    n = (b - a) * FPS
    f0 = {}
    for m in ctx["mics"]:
        t = pitch_track(files[m], a, b, ctx["resolution"], ctx["cache"])
        n = min(n, len(t))
        f0[m] = t
    voiced, floors = {}, {}
    for m in ctx["mics"]:
        f0[m] = f0[m][:n]
        gate, floor = song_gate(ctx["env"]["raw"][m]["eband"], a, b, n)
        voiced[m] = gate & ~np.isnan(f0[m])
        floors[m] = floor
    return f0, voiced, floors, n


# ---------------------------------------------------------------- stages

def stage1_alignment(ctx, report):
    print("\n=== 1. alignment: processed vs raw, 1 ms RMS envelope xcorr (+-300 ms) ===")
    out = []
    for song in ctx["songs"]:
        a, b = song["start"], song["end"]
        row = {"song": song["index"], "mics": {}}
        cells = []
        for m in ctx["mics"]:
            ea = ctx["env"]["raw"][m]["e1"][a * 1000:b * 1000]
            eb = ctx["env"]["proc"][m]["e1"][a * 1000:b * 1000]
            n = min(len(ea), len(eb))
            ea, eb = ea[:n] - ea[:n].mean(), eb[:n] - eb[:n].mean()
            c = ss.correlate(eb, ea, mode="full", method="fft")
            lags = np.arange(-n + 1, n)
            sel = np.abs(lags) <= 300
            i = int(np.argmax(c[sel]))
            lag = int(lags[sel][i])
            nc = float(c[sel][i] / (np.sqrt((ea ** 2).sum() * (eb ** 2).sum()) + 1e-12))
            row["mics"][m] = {"lag_ms": lag, "corr": round(nc, 3)}
            cells.append(f"{m} {lag:+d} ms r={nc:.2f}" + ("  ** CHECK **" if abs(lag) > 5 else ""))
        print(f"  song {song['index']} ({a}-{b}s): " + " | ".join(cells))
        out.append(row)
    bad = [(r["song"], m) for r in out for m, v in r["mics"].items() if abs(v["lag_ms"]) > 5]
    if bad:
        print(f"  WARNING: |lag| > 5 ms on {len(bad)} song/mic pairs - stages 6/9 compare "
              f"misaligned material: {bad[:8]}")
    else:
        print("  all lags within +-5 ms - raw and processed are sample-aligned enough to compare")
    report["alignment"] = out


def stage2_activity(ctx, report):
    print(f"\n=== 2. voice-band activity ({BAND[0]:.0f}-{BAND[1]:.0f} Hz, 100 ms RMS, "
          f"active = per-song p20 floor + {THR_DB:.0f} dB) ===")
    backing = [m for m in ctx["mics"] if m != ctx["lead"]]
    out = []
    for song in ctx["songs"]:
        a, b = song["start"], song["end"]
        print(f"  --- song {song['index']} {a}-{b}s")
        row = {"song": song["index"], "mics": {}}
        masks = {}
        for m in ctx["mics"]:
            seg = ctx["env"]["raw"][m]["eband"][a * 10:b * 10]
            floor = float(np.percentile(seg, 20))
            mask = seg > floor + THR_DB
            masks[m] = mask
            segs = segments(mask)
            tot = sum(y - x + 1 for x, y in segs) / 10
            lab = " (lead)" if m == ctx["lead"] else ""
            print(f"    {m}{lab}: floor {floor:.1f} dB  active {tot:.0f}s "
                  f"({tot / (b - a) * 100:.0f}%)  {len(segs)} segs: "
                  + " ".join(f"{a + x / 10:.0f}-{a + y / 10:.0f}" for x, y in segs[:20]))
            row["mics"][m] = {"floor_db": round(floor, 1), "active_s": round(tot, 1),
                              "active_pct": round(tot / (b - a) * 100, 1),
                              "segments": [[round(a + x / 10, 1), round(a + y / 10, 1)] for x, y in segs]}
        ctx["masks"][song["index"]] = masks
        bk = sum(masks[m].astype(int) for m in backing)
        for k in (2, 3):
            if k > len(backing):
                break
            segs = segments(bk >= k, minlen=5, gap=10)
            tot = sum(y - x + 1 for x, y in segs) / 10
            print(f"    >= {k} non-lead mics active: {tot:.0f}s  "
                  + " ".join(f"{a + x / 10:.0f}-{a + y / 10:.0f}" for x, y in segs[:25]))
            row[f"ge{k}_backing_s"] = round(tot, 1)
            row[f"ge{k}_backing_segments"] = [[round(a + x / 10, 1), round(a + y / 10, 1)] for x, y in segs]
        lead = masks[ctx["lead"]]
        row["lead_plus_backing_s"] = round(float(((bk >= 1) & lead).sum()) / 10, 1)
        row["backing_without_lead_s"] = round(float(((bk >= 1) & ~lead).sum()) / 10, 1)
        print(f"    lead + >=1 non-lead: {row['lead_plus_backing_s']:.0f}s ; "
              f"non-lead without lead: {row['backing_without_lead_s']:.0f}s")
        out.append(row)
    report["activity"] = out


def stage3_prominence(ctx, report):
    print("\n=== 3. prominence (own band level - loudest other mic) over that mic's active "
          "frames ===")
    print("    a single cluster below 0 dB means the mic never dominates: it is hearing "
          "bleed, not a distinct part")
    out = []
    for song in ctx["songs"]:
        a, b = song["start"], song["end"]
        print(f"  --- song {song['index']}")
        row = {"song": song["index"], "mics": {}}
        L = {m: ctx["env"]["raw"][m]["eband"][a * 10:b * 10] for m in ctx["mics"]}
        n = min(len(v) for v in L.values())
        for m in ctx["mics"]:
            others = np.max(np.stack([L[o][:n] for o in ctx["mics"] if o != m]), 0)
            prom = L[m][:n] - others
            floor = float(np.percentile(L[m], 20))
            loud = L[m][:n] > floor + THR_DB
            if loud.sum() < 20:
                print(f"    {m}: {loud.sum()} active frames (skip)")
                continue
            h, edges = np.histogram(prom[loud], bins=np.arange(-30, 31, 2))
            med = float(np.median(prom[loud]))
            above = float(np.mean(prom[loud] > 0) * 100)
            print(f"    {m}: n={loud.sum() / 10:.0f}s  median {med:+.1f} dB, "
                  f"{above:.0f}% of active frames louder than every other mic")
            print("       " + " ".join(f"{int(e):+d}:{c}" for e, c in zip(edges[:-1], h) if c))
            row["mics"][m] = {"active_s": round(float(loud.sum()) / 10, 1),
                              "median_db": round(med, 1), "pct_above_0db": round(above, 1),
                              "hist_bins": [int(e) for e in edges[:-1]],
                              "hist": [int(c) for c in h]}
        out.append(row)
    report["prominence"] = out


def stage4_pitch(ctx, report):
    print(f"\n=== 4. pitch (pyin @ {PITCH_SR} Hz, {FMIN:.0f}-{FMAX:.0f} Hz, 10 ms frames, "
          f"resolution {ctx['resolution']} semitone) ===")
    print("    voiced = f0 present AND band level > floor+10 dB (pyin voiced_prob is ~0.05 "
          "on these mics and is NOT used)")
    out = []
    for song in ctx["songs"]:
        f0, voiced, floors, n = ctx["pitch"]["raw"][song["index"]]
        row = {"song": song["index"], "mics": {}}
        print(f"  --- song {song['index']}: voiced frac "
              + " ".join(f"{m} {voiced[m].mean():.2f}" for m in ctx["mics"]))
        for m in ctx["mics"]:
            ff = f0[m][voiced[m]]
            if len(ff) < 100:
                print(f"    {m}: {len(ff) / FPS:.1f}s voiced (skip)")
                continue
            p10, p50, p90 = (float(np.percentile(ff, 10)), float(np.median(ff)),
                             float(np.percentile(ff, 90)))
            print(f"    {m}: {len(ff) / FPS:.0f}s voiced | f0 p10/p50/p90 "
                  f"{p10:.0f}/{p50:.0f}/{p90:.0f} Hz "
                  f"({note_of(p10)}/{note_of(p50)}/{note_of(p90)})")
            row["mics"][m] = {"voiced_s": round(len(ff) / FPS, 1),
                              "voiced_frac": round(float(voiced[m].mean()), 3),
                              "f0_p10": round(p10, 1), "f0_p50": round(p50, 1), "f0_p90": round(p90, 1),
                              "note_p10": note_of(p10), "note_p50": note_of(p50), "note_p90": note_of(p90),
                              "floor_db": round(floors[m], 1)}
        out.append(row)
    report["pitch"] = out


def stage5_intervals(ctx, report):
    print("\n=== 5. intervals per mic pair (cents of A above B, both voiced) ===")
    out = []
    for song in ctx["songs"]:
        f0, voiced, _, n = ctx["pitch"]["raw"][song["index"]]
        print(f"  --- song {song['index']}")
        row = {"song": song["index"], "pairs": {}}
        for A, B in ctx["pairs"]:
            m = voiced[A] & voiced[B]
            tot = int(m.sum())
            if tot < 100:
                print(f"    {A}-{B}: both voiced {tot / FPS:.1f}s (skip)")
                continue
            c = np.clip(1200 * np.log2(f0[A][m] / f0[B][m]), -1300, 1300)
            h, e = np.histogram(c, bins=np.arange(-1250, 1251, 50))
            top = sorted(np.argsort(-h)[:7], key=lambda i: e[i])
            uni = float(np.mean(np.abs(c) < 40) * 100)
            octv = float(np.mean(np.abs(np.abs(c) - 1200) < 60) * 100)
            print(f"    {A}-{B}: both {tot / FPS:.1f}s; unison(|c|<40) {uni:.0f}%; "
                  f"octave {octv:.0f}%; top bins "
                  + " ".join(f"{int(e[i]) + 25:+d}:{h[i] / tot * 100:.0f}%" for i in top))
            pr = {"both_voiced_s": round(tot / FPS, 1), "unison_pct": round(uni, 1),
                  "octave_pct": round(octv, 1),
                  "top_bins": [[int(e[i]) + 25, round(float(h[i] / tot * 100), 1)] for i in top],
                  "intervals": {}}
            for iv, name in IV_NAMES.items():
                for sign in (1, -1):
                    sel = np.abs(c - sign * iv) <= 60
                    if sel.sum() < 100:
                        continue
                    d = c[sel] - sign * iv
                    ji = sign * (IV_JUST[iv] - iv)
                    lab = f"{name}{'+' if sign > 0 else '-'}"
                    q1, q3 = float(np.percentile(d, 25)), float(np.percentile(d, 75))
                    print(f"       {lab}: {sel.sum() / FPS:.1f}s ({sel.sum() / tot * 100:.0f}%) "
                          f"dev-from-ET median {np.median(d):+.0f}c IQR {q1:+.0f}..{q3:+.0f}c  "
                          f"JI={ji:+d}c")
                    pr["intervals"][lab] = {"seconds": round(float(sel.sum()) / FPS, 1),
                                            "pct": round(float(sel.sum() / tot * 100), 1),
                                            "dev_median_c": round(float(np.median(d)), 1),
                                            "dev_iqr_c": [round(q1, 1), round(q3, 1)],
                                            "just_target_c": ji}
            row["pairs"][f"{A}-{B}"] = pr
        out.append(row)
    report["intervals"] = out


def stage6_pitchcor(ctx, report):
    print("\n=== 6. raw vs processed pitch per mic (frames voiced in both and within 100 c "
          "of each other) ===")
    print("    dev = distance from the nearest equal-tempered semitone (A440); "
          "shift = processed - raw")
    out = []
    for song in ctx["songs"]:
        fr_all, vr, _, nr = ctx["pitch"]["raw"][song["index"]]
        fp_all, vp, _, npr = ctx["pitch"]["proc"][song["index"]]
        row = {"song": song["index"], "mics": {}}
        for m in ctx["mics"]:
            n = min(nr, npr)
            fr, fp = fr_all[m][:n], fp_all[m][:n]
            mask = vr[m][:n] & ~np.isnan(fp)
            if mask.sum() < 300:
                continue
            sh = 1200 * np.log2(fp[mask] / fr[mask])
            same = np.abs(sh) < 100
            if same.sum() < 100:
                continue
            devr = ((1200 * np.log2(fr[mask][same] / 440) + 900 + 50) % 100) - 50
            devp = ((1200 * np.log2(fp[mask][same] / 440) + 900 + 50) % 100) - 50
            # held notes: runs of >=30 contiguous gated frames that stay within +-60 c
            idx = np.flatnonzero(mask)
            runs, s = [], 0
            for i in range(1, len(idx) + 1):
                if i == len(idx) or idx[i] != idx[i - 1] + 1:
                    if i - s >= 30:
                        runs.append(idx[s:i])
                    s = i
            held = []
            for r in runs:
                cr = 1200 * np.log2(fr[r] / np.median(fr[r]))
                cp = 1200 * np.log2(fp[r] / np.median(fp[r]))
                if np.mean(np.abs(cr) < 60) > 0.8:
                    held.append((cr.std(), cp.std(),
                                 np.polyfit(np.arange(len(cr)) / FPS, cr, 1)[0],
                                 np.polyfit(np.arange(len(cp)) / FPS, cp, 1)[0]))
            held = np.array(held) if held else np.zeros((0, 4))
            hm = lambda i: float(np.median(np.abs(held[:, i]))) if len(held) else 0.0
            d = {"n_s": round(float(mask.sum()) / FPS, 1),
                 "same_note_pct": round(float(same.mean() * 100), 1),
                 "shift_median_c": round(float(np.median(sh[same])), 1),
                 "abs_shift_p50_c": round(float(np.median(np.abs(sh[same]))), 1),
                 "abs_shift_p90_c": round(float(np.percentile(np.abs(sh[same]), 90)), 1),
                 "dev_p50_raw_c": round(float(np.median(np.abs(devr))), 1),
                 "dev_p50_proc_c": round(float(np.median(np.abs(devp))), 1),
                 "within10c_raw_pct": round(float(np.mean(np.abs(devr) < 10) * 100), 1),
                 "within10c_proc_pct": round(float(np.mean(np.abs(devp) < 10) * 100), 1),
                 "held_notes": len(held),
                 "held_std_raw_c": round(float(np.median(held[:, 0])) if len(held) else 0.0, 1),
                 "held_std_proc_c": round(float(np.median(held[:, 1])) if len(held) else 0.0, 1),
                 "held_drift_raw_cps": round(hm(2), 1), "held_drift_proc_cps": round(hm(3), 1)}
            print(f"  song {song['index']} {m}: n={d['n_s']:.0f}s same-note {d['same_note_pct']:.0f}% | "
                  f"shift median {d['shift_median_c']:+.0f}c, |shift| p50 {d['abs_shift_p50_c']:.0f} "
                  f"p90 {d['abs_shift_p90_c']:.0f} | |dev from ET| p50 {d['dev_p50_raw_c']:.0f} -> "
                  f"{d['dev_p50_proc_c']:.0f}c; within 10c {d['within10c_raw_pct']:.0f}% -> "
                  f"{d['within10c_proc_pct']:.0f}% | held n={d['held_notes']}: within-note std "
                  f"{d['held_std_raw_c']:.0f} -> {d['held_std_proc_c']:.0f}c, drift "
                  f"{d['held_drift_raw_cps']:.0f} -> {d['held_drift_proc_cps']:.0f} c/s")
            row["mics"][m] = d
        out.append(row)
    report["pitch_correction"] = out


def stage7_timing(ctx, report):
    print("\n=== 7. note-onset timing on DISTINCT notes (>=150 c from the other voice at "
          "onset, so bleed cannot fake a match), nearest onset within +-300 ms ===")
    out = {}
    for src in ctx["pitch_srcs"]:
        print(f"  --- {src}")
        rows = []
        for song in ctx["songs"]:
            f0, voiced, _, n = ctx["pitch"][src][song["index"]]
            F = {m: np.where(voiced[m], f0[m], np.nan) for m in ctx["mics"]}
            N = {m: notes_from_track(F[m]) for m in ctx["mics"]}
            row = {"song": song["index"], "pairs": {}}
            for A, B in ctx["pairs"]:
                onB = np.array([s for s, e, _ in N[B]])
                offB = np.array([e for s, e, _ in N[B]])
                d_on, d_off, nd = [], [], 0
                for s, e, med in N[A]:
                    fb = F[B][s:min(e + 1, s + 20)]
                    fb = fb[~np.isnan(fb)]
                    if len(fb) < 5:
                        continue
                    if abs(1200 * np.log2(med / np.median(fb))) < 150:
                        continue          # unison or bleed - can't time it
                    nd += 1
                    if len(onB):
                        j = int(np.argmin(np.abs(onB - s)))
                        if abs(onB[j] - s) <= 30:
                            d_on.append((s - onB[j]) * 10)
                        j = int(np.argmin(np.abs(offB - e)))
                        if abs(offB[j] - e) <= 30:
                            d_off.append((e - offB[j]) * 10)
                d_on, d_off = np.array(d_on, float), np.array(d_off, float)

                def stat(d):
                    if len(d) < 8:
                        return None
                    return {"n": len(d), "median_ms": round(float(np.median(d)), 1),
                            "abs_p50_ms": round(float(np.median(np.abs(d))), 1),
                            "abs_p75_ms": round(float(np.percentile(np.abs(d), 75)), 1),
                            "pct_le_30ms": round(float(np.mean(np.abs(d) <= 30) * 100), 1),
                            "pct_gt_100ms": round(float(np.mean(np.abs(d) > 100) * 100), 1)}

                def show(d, st):
                    if st is None:
                        return f"n={len(d)} (too few)"
                    return (f"n={st['n']} median {st['median_ms']:+.0f} ms, |dt| p50 "
                            f"{st['abs_p50_ms']:.0f} p75 {st['abs_p75_ms']:.0f}, <=30ms "
                            f"{st['pct_le_30ms']:.0f}%, >100ms {st['pct_gt_100ms']:.0f}%")

                so, sf_ = stat(d_on), stat(d_off)
                if nd == 0 and so is None:
                    continue
                print(f"    song {song['index']} {A} vs {B}: distinct notes {nd} of {len(N[A])} | "
                      f"onsets {show(d_on, so)} | releases {show(d_off, sf_)}")
                row["pairs"][f"{A}-{B}"] = {"distinct_notes": nd, "notes_total": len(N[A]),
                                            "onsets": so, "releases": sf_}
            rows.append(row)
        out[src] = rows
    report["note_timing"] = out


def stage8_spectra(ctx, report):
    print("\n=== 8. per-voice third-octave spectrum while singing (bleed-floor frames "
          "subtracted in power), shape in dB re that voice's own total ===")
    out = []
    for song in ctx["songs"]:
        a, b = song["start"], song["end"]
        print(f"  --- song {song['index']}")
        row = {"song": song["index"], "centres": [int(c) for c in TO_CENTRES], "mics": {}}
        spec = {}
        for m in ctx["mics"]:
            e = ctx["env"]["raw"][m]["eband"][a * 10:b * 10]
            floor = float(np.percentile(e, 20))
            act, quiet = e > floor + THR_DB, e < floor + 2
            if act.sum() < 50 or quiet.sum() < 10:
                print(f"    {m}: too few frames (skip)")
                continue
            x, sr = read_mono(ctx["raw_files"][m], a, b)
            hop = sr // 10
            nf = min(len(x) // hop, len(e))
            X = x[:nf * hop].reshape(nf, hop) * np.hanning(hop)
            freqs = np.fft.rfftfreq(hop, 1 / sr)
            Pa = (np.abs(np.fft.rfft(X[act[:nf]], axis=1)) ** 2).mean(0)
            Pq = (np.abs(np.fft.rfft(X[quiet[:nf]], axis=1)) ** 2).mean(0)
            del x, X
            ba, bq = to_bands(Pa, freqs), to_bands(Pq, freqs)
            clean = np.maximum(ba - bq, ba * 0.05)
            spec[m] = clean
            tot = clean.sum()
            sh = 10 * np.log10(clean / tot)
            cen = float(np.exp((np.log(TO_CENTRES) * clean).sum() / tot))
            print(f"    {m}: active {act.sum() / 10:.0f}s, centroid {cen:.0f} Hz | "
                  + " ".join(f"{int(c)}:{v:+.0f}" for c, v in zip(TO_CENTRES, sh)))
            row["mics"][m] = {"active_s": round(float(act.sum()) / 10, 1),
                              "centroid_hz": round(cen, 1),
                              "shape_db": [round(float(v), 1) for v in sh]}
        lead = ctx["lead"]
        if lead in spec:
            for m in spec:
                if m == lead:
                    continue
                r = 10 * np.log10((spec[m] / spec[m].sum()) / (spec[lead] / spec[lead].sum()))
                print(f"      {m} minus lead (shape, dB): "
                      + " ".join(f"{int(c)}:{v:+.0f}" for c, v in zip(TO_CENTRES, r)))
                row["mics"][m]["vs_lead_db"] = [round(float(v), 1) for v in r]
        out.append(row)
    report["spectra"] = out


def stage9_levels(ctx, report):
    print("\n=== 9. per-phrase level spread (phrases from the raw voice-band mask) ===")
    out = []
    have_proc = bool(ctx["proc_files"])
    for song in ctx["songs"]:
        a, b = song["start"], song["end"]
        print(f"  --- song {song['index']}")
        row = {"song": song["index"], "mics": {}}
        for m in ctx["mics"]:
            band = ctx["env"]["raw"][m]["eband"][a * 10:b * 10]
            r = ctx["env"]["raw"][m]["e100"][a * 10:b * 10]
            floor = float(np.percentile(band, 20))
            segs = segments(band > floor + THR_DB)
            if len(segs) < 6:
                print(f"    {m}: {len(segs)} phrases (skip)")
                continue
            lvl = lambda env: np.array([10 * np.log10(np.mean(10 ** (env[x:y + 1] / 10)))
                                        for x, y in segs])
            lr = lvl(r)
            d = {"phrases": len(segs), "raw_mean_db": round(float(lr.mean()), 1),
                 "raw_std_db": round(float(lr.std()), 1),
                 "raw_p90_p10_db": round(float(np.percentile(lr, 90) - np.percentile(lr, 10)), 1),
                 "raw_within_phrase_std_db": round(float(np.mean([r[x:y + 1].std() for x, y in segs])), 1)}
            txt = (f"    {m}: {len(segs)} phrases | raw mean {d['raw_mean_db']:.1f} std "
                   f"{d['raw_std_db']:.1f} p90-p10 {d['raw_p90_p10_db']:.1f} "
                   f"within-phrase std {d['raw_within_phrase_std_db']:.1f}")
            if have_proc:
                p = ctx["env"]["proc"][m]["e100"][a * 10:b * 10]
                lp = lvl(p)
                d.update({"proc_mean_db": round(float(lp.mean()), 1),
                          "proc_std_db": round(float(lp.std()), 1),
                          "proc_p90_p10_db": round(float(np.percentile(lp, 90) - np.percentile(lp, 10)), 1),
                          "proc_within_phrase_std_db": round(float(np.mean([p[x:y + 1].std() for x, y in segs])), 1)})
                txt += (f" | proc mean {d['proc_mean_db']:.1f} std {d['proc_std_db']:.1f} "
                        f"p90-p10 {d['proc_p90_p10_db']:.1f} within-phrase std "
                        f"{d['proc_within_phrase_std_db']:.1f}")
            print(txt)
            row["mics"][m] = d
        out.append(row)
    report["levels"] = out
    if ctx["bus"]:
        stage9_bus(ctx, report)


def stage9_bus(ctx, report):
    print("\n=== 9b. vocal bus vs the mono sum of the processed stems (implied bus "
          "compression) and bus width ===")
    out = []
    backing = [m for m in ctx["mics"] if m != ctx["lead"]]
    for song in ctx["songs"]:
        a, b = song["start"], song["end"]
        bsr = sf.info(ctx["bus"]).samplerate
        bus, sr = sf.read(ctx["bus"], dtype="float32", always_2d=True,
                          start=a * bsr, stop=b * bsr)
        hop = sr // 10
        L = bus[:, 0]
        R = bus[:, 1] if bus.shape[1] > 1 else bus[:, 0]
        summ = None
        for m in ctx["mics"]:
            x, _ = read_mono(ctx["proc_files"][m], a, b)
            summ = x.copy() if summ is None else summ[:min(len(summ), len(x))] + x[:min(len(summ), len(x))]
        n = min(len(L), len(summ)) // hop
        eb = db(((L[:n * hop] ** 2 + R[:n * hop] ** 2) / 2).reshape(n, hop).mean(1))
        es = db((summ[:n * hop] ** 2).reshape(n, hop).mean(1))
        d = eb - es
        q = np.percentile(es, 20)
        ref = float(np.median(d[es < q + 3]))
        loud = es > np.percentile(es, 90)
        row = {"song": song["index"], "quiet_ref_db": round(ref, 1),
               "loud_offset_median_db": round(float(np.median(d[loud])) - ref, 1),
               "loud_offset_p10_db": round(float(np.percentile(d[loud], 10)) - ref, 1),
               "loud_offset_min_db": round(float(d[loud].min()) - ref, 1)}
        print(f"  song {song['index']}: quiet ref {row['quiet_ref_db']:+.1f} dB | loud-frame "
              f"offset vs ref median {row['loud_offset_median_db']:+.1f} "
              f"p10 {row['loud_offset_p10_db']:+.1f} min {row['loud_offset_min_db']:+.1f} "
              f"(negative = gain reduction on the bus)")
        # stereo width: harmony frames vs lead-only frames
        masks = ctx["masks"].get(song["index"])
        if masks and bus.shape[1] > 1:
            l = L[:n * hop].reshape(n, hop)
            r = R[:n * hop].reshape(n, hop)
            corr = (l * r).sum(1) / np.sqrt((l * l).sum(1) * (r * r).sum(1) + 1e-12)
            side = 10 * np.log10(((l - r) ** 2).mean(1) / (((l + r) ** 2).mean(1) + 1e-12) + 1e-12)
            bk = sum(masks[m].astype(int) for m in backing)[:n]
            lead_only = masks[ctx["lead"]][:n] & (bk == 0)
            harm = bk >= 2
            if lead_only.sum() > 10 and harm.sum() > 10:
                row["width"] = {"lead_only_corr": round(float(np.median(corr[lead_only])), 3),
                                "lead_only_side_db": round(float(np.median(side[lead_only])), 1),
                                "lead_only_frames": int(lead_only.sum()),
                                "harmony_corr": round(float(np.median(corr[harm])), 3),
                                "harmony_side_db": round(float(np.median(side[harm])), 1),
                                "harmony_frames": int(harm.sum())}
                w = row["width"]
                print(f"    width: lead-only L/R corr {w['lead_only_corr']:.3f} S/M "
                      f"{w['lead_only_side_db']:+.1f} dB (n={w['lead_only_frames']}) | "
                      f"harmony(>=2 non-lead) corr {w['harmony_corr']:.3f} S/M "
                      f"{w['harmony_side_db']:+.1f} dB (n={w['harmony_frames']})")
        del bus, L, R, summ
        out.append(row)
    report["bus"] = out


def stage10_timeline(ctx, report):
    import librosa
    out = []
    for spec in ctx["timelines"]:
        t0, t1 = float(spec[0]), float(spec[1])
        step = float(spec[2]) if len(spec) > 2 else 0.25
        song = next((s for s in ctx["songs"] if s["start"] <= t0 < s["end"]), None)
        if song is None:
            print(f"\n(timeline {t0}-{t1}s is outside the selected songs - skipped)")
            continue
        a, b = song["start"], song["end"]
        f0, voiced, floors, n = ctx["pitch"]["raw"][song["index"]]
        print(f"\n=== 10. timeline song {song['index']} {t0:g}-{t1:g}s, {step:g}s steps: "
              f"median note (+cents dev from ET) and band level dB; '.' = gated out ===")
        print("     t    | " + " | ".join(
            f"{m + (' (lead)' if m == ctx['lead'] else ''):<13}"[:13] for m in ctx["mics"]))
        rows = []
        for t in np.arange(t0, t1, step):
            cells, jrow = [], {"t": round(float(t), 3), "mics": {}}
            for m in ctx["mics"]:
                i0, i1 = int((t - a) * FPS), int((t + step - a) * FPS)
                seg = f0[m][max(0, i0):max(0, i1)]
                lev = ctx["env"]["raw"][m]["eband"][int(t * 10):int((t + step) * 10)]
                lv = float(lev.mean()) if len(lev) else -120.0
                ok = ~np.isnan(seg) if len(seg) else np.zeros(0, bool)
                if len(seg) == 0 or ok.sum() < len(seg) * 0.5 or lv < floors[m] + THR_DB:
                    cells.append(f"{'.' * 7}{lv:5.0f}")
                    jrow["mics"][m] = {"note": None, "level_db": round(lv, 1)}
                    continue
                med = float(np.median(seg[ok]))
                midi = librosa.hz_to_midi(med)
                dev = (midi - round(midi)) * 100
                name = librosa.midi_to_note(int(round(midi)))
                cells.append(f"{name:>4}{dev:+4.0f}{lv:5.0f}")
                jrow["mics"][m] = {"note": name, "dev_c": round(float(dev), 1),
                                   "hz": round(med, 1), "level_db": round(lv, 1)}
            print(f"  {t:7.2f} | " + " | ".join(cells))
            rows.append(jrow)
        out.append({"song": song["index"], "start": t0, "end": t1, "step": step, "rows": rows})
    report["timeline"] = out


# ---------------------------------------------------------------- main

def main():
    ap = argparse.ArgumentParser(description="Vocal harmony / bleed scan for live vocal mics")
    ap.add_argument("--raw", required=True, help="folder of raw (pre-plugin) mic files")
    ap.add_argument("--proc", default=None, help="folder of processed/exported stems")
    ap.add_argument("--songs", required=True, help="song ranges in seconds, 'start:end,...'")
    ap.add_argument("--mic", action="append", type=parse_kv, default=[],
                    metavar="NAME=FILE", help="raw mic, repeatable (v1='17 Vox 1.wav')")
    ap.add_argument("--proc-mic", action="append", type=parse_kv, default=[],
                    metavar="NAME=FILE", help="processed file for a mic (default: loose name match)")
    ap.add_argument("--lead", default=None, help="mic name of the lead vocal")
    ap.add_argument("--bus", default=None, help="stereo vocal bus stem inside --proc")
    ap.add_argument("--only-song", default=None, help="analyse only these songs, 1-based, '6' or '2,6'")
    ap.add_argument("--stages", default=None, help="stage numbers to run, e.g. '2,3,5' (default: all)")
    ap.add_argument("--fine", action="store_true", help="pyin resolution 0.02 semitone (slow)")
    ap.add_argument("--timeline", action="append", nargs="+", default=[],
                    metavar=("START END", "STEP"), help="note-name timeline table, repeatable")
    ap.add_argument("--cache", default=None, help="pyin cache .npz (default: beside --out)")
    ap.add_argument("--out", default=None, help="write the JSON report here")
    a = ap.parse_args()

    audio = lambda d: sorted(f for f in os.listdir(d)
                             if f.lower().endswith((".wav", ".aif", ".aiff", ".flac"))
                             and not f.startswith("._"))

    # --- mics
    raw_files = {}
    if a.mic:
        for name, fn in a.mic:
            raw_files[name] = os.path.join(a.raw, fn)
    else:
        for f in audio(a.raw):
            if re.search(r"vox|vocal", f, re.I):
                raw_files[re.sub(r"\W+", "", stem_key(f)).lower()] = os.path.join(a.raw, f)
        print(f"auto-detected raw mics: {', '.join(raw_files)}", file=sys.stderr)
    if not raw_files:
        ap.error("no mics: pass --mic NAME=FILE")
    for m, p in raw_files.items():
        if not os.path.exists(p):
            ap.error(f"raw mic {m}: {p} not found")
    mics = list(raw_files)
    lead = a.lead or mics[0]
    if lead not in mics:
        ap.error(f"--lead {lead} is not one of {mics}")

    # --- processed files, matched loosely if not given
    proc_files = {}
    if a.proc:
        given = dict(a.proc_mic)
        avail = {stem_key(f).lower(): f for f in audio(a.proc)}
        for m in mics:
            if m in given:
                proc_files[m] = os.path.join(a.proc, given[m])
                continue
            k = stem_key(raw_files[m]).lower()
            pool = {kk: v for kk, v in avail.items() if v != a.bus}
            # tiered: exact, then "raw name is a prefix of the stem name"
            # ('vox 2' -> 'vox 2 lead'), then either contains the other
            for cand in ([v for kk, v in pool.items() if kk == k],
                         sorted((v for kk, v in pool.items() if kk.startswith(k)), key=len),
                         sorted((v for kk, v in pool.items() if k in kk), key=len),
                         sorted((v for kk, v in pool.items() if kk in k), key=len)):
                if cand:
                    hit = cand
                    break
            else:
                hit = []
            if not hit:
                ap.error(f"no processed file matches {m} ('{k}') - use --proc-mic {m}=FILE")
            if len(hit) > 1 and stem_key(hit[0]).lower() != k:
                print(f"  ! {m} ('{k}') matched {len(hit)} files, taking "
                      f"{hit[0]!r}", file=sys.stderr)
            proc_files[m] = os.path.join(a.proc, hit[0])
        for m in mics:
            print(f"  {m}: {os.path.basename(raw_files[m])} -> "
                  f"{os.path.basename(proc_files[m])}", file=sys.stderr)

    bus = os.path.join(a.proc, a.bus) if (a.bus and a.proc) else (a.bus or None)
    if bus and not os.path.exists(bus):
        ap.error(f"--bus {bus} not found")

    # --- songs
    songs = []
    for i, part in enumerate(a.songs.split(","), 1):
        s, e = part.split(":")
        songs.append({"index": i, "start": int(round(float(s))), "end": int(round(float(e)))})
    if a.only_song:
        want = {int(v) for v in a.only_song.replace(" ", "").split(",")}
        songs = [s for s in songs if s["index"] in want]
        if not songs:
            ap.error(f"--only-song {a.only_song} matched nothing")

    all_stages = list(range(1, 11))
    stages = ([int(v) for v in a.stages.replace(" ", "").split(",")] if a.stages else all_stages)
    if not a.proc:
        stages = [s for s in stages if s not in (1, 6)]
    if not a.timeline and 10 in stages:
        stages = [s for s in stages if s != 10]

    cache_path = a.cache or ((os.path.splitext(a.out)[0] + ".pyin-cache.npz") if a.out
                             else os.path.join(os.getcwd(), "pyin-cache.npz"))

    ctx = {"mics": mics, "lead": lead, "raw_files": raw_files, "proc_files": proc_files,
           "bus": bus, "songs": songs, "masks": {},
           "resolution": 0.02 if a.fine else 0.1,
           "cache": PyinCache(cache_path),
           "timelines": a.timeline,
           "pairs": ([(m, lead) for m in mics if m != lead]
                     + [p for p in combinations([m for m in mics if m != lead], 2)]),
           "pitch": {"raw": {}, "proc": {}}}
    ctx["pitch_srcs"] = ["raw"] + (["proc"] if proc_files else [])

    print(f"raw: {a.raw}")
    print(f"processed: {a.proc or '(none)'}" + (f"   bus: {os.path.basename(bus)}" if bus else ""))
    print(f"mics: " + ", ".join(f"{m}{' [lead]' if m == lead else ''}" for m in mics))
    print("songs: " + ", ".join(f"{s['index']}:{s['start']}-{s['end']}s" for s in songs))
    print(f"stages: {stages}   pyin resolution {ctx['resolution']} semitone   cache {cache_path}")

    # --- envelopes (streamed, one file at a time)
    ctx["env"] = {"raw": {}, "proc": {}}
    for m in mics:
        print(f"  envelopes {m} raw …", file=sys.stderr, flush=True)
        ctx["env"]["raw"][m] = env_scan(raw_files[m])
        if proc_files:
            print(f"  envelopes {m} processed …", file=sys.stderr, flush=True)
            ctx["env"]["proc"][m] = env_scan(proc_files[m])

    report = {"raw_dir": a.raw, "proc_dir": a.proc, "bus": bus, "lead": lead,
              "mics": {m: {"raw": raw_files[m], "proc": proc_files.get(m)} for m in mics},
              "songs": songs, "stages": stages,
              "settings": {"band_hz": list(BAND), "active_thresh_db": THR_DB,
                           "pitch_sr": PITCH_SR, "pitch_hop_ms": PITCH_HOP * 1000 // PITCH_SR,
                           "resolution_semitones": ctx["resolution"],
                           "fmin_hz": FMIN, "fmax_hz": FMAX}}

    # stage 2 fills ctx["masks"], needed by 9b; run it if anything downstream needs it
    if 9 in stages and bus and 2 not in stages:
        stages = sorted(set(stages) | {2})

    if 1 in stages:
        stage1_alignment(ctx, report)
    if 2 in stages:
        stage2_activity(ctx, report)
    if 3 in stages:
        stage3_prominence(ctx, report)

    need_pitch = [s for s in stages if s in (4, 5, 6, 7, 10)]
    if need_pitch:
        srcs = ["raw"] if not (6 in stages or (7 in stages and proc_files)) else ctx["pitch_srcs"]
        if not proc_files:
            srcs = ["raw"]
        ctx["pitch_srcs"] = srcs
        for src in srcs:
            for song in songs:
                ctx["pitch"][src][song["index"]] = load_pitch(ctx, src, song)

    if 4 in stages:
        stage4_pitch(ctx, report)
    if 5 in stages:
        stage5_intervals(ctx, report)
    if 6 in stages:
        stage6_pitchcor(ctx, report)
    if 7 in stages:
        stage7_timing(ctx, report)
    if 8 in stages:
        stage8_spectra(ctx, report)
    if 9 in stages:
        stage9_levels(ctx, report)
    if 10 in stages:
        stage10_timeline(ctx, report)

    ctx["cache"].flush()
    if a.out:
        os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
        with open(a.out, "w") as fh:
            json.dump(report, fh, indent=1)
        print(f"\nwrote {a.out}")


if __name__ == "__main__":
    main()
