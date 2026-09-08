#!/usr/bin/env python3
"""Turn a mix_scan.py JSON into ranked, plain-English findings.

    mix_findings.py scan.json [--drums drum_scan.json] [--out findings.json] [--md]

Two reference frames, both internal to the material so no genre curve is assumed:
  * cross-song  - the same band, kit and chain across the set: a song that departs
                  from the set's own median is the thing worth looking at.
  * cross-stem  - a stem's tonal balance against the same stem in the other songs.
Absolute checks are only used where physics or delivery rules make them safe
(dead channels, mono-collapsed stereo pairs, sub-rumble, missing air).
"""
import argparse, json, statistics as st, sys

LEVEL_TOL = 2.5      # dB from the set median before a level is "off"
REGION_TOL = 3.0     # dB from the set median before a band is weak/strong
ROLE_HINT = {
    "kick in": "kick", "kick out": "kick", "snare top": "snare", "snare bottom": "snare",
    "hi-hats": "hats", "tom 1": "toms", "tom 2": "toms", "floor tom": "toms",
    "oh": "overheads", "room": "room", "bass di": "bass", "gtr 2 di": "guitar",
    "keys": "keys", "keytar": "keys", "vox 1": "backing vocal", "vox 3": "vocal",
    "vox 4": "backing vocal", "vox 2 lead": "lead vocal",
}
REGION_WORDS = {
    "rumble": ("subsonic rumble", "high-pass further"),
    "weight": ("kick/bass weight", "check the kick and bass fundamentals"),
    "body": ("low body", "body of snare, guitars and low vocals"),
    "mud": ("mud", "cut 160-300 Hz on whatever is crowding it"),
    "box": ("boxiness", "cut 300-500 Hz"),
    "honk": ("honk", "cut 500-800 Hz"),
    "nasal": ("nasal midrange", "cut 800-1500 Hz"),
    "presence": ("presence and attack", "1.5-4 kHz - intelligibility lives here"),
    "edge": ("edge/bite", "4-8 kHz - de-ess or shelve if harsh"),
    "air": ("air", "8-16 kHz - a gentle shelf, or check for a low-pass"),
}


def med(xs):
    xs = [x for x in xs if x is not None]
    return st.median(xs) if xs else None


