"""Show-level outputs: `song_maps/songs.json` (songs + between-song spans, REF and timeline TC, for
Resolve markers) and `song_maps/events_index.json` (one row per song map).

mix-assist owns `song_maps/index.json` and `song_maps/README.md`; this never writes those.

python -m songmap.index
"""
from __future__ import annotations

import json
from pathlib import Path

from . import config as C


def tc_fields(row):
    for k in ("start", "end"):
        row[f"{k}_tc"] = C.ref_to_tc(row[f"{k}_s"])
        row[f"{k}_frame"] = C.ref_to_frame(row[f"{k}_s"])
    return row


def build():
    rows, idx = [], []
    for band in C.ORDER:
        p = C.OUT / "_cache" / f"{band}_songs.json"
        if not p.exists():
            continue
        cfg = C.BANDS[band]
        band_rows = json.loads(p.read_text())
        songs = [r for r in band_rows if r["kind"] == "song"]
        s0, s1 = cfg["set"]
        # before the first song: walk-on, intro, playback
        if songs and songs[0]["start_s"] - s0 > 1.0:
            rows.append(tc_fields(dict(set=cfg["name"], kind="set_intro", start_s=round(min(s0, songs[0]["start_s"]), 2),
                                       end_s=songs[0]["start_s"],
                                       what=cfg.get("set_intro", "walk-on / intro"),
                                       how="set start from the prep doc (instrument sum 8 dB over the changeover "
                                           "floor) to the first song's first downbeat")))
        for r in band_rows:
            rows.append(tc_fields(dict(r)))
        if songs and s1 - songs[-1]["end_s"] > 1.0:
            rows.append(tc_fields(dict(set=cfg["name"], kind="set_outro", start_s=songs[-1]["end_s"],
                                       end_s=round(s1, 2), how="last song's decay to the prep doc's set end")))
        for f in sorted(p for p in (C.OUT / cfg["dir"]).glob("*.events.json") if not p.name.startswith("._")):
            m = json.loads(f.read_text())
            idx.append(dict(set=m["set"], song=m["song"], file=f"{cfg['dir']}/{f.name}", start_s=m["start_s"],
                            end_s=m["end_s"], start_tc=m["start_tc"], end_tc=m["end_tc"],
                            sections=[s["label"] for s in m["sections"]],
                            solos=[f"{x['who']} {x['start_s']:.0f}-{x['end_s']:.0f}" for x in m["featured"]
                                   if x["who"] not in ("band", "drums") and not x["who"].startswith("vocal:")],
                            live_mics=m["live_mics"], confidence=m.get("confidence", {})))
    idx.sort(key=lambda r: r["start_s"])
    head = dict(clock="REF s = take #02 file seconds; timeline frame F = 90000 + (REF - 2.8025625) * 25; TC = F at 25 fps",
                generated_by="bottb doc/production/scripts/songmap (python -m songmap.index)")
    (C.OUT / "songs.json").write_text(json.dumps(dict(head, rows=rows), indent=1, ensure_ascii=False))
    (C.OUT / "events_index.json").write_text(json.dumps(dict(head, songs=idx), indent=1, ensure_ascii=False))
    write_readme(idx)
    print(f"songs.json: {len(rows)} rows; events_index.json: {len(idx)} songs")


def _compact(labels):
    out = []
    for l in labels:
        if not out or out[-1][0] != l:
            out.append([l, 1])
        else:
            out[-1][1] += 1
    return " ".join(l if n == 1 else f"{l}x{n}" for l, n in out)


def write_readme(idx):
    from .validation import CHECKS

    L = ["# Song maps (events) — Sydney 2026, take #02", "",
         "Written by `bottb doc/production/scripts/songmap` (method: `songmap/README.md` in the bottb repo). "
         "Per song: `<Set>/<song>.events.json` (sections with musical names, featured performer spans, "
         "secondary lead lines, events, performers, stage positions, lyric phrases). Show list with talk "
         "spans and timeline TC: `songs.json`. Review plots: `<Set>/_review/`. "
         "mix-assist's `index.json`/`README.md`/`*.grid.json` (beats, bars, lettered sections) are separate.", "",
         "Time: REF s = take #02 file seconds; timeline frame = 90000 + (REF - 2.8025625) x 25 (25 fps).", "",
         "**Confidence** per song: *labels* = `hook` when choruses were found from the sung hook words "
         "(Whisper on the vocal mics), `energy` when only from loudness/repetition; *featured* lists the "
         "instrument features (vocals are measured per mic and are the most reliable part).", ""]
    cur = None
    for r in idx:
        if r["set"] != cur:
            cur = r["set"]
            L += ["", f"## {cur}", "", "| Song | REF | TC | Sections | Instrument features | Labels | Hooks |",
                  "|---|---|---|---|---|---|---|"]
        m = json.loads((C.OUT / r["file"]).read_text())
        hook = any("sings the hook" in s["evidence"] for s in m["sections"])
        L.append(f"| {r['song']} | {r['start_s']:.1f}-{r['end_s']:.1f} | {r['start_tc']}-{r['end_tc']} | "
                 f"{_compact(r['sections'])} | {', '.join(r['solos']) or '-'} | {'hook' if hook else 'energy'} | "
                 f"{len(m.get('hooks', []))} |")
    L += ["", "## Fields", "",
          "- `songs.json` rows: `kind` = `song` | `talk` (who spoke: `speakers` = vocal mic -> fraction active) | "
          "`changeover` (nobody on a vocal mic) | `segue` | `set_intro` | `set_outro`; `start_s/end_s` (REF), "
          "`start_frame/end_frame`, `start_tc/end_tc` (timeline, 25 fps); songs carry `how`, `notes`, "
          "`grid_start_s/grid_end_s` (mix-assist's first and last bar line). Song start = first musical note "
          "(count-ins excluded); song end = the sound's end (last note's decay), clamped at a segue.",
          "- `events.json`: `sections[]` {start_s, end_s, label (intro|verse|pre|chorus|bridge|solo|breakdown|outro|"
          "unknown), confidence, evidence, grid_letter, group, energy_db, vocals, dual_vocals, lead}; "
          "`featured[]` {start_s, end_s, who, strength, evidence, with?}; `secondary[]` (an instrument's lead line "
          "under the vocals); `events[]` {t_s, kind (song_start|song_end|vocal_entry|solo_start|solo_end|"
          "drum_fill|stop|big_hit|crowd_cheer), confidence, ...}; `who` {who: {role (singer|guitarist|keys|bass|"
          "drummer|other), stage_x (0 = house-left edge of the wide frame), desc}}; `lyrics[]` (Whisper phrases), "
          "`hooks[]`.",
          "- Who names: `vocal:<mic>`, `guitar:HL|C|HR` (HOUSE sides: HL = left of the wide frame = stage right), "
          "`keys`, `bass`, `drums`, `erhu`, `acoustic`, `band` (nobody in particular).", ""]
    L += ["", "## Looked at (camera frames) or read from curves", "",
          "| Band | REF | Claim | Result | How |", "|---|---|---|---|---|"]
    for band, ref, claim, res, how in CHECKS:
        L.append(f"| {C.BANDS[band]['name']} | {ref} | {claim} | {res} | {how} |")
    L += ["", "Everything else is computed only (not looked at or listened to).", ""]
    (C.OUT / "EVENTS-README.md").write_text("\n".join(L))


if __name__ == "__main__":
    build()
