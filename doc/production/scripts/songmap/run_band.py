"""Map one band, song by song: boundaries, then each song's sections/featured/events.

python -m songmap.run_band canvanauts [--plots]

Writes `song_maps/<Set>/<song>.events.json`, `song_maps/<Set>/_review/<song>.png` (with --plots)
and `song_maps/_cache/<band>_songs.json` (boundaries + between-song spans, merged into
`song_maps/songs.json` by `songmap.index`).
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np

from . import analyse as A
from . import config as C
from . import crowd as CR


def song_file_stem(band, title):
    g = A.load_grid(band, title)
    if g:
        rows = [r for r in A.grid_index() if abs(r["start_s"] - g["start_s"]) < 0.01]
        if rows:
            return Path(rows[0]["file"]).name.replace(".grid.json", "")
    return A.slugify(title)


def between(F, band, t0, t1, crowd, ctx_mics):
    """Describe a gap between songs: who talks (vocal mics with the band quiet), applause."""
    if t1 - t0 < 0.5:
        return dict(kind="segue", start_s=round(t0, 2), end_s=round(t1, 2))
    ex = A.vocal_excess(F, ctx_mics, t0, t1, t0 - 60, t1 + 60) if ctx_mics else {}
    act = A.vocal_activity(ex, F.fps) if ex else {}
    talk = {m: float(v.mean()) for m, v in act.items() if v.mean() > 0.08}
    out = dict(kind="talk" if talk else "changeover", start_s=round(t0, 2), end_s=round(t1, 2),
               speakers={f"vocal:{m}": round(f, 2) for m, f in sorted(talk.items(), key=lambda x: -x[1])})
    if crowd is not None:
        ct, cover, cabs, _ = crowd
        sel = (ct >= t0) & (ct <= t1)
        if sel.any():
            out["crowd_abs_db_p90"] = round(float(np.nanpercentile(cabs[sel], 90)), 1)
    return out


def run(band, plots=False, only=None):
    cfg = C.BANDS[band]
    F = A.Feats(band)
    s0, s1 = cfg["set"]
    crowd = CR.crowd_curve(s0 - 25, s1 + 25)
    outdir = C.OUT / cfg["dir"]
    outdir.mkdir(parents=True, exist_ok=True)
    titles = [t for t, _ in cfg["songs"]]
    rows, maps = [], []
    prev_end = None
    for k, title in enumerate(titles):
        nxt = dict(cfg["songs"])[titles[k + 1]] if k + 1 < len(titles) else None
        if nxt is not None:
            g = A.load_grid(band, titles[k + 1])
            nxt = g["start_s"] if g else nxt
        stem = song_file_stem(band, title)
        wp = C.OUT / "_cache" / "vox16k" / band / f"{stem}.words.json"
        from .lyrics import drop_loops
        words = drop_loops(json.loads(wp.read_text())["words"]) if wp.exists() else None
        m = A.map_song(band, title, F, prev_end=prev_end, next_start=nxt, crowd=crowd, words=words)
        if only is None or title in only:
            (outdir / f"{stem}.events.json").write_text(json.dumps(m, indent=1, ensure_ascii=False))
            if plots:
                (outdir / "_review").mkdir(exist_ok=True)
                review_plot(F, m, outdir / "_review" / f"{stem}.png", crowd)
        maps.append(m)
        prev_end = m["end_s"]
        print(f"{title:32s} {m['start_s']:8.2f} {m['end_s']:8.2f} "
              + " ".join(f"{s['label'][:3]}" for s in m["sections"]), flush=True)
    # songs + between spans
    allmics = sorted({x for m in maps for x in m["live_mics"]})
    prev = None
    for m in maps:
        if prev is not None:
            rows.append(dict(set=cfg["name"], **between(F, band, prev["end_s"], m["start_s"], crowd, allmics)))
        rows.append(dict(set=cfg["name"], kind="song", song=m["song"], start_s=m["start_s"], end_s=m["end_s"],
                         how=f"start: {m['boundary']['start_how']}; end: {m['boundary']['end_how']}",
                         notes=m["boundary"]["notes"], confidence=m["boundary"]["confidence"],
                         grid_start_s=m["boundary"]["grid_start_s"], grid_end_s=m["boundary"]["grid_end_s"]))
        prev = m
    (C.OUT / "_cache").mkdir(exist_ok=True)
    (C.OUT / "_cache" / f"{band}_songs.json").write_text(json.dumps(rows, indent=1, ensure_ascii=False))
    return maps, rows


COLORS = {"intro": "#9e9e9e", "verse": "#64b5f6", "pre": "#ba68c8", "chorus": "#e53935", "bridge": "#ffb300",
          "solo": "#43a047", "breakdown": "#6d4c41", "outro": "#616161", "talk": "#000", "unknown": "#e0e0e0"}


def review_plot(F, m, path, crowd=None):
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    a, b = m["start_s"] - 3, m["end_s"] + 3
    band = m["band_key"]
    mics = m["live_mics"]
    insts = list(m["live_instruments"])
    fig, ax = plt.subplots(4, 1, figsize=(26, 11), sharex=True,
                           gridspec_kw=dict(height_ratios=[0.6, 2, 2, 1.4]))
    for s in m["sections"]:
        ax[0].axvspan(s["start_s"], s["end_s"], color=COLORS.get(s["label"], "#ccc"), alpha=0.8)
        ax[0].text((s["start_s"] + s["end_s"]) / 2, 0.5, f"{s['label']}\n{s['group']} {s['confidence']:.1f}",
                   ha="center", va="center", fontsize=7)
    for h in m.get("hooks", []):
        ax[0].plot([h["t_s"]], [0.12], marker="v", color="k", ms=5)
    ax[0].set_yticks([])
    ax[0].set_title(f"{m['set']} — {m['song']}  {m['start_tc']}–{m['end_tc']}", loc="left")
    ex = A.vocal_excess(F, mics, a, b, m["start_s"], m["end_s"]) if mics else {}
    t = a + np.arange(len(next(iter(ex.values())))) / F.fps if ex else None
    for mic in mics:
        ax[1].plot(t, ex[mic], lw=0.6, label=mic)
    ax[1].axhline(9, color="k", lw=0.4)
    ax[1].legend(loc="upper right", fontsize=7)
    ax[1].set_ylabel("vocal dB over bleed")
    ctx = A.SongCtx(band, m["song"], a, b, F, None)
    ls, _ = A.lead_scores(ctx, insts)
    t2 = a + np.arange(len(ls[insts[0]])) / F.fps if insts else None
    for tr in insts:
        ax[2].plot(t2, ls[tr], lw=0.7, label=f"{tr} ({m['live_instruments'][tr]})")
    ax[2].axhline(0.45, color="k", lw=0.4)
    ax[2].set_ylim(-1.1, 1.6)
    ax[2].legend(loc="upper right", fontsize=7)
    ax[2].set_ylabel("lead score")
    yl = 1.35
    for f in m["featured"]:
        ax[2].plot([f["start_s"], f["end_s"]], [yl, yl], lw=6, solid_capstyle="butt",
                   color="C3" if f["who"].startswith("vocal") else ("C2" if f["who"] not in ("band", "drums") else "C7"))
        ax[2].text(f["start_s"], yl + 0.08, f["who"].replace("vocal:", "v:"), fontsize=6)
    lv = A.band_level(F, a, b, A.music_tracks(band))
    ax[3].plot(a + np.arange(len(lv)) / F.fps, lv, lw=0.5, color="k")
    ax[3].set_ylabel("band dB / crowd")
    if crowd is not None:
        ct, cover, _, _ = crowd
        sel = (ct >= a) & (ct <= b)
        a3 = ax[3].twinx()
        a3.plot(ct[sel], cover[sel], lw=0.6, color="C1")
        a3.axhline(6, color="C1", lw=0.4)
    kinds = {"drum_fill": "g", "stop": "r", "big_hit": "m", "vocal_entry": "b", "crowd_cheer": "orange",
             "solo_start": "lime", "solo_end": "lime", "song_start": "k", "song_end": "k"}
    for e in m["events"]:
        ax[3].axvline(e["t_s"], color=kinds.get(e["kind"], "c"), lw=0.8, alpha=0.7)
    for x in ax:
        x.grid(alpha=0.3)
    ax[3].set_xticks(np.arange(int(a) // 5 * 5, b, 5))
    plt.setp(ax[3].get_xticklabels(), rotation=90, fontsize=7)
    plt.tight_layout()
    fig.savefig(path, dpi=55)
    plt.close(fig)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("band")
    ap.add_argument("--plots", action="store_true")
    ap.add_argument("--only", nargs="*")
    ns = ap.parse_args()
    run(ns.band, ns.plots, ns.only)