def add(F, **kw):
    kw.setdefault("confidence", 0.7)
    F.append(kw)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("scan")
    ap.add_argument("--drums", default=None)
    ap.add_argument("--out", default=None)
    ap.add_argument("--md", action="store_true")
    a = ap.parse_args()

    d = json.load(open(a.scan))
    songs = d["songs"]
    buses = {b.lower() for b in d.get("buses", [])}
    stems = sorted({k for s in songs for k in s["stems"] if k.lower() not in buses})
    F = []

    # ---------- which songs is each stem actually playing in? ----------
    # An instrument that sits out a song must not be reported as "42 dB quiet",
    # and its tonal balance in that song is bleed, not tone.
    playing = {}
    for k in stems:
        lv = {s["index"]: s["stems"][k].get("rel_mix_db")
              for s in songs if k in s["stems"] and not s["stems"][k].get("silent")}
        lv = {i: v for i, v in lv.items() if v is not None}
        if not lv:
            playing[k] = set()
            continue
        top = max(lv.values())
        playing[k] = {i for i, v in lv.items() if v > top - 12.0
                      and (songs[i - 1]["stems"][k].get("active_pct", 0) >= 20)}

    # ---------- per-stem level consistency across songs ----------
    for k in stems:
        vals = {s["index"]: s["stems"][k].get("rel_mix_db")
                for s in songs if k in s["stems"] and not s["stems"][k].get("silent")
                and s["index"] in playing[k]}
        if len(vals) < 3:
            continue
        m = med(list(vals.values()))
        for si, v in vals.items():
            if abs(v - m) >= LEVEL_TOL:
                add(F, kind="level", song=si, stem=k, metric="rel_mix_db",
                    value=round(v, 1), reference=round(m, 1), delta=round(v - m, 1),
                    severity=round(abs(v - m), 1),
                    text=(f"{k} sits {abs(v-m):.1f} dB "
                          f"{'louder' if v>m else 'quieter'} in song {si} than in the rest of "
                          f"the set ({v:+.1f} vs {m:+.1f} dB relative to the mix)."),
                    fix=("ride it back toward the set level, or check the desk gain changed "
                         "mid-set and use region gain"))

    # ---------- per-stem tonal consistency across songs ----------
    for k in stems:
        # Tonal comparison only makes sense for a source that is continuously
        # present - a keyboard that plays one pad in a song has a spectrum made
        # mostly of bleed.
        prof = {s["index"]: s["stems"][k].get("regions_rel")
                for s in songs if k in s["stems"] and not s["stems"][k].get("silent")
                and s["index"] in playing[k]
                and s["stems"][k].get("active_pct", 0) >= 60}
        prof = {i: p for i, p in prof.items() if p}
        if len(prof) < 3:
            continue
        for reg in next(iter(prof.values())):
            vals = {i: p[reg] for i, p in prof.items()}
            m = med(list(vals.values()))
            for si, v in vals.items():
                if abs(v - m) >= REGION_TOL + 1.5:
                    word, how = REGION_WORDS.get(reg, (reg, ""))
                    add(F, kind="tone_stem", song=si, stem=k, band=reg,
                        value=round(v, 1), reference=round(m, 1), delta=round(v - m, 1),
                        severity=round(abs(v - m), 1), confidence=0.55,
                        text=(f"{k} has {abs(v-m):.1f} dB "
                              f"{'more' if v>m else 'less'} {word} in song {si} than the same "
                              f"stem in the rest of the set."),
                        fix=how)

    # ---------- mix tonal balance ----------
    regions = list(songs[0]["mix_regions_rel"].keys())
    for reg in regions:
        vals = {s["index"]: s["mix_regions_rel"][reg] for s in songs}
        m = med(list(vals.values()))
        for si, v in vals.items():
            if abs(v - m) >= REGION_TOL:
                word, how = REGION_WORDS.get(reg, (reg, ""))
                add(F, kind="tone_mix", song=si, stem="(mix)", band=reg,
                    value=round(v, 1), reference=round(m, 1), delta=round(v - m, 1),
                    severity=round(abs(v - m), 1), confidence=0.75,
                    text=(f"The whole mix of song {si} has {abs(v-m):.1f} dB "
                          f"{'more' if v>m else 'less'} {word} than the rest of the set."),
                    fix=how)

    # ---------- vs an external reference mix, if the scan carried one ----------
    for s in songs:
        for reg, v in (s.get("vs_reference") or {}).items():
            if abs(v) >= 4.0:
                word, how = REGION_WORDS.get(reg, (reg, ""))
                add(F, kind="tone_vs_ref", song=s["index"], stem="(mix)", band=reg,
                    value=round(v, 1), reference=0.0, delta=round(v, 1),
                    severity=round(abs(v), 1), confidence=0.45,
                    text=(f"Song {s['index']} has {abs(v):.1f} dB "
                          f"{'more' if v>0 else 'less'} {word} than the reference mix."),
                    fix=how + " (cross-band reference - treat as a sanity check, not a target)")

    # ---------- stems that sit out a song ----------
    for k in stems:
        for s in songs:
            e = s["stems"].get(k)
            if not e:
                continue
            if e.get("silent") or s["index"] not in playing[k]:
                lvl = e.get("rel_mix_db")
                add(F, kind="absent", song=s["index"], stem=k, severity=1.0, confidence=0.9,
                    text=(f"{k} sits out song {s['index']}"
                          + (f" (only {lvl:+.0f} dB relative to the mix - bleed)." if lvl is not None else ".")),
                    fix="mute-automate it through this song so its bleed and noise floor leave the mix")

    # ---------- drum diagnostics ----------
    if a.drums:
        dd = json.load(open(a.drums))
        for w in dd.get("windows", []):
            lbl = w.get("label", "")
            wd = w.get("width", {})
            for nm in ("oh", "room"):
                if nm in wd and wd[nm].get("corr") is not None:
                    if wd[nm]["corr"] > 0.98 and wd[nm]["side_over_mid"] < 0.05:
                        add(F, kind="width", song=None, stem=nm.upper(), severity=8.0,
                            confidence=0.9,
                            text=(f"{nm.upper()} is mono in the mix (L and R identical) even though "
                                  f"the source file is a real stereo pair - the kit's stereo image "
                                  f"is being thrown away."),
                            fix="set that channel strip back to stereo (the format button under the meter)")
            t = w.get("snare_bottom_trigger")
            if t:
                if t["matched_pct"] < 70:
                    add(F, kind="trigger", song=None, stem="Snare Bottom", severity=6.0,
                        confidence=0.8,
                        text=(f"Only {t['matched_pct']:.0f}% of the snare-sampler hits line up with a "
                              f"real snare hit ({t['sampler_hits']} sampler vs {t['snare_hits']} snare "
                              f"in {lbl})."),
                        fix="re-run Replace or Double Drum Track on this band's snare - the MIDI is not this performance")
                if t.get("median_offset_ms") is not None and abs(t["median_offset_ms"]) > 8:
                    add(F, kind="trigger", song=None, stem="Snare Bottom", severity=4.0,
                        confidence=0.7,
                        text=f"The snare sampler sits {t['median_offset_ms']:+.1f} ms from the real snare in {lbl}.",
                        fix="nudge the MIDI region, or use Sample Delay on the sampler track")
            al = w.get("alignment", {})
            for pair, why in (("snare_vs_oh", "snare and overheads"),
                              ("sbot_vs_snare", "snare sampler and snare top"),
                              ("kickin_vs_kickout", "kick in and kick out")):
                v = al.get(pair)
                if v and v["polarity"] == "INVERTED" and abs(v["corr"]) > 0.4:
                    add(F, kind="polarity", song=None, stem=pair, severity=round(abs(v["corr"]) * 6, 1),
                        confidence=0.6,
                        text=(f"{why} read polarity-inverted against each other "
                              f"(corr {v['corr']:+.2f}) in {lbl}."),
                        fix="A/B a polarity flip and keep whichever is fuller - verify by level, not by the sign alone")

    F.sort(key=lambda f: (-f["severity"] * f["confidence"], f.get("song") or 0))
    out = {"source": a.scan, "songs": [{k: s[k] for k in ("index", "start_s", "end_s", "len_s")}
                                       for s in songs],
           "findings": F}
    js = json.dumps(out, indent=1)
    if a.out:
        open(a.out, "w").write(js); print(f"wrote {a.out} ({len(F)} findings)", file=sys.stderr)
    if a.md or not a.out:
        for f in F[:60]:
            sg = f"song {f['song']}" if f.get("song") else "whole set"
            print(f"[{f['severity']:5.1f}] {sg:9} {f['kind']:11} {f['text']}")
            if f.get("fix"):
                print(f"          -> {f['fix']}")


if __name__ == "__main__":
    main()
