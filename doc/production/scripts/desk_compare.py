#!/usr/bin/env python3
"""Compare a studio mix against the FOH desk mix of the same performance.

    desk_compare.py --sources DIR --desk WAV --mixed DIR --songs "a:b,c:d" [--out J]

Rather than blind stem separation (which invents artefacts and then blames the mix
for them), this projects the desk mix onto the *known* source stems: for each
frequency band it solves a non-negative least squares fit

    E_desk[t, band]  ~=  sum_g  w_g * E_group[t, band]

over 0.25 s frames, where each group is a sum of real stems. The recovered w_g is
how much of that group the FOH engineer had in the PA, per band. The same groups
are measured directly in the studio mix (post-fader stems), and the two balances
are normalised and compared.

Groups are coarse on purpose - drum mics share one kit and are hopelessly
collinear individually; DRUMS / BASS / GUITAR / KEYS / VOX is well conditioned.
"""
import argparse, json, math, os, re, subprocess, sys
import numpy as np
from scipy.optimize import nnls

SR = 24000          # plenty for 12 kHz analysis
HOP = SR // 4       # 0.25 s frames

BANDS = [("low", 40, 100), ("lowmid", 100, 250), ("mid", 250, 800),
         ("upmid", 800, 2000), ("presence", 2000, 5000), ("top", 5000, 11000)]

GROUPS = {
    "DRUMS": ["kick in", "kick out", "snare top", "snare bottom", "hi-hats",
              "tom 1", "tom 2", "floor tom", "oh", "room"],
    "BASS": ["bass di"],
    "GUITAR": ["gtr 2 di", "gtr 2", "gtr 1"],
    "KEYS": ["keys", "keytar"],
    "VOX": ["vox 1", "vox 2 lead", "vox 3", "vox 4", "vox 2"],
}


def key(f):
    n = re.sub(r"\.(wav|aif|aiff|flac)$", "", f, flags=re.I)
    n = re.sub(r"_\d+$", "", n)
    return re.sub(r"^\d+\s+", "", n).strip().lower()


def stem_map(d):
    return {key(f): os.path.join(d, f) for f in sorted(os.listdir(d))
            if f.lower().endswith((".wav", ".aif", ".aiff", ".flac")) and not f.startswith("._")}


def band_energy(path, start, dur):
    """-> (n_frames, n_bands) energy, mono."""
    ch = int(subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "stream=channels", "-of", "csv=p=0", path]
    ).decode().strip().split(",")[0])
    af = "pan=mono|c0=0.5*c0+0.5*c1" if ch > 1 else "aformat=channel_layouts=mono"
    raw = subprocess.check_output(
        ["ffmpeg", "-v", "error", "-ss", str(start), "-t", str(dur), "-i", path,
         "-af", af, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"])
    x = np.frombuffer(raw, dtype=np.float32).astype(np.float64)
    nf = len(x) // HOP
    if nf == 0:
        return np.zeros((0, len(BANDS)))
    x = x[:nf * HOP].reshape(nf, HOP)
    w = np.hanning(HOP)
    P = np.abs(np.fft.rfft(x * w, axis=1)) ** 2
    fr = np.fft.rfftfreq(HOP, 1 / SR)
    out = np.zeros((nf, len(BANDS)))
    for i, (_, lo, hi) in enumerate(BANDS):
        sel = (fr >= lo) & (fr < hi)
        out[:, i] = P[:, sel].sum(axis=1)
    return out


def group_energy(smap, names, start, dur):
    tot = None
    used = []
    for n in names:
        if n in smap:
            e = band_energy(smap[n], start, dur)
            used.append(n)
            tot = e if tot is None else tot[:min(len(tot), len(e))] + e[:min(len(tot), len(e))]
    return tot, used


def to_db(v):
    return 10 * math.log10(max(v, 1e-20))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sources", required=True, help="pre-fader source stems (what FOH had)")
    ap.add_argument("--desk", required=True, help="FOH desk mix, aligned to source t=0")
    ap.add_argument("--mixed", required=True, help="post-fader exported stems of the studio mix")
    ap.add_argument("--songs", required=True)
    ap.add_argument("--out", default=None)
    a = ap.parse_args()

    src = stem_map(a.sources)
    mix = stem_map(a.mixed)
    songs = [tuple(float(v) for v in s.split(":")) for s in a.songs.split(",")]
    res = {"desk": a.desk, "sources": a.sources, "mixed": a.mixed,
           "bands": [b[0] for b in BANDS], "songs": []}

    for si, (s, e) in enumerate(songs, 1):
        dur = e - s
        print(f"  song {si}  {s:.0f}-{e:.0f}s", file=sys.stderr)
        D = band_energy(a.desk, s, dur)
        G, names, used = {}, [], {}
        for g, mem in GROUPS.items():
            eg, u = group_energy(src, mem, s, dur)
            if eg is None or eg.sum() <= 0:
                continue
            G[g] = eg; names.append(g); used[g] = u
        nf = min([len(D)] + [len(G[g]) for g in names])
        D = D[:nf]
        for g in names:
            G[g] = G[g][:nf]

        foh, studio = {}, {}
        for bi, (bn, _, _) in enumerate(BANDS):
            A = np.stack([G[g][:, bi] for g in names], axis=1)
            b = D[:, bi]
            sc = A.max() or 1.0
            w, _ = nnls(A / sc, b / sc)
            for gi, g in enumerate(names):
                foh.setdefault(g, {})[bn] = to_db(w[gi] * A[:, gi].mean())
        # studio mix: post-fader stems measured directly
        for g, mem in GROUPS.items():
            eg, _ = group_energy(mix, mem, s, dur)
            if eg is None:
                continue
            for bi, (bn, _, _) in enumerate(BANDS):
                studio.setdefault(g, {})[bn] = to_db(eg[:, bi].mean())

        def norm(tbl):
            tot = to_db(sum(10 ** (v / 10) for g in tbl for v in tbl[g].values()))
            return {g: {b: round(v - tot, 2) for b, v in d.items()} for g, d in tbl.items()}, tot

        fn, ft = norm(foh)
        sn, st_ = norm({g: d for g, d in studio.items() if g in fn})
        broad = {}
        for g in fn:
            if g not in sn:
                continue
            f_all = to_db(sum(10 ** (v / 10) for v in fn[g].values()))
            s_all = to_db(sum(10 ** (v / 10) for v in sn[g].values()))
            broad[g] = {"foh_db": round(f_all, 1), "studio_db": round(s_all, 1),
                        "delta_db": round(s_all - f_all, 1)}
        res["songs"].append({"index": si, "start_s": s, "end_s": e,
                             "members": used,
                             "foh_bands": fn, "studio_bands": sn,
                             "balance": broad})

    js = json.dumps(res, indent=1)
    if a.out:
        open(a.out, "w").write(js); print(f"wrote {a.out}", file=sys.stderr)
    else:
        print(js)


if __name__ == "__main__":
    main()
