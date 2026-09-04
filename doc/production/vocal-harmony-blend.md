# Blending live vocal harmonies — Epsonics (Brisbane 2026)

How to make a stacked backing-vocal harmony from a live multitrack read as one chord rather
than as separate people. Written from measurements on the Epsonics set (2026-09-04) and meant
to be reused for other bands. Companion to `live-mix-starting-points.md` § 6 and
`live-mix-logic-learnings.md`. Re-run the measurements with
`scripts/vocal_harmony_scan.py` (§ 9).

Every claim below is tagged **[measured]** (with the method and its limits) or
**[principle]** (recommended from mixing practice, not tested here). Where a first result
turned out to be an artefact, § 10 says what happened so the mistake is not repeated.

Sources: raw desk mics in `01_Media/Epsonics/` (15 Vox 2, 16 Vox 3, 17 Vox 1, 18 Vox 4;
24-bit mono, 2023 s) and the post-plugin export in `02_Production/Epsilon/stems-v3/`
(32-bit float, stereo, 2026-09-04 — **not** `03_Delivery/…/stems-v3/`, which is empty).
The 2026-09-03 export in `/private/tmp/epsonics-stems/Mixed/` was used for the first pass;
Vox 3 and Vox 4 in it are sample-identical to stems-v3 apart from level (−5.3 / −8.1 dB), so
pitch results transfer. Song boundaries in file seconds: 241–500, 540–762, 804–1075,
1106–1344, 1366–1593, 1606–1961.

---

## 1. What the mics actually contain

Establish this before anything else. On this set the brief's premise — three backing voices
stacking under a lead — was only partly true.

| Song          | Key / tempo [measured]                                                                                                                            | Who sings what [measured]                                                                                                                                                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 (241–500)   | —                                                                                                                                                 | Vox 2 lead; Vox 3 brief unison/bleed only                                                                                                                                                                                                      |
| 2 (540–762)   | keys chroma F♯/C♯ major (weak fit)                                                                                                                | **Vox 3 leads**; Vox 2's mic never leaves its bleed floor (p98 −42 dBFS vs −28…−31 in every other song)                                                                                                                                        |
| 3 (804–1075)  | D minor, ~115 bpm                                                                                                                                 | Vox 2 lead; **Vox 1 and Vox 4 double the melody in near-unison** (each is prominent in its own mic, but their pitch tracks sit within ±200 c of the lead's, with no cluster at a third or a sixth). Vox 3 mostly unison. No real harmony here. |
| 4 (1106–1344) | C minor / G♯ major (ambiguous)                                                                                                                    | Vox 2 lead; **Vox 3 sings a low harmony** (a 3rd/4th/6th _below_, and a 7th–octave below in places: pitch-track intervals cluster at −375…−475 c and −1025…−1175 c)                                                                            |
| 5 (1366–1593) | —                                                                                                                                                 | Vox 2 lead alone                                                                                                                                                                                                                               |
| 6 (1606–1961) | **E minor**, kick period 0.75–0.79 s (≈150–160 bpm counted in two) — the cover of Fleetwood Mac's _The Chain_, same key and tempo as the original | Vox 2 lead; **Vox 3 = high part, Vox 4 = lower part** (confirmed by Dean); Vox 1 silent — its mic never rises more than ~4 dB above the bleed of the others and its pitch track never shows a distinct note                                    |

Methods: per-song activity from a 200–3000 Hz band-limited 100 ms RMS envelope with an
absolute threshold of floor (20th percentile) + 10 dB; prominence = own level minus the
loudest other mic; pitch with `librosa.pyin` at 16 kHz (fmin 70, fmax 1000, 10 ms hop,
0.1-semitone bins); "sings a distinct part" = frames where the mic's pitch differs from the
lead mic's pitch by ≥ 150 c — bleed cannot produce that. Key from keys-stem chroma against
Krumhansl profiles (E minor scored 0.92 on song 6, unambiguous; songs 2 and 4 were not).

Structure of the cover (from Dean, matches the pitch data): three parts in the **verses**
(1686–1700, 1746–1780 s; the two big verse blocks), two-part call-and-response in the
chorus, two-part harmony in the outro (from ~1855 s; the lead and Vox 3 a sixth apart at
1896–1908). The original has the two verse voices in _unison_ and mono (ICMP / Tom Frampton);
the high harmony in the verses is the band's own arrangement, so there is no "match the
record" voicing to copy.

**Total three-voice harmony in the set: ~19 s** (song 6 verse frames where all three pitch
tracks are voiced and Vox 3 is a harmonic interval from the lead). That is the material every
setting below is aimed at; nothing here needs to be right for the whole song.

## 2. Tuning

### 2.1 How the voices sit against each other [measured]

Song 6, Vox 3 (high part) against the lead, all voiced frames both mics (47 s):

| Interval (Vox 3 above lead) | share of frames | deviation from equal temperament, median (IQR) | just-intonation target |
| --------------------------- | --------------- | ---------------------------------------------- | ---------------------- |
| major 6th                   | 21 %            | −20 c (−40…+10)                                | −16 c                  |
| minor 6th                   | 16 %            | +10 c (−30…+40)                                | +14 c                  |
| perfect 5th                 | 12 %            | +20 c (−10…+40)                                | +2 c                   |
| perfect 4th                 | 10 %            | −10 c (−30…+10)                                | −2 c                   |
| major 3rd                   | 6 %             | +20 c (−10…+50)                                | −14 c                  |

Vox 3 against Vox 4 (28 s): minor 6th 41 % at +10 c (−30…+30), major 6th 36 % at −20 c
(−40…+10), fifth 12 % at +40 c.

Reading: the sixths, which carry most of the verse voicing, land near just intonation on
median — the singers are pulling them in by ear. The spread is the problem, not the centre:
the interquartile range is ±25 c on every interval, i.e. half the time the chord is more than
a quarter of a semitone out of its own tuning. A 2-cent re-run on the verse blocks (small
sample, 1–4 s per interval) gave the same centres (M6 −20, m6 +8) and the same spread.

Limits: pyin on a bleed-laden mic; only frames where _both_ mics carry a stable pitch; 10 c
quantisation on the main run. The IQR is robust to the quantisation; the medians are ±10 c.

### 2.2 Within a held note [measured]

None of the three singers uses a true vibrato. On held notes ≥ 400 ms in song 6, the pitch
wanders with a 2σ extent of ~37 c (Vox 2 38, Vox 3 37, Vox 4 36) at a dominant rate of
2.5–3 Hz; only ~30 % of notes show any 4–8 Hz component. So the "shimmer" between voices is
slow uncorrelated drift, not vibrato mismatch. Pitch correction with a moderate response
_can_ track a 3 Hz wander; it cannot track a 6 Hz vibrato without sounding processed.

### 2.3 Vox 4 in the verses [measured, then unresolved]

Vox 4's mic reads at unison with the lead (27 % of both-voiced frames) or 50–150 c _above_
it (a further 45 %), on the raw mic **and** on the RX-de-bled stem. It never shows a third
or a sixth below the lead. Two readings survive:

- Vox 4 is singing the melody notes and running sharp by up to a semitone — Dean's
  suggestion, "possibly just the singer getting notes wrong".
- The lower part is quiet in her mic and what the tracker sees is the lead's bleed.

A cross-correlation test between the two mics could not separate these: same-pitch bleed and
same-pitch singing are equally coherent (peak 0.25 vs 0.26). The 50–150 c-sharp frames are
_less_ coherent with the lead mic (0.21, 19 % of frames above 0.3 vs 38 % for known bleed),
which leans toward "her own voice, off-pitch", but that is a lean, not a finding. **Solo Vox 4
over 1749–1755 s to settle it.** If she is on the melody and sharp, correction cannot fix a
half-semitone error (it will snap to whichever semitone is nearer, sometimes the wrong one);
those ~10 s of notes want Flex Pitch on a per-song copy, moved to the intended lower-harmony
notes. If she is singing the right part too quietly for her mic, no mix move recovers it.

### 2.4 Is PitchCor helping or hurting? [measured on what it does; verdict on principle]

Raw mic vs stems-v3 pitch tracks, same-note frames, song 6:

|               | frames within 10 c of an ET semitone, raw → processed | median distance from ET, raw → processed | within-note pitch std (held notes), raw → processed |
| ------------- | ----------------------------------------------------- | ---------------------------------------- | --------------------------------------------------- |
| Vox 2 (lead)  | 20 % → 31 %                                           | 22 → 18 c                                | 13 → 13 c                                           |
| Vox 3 (high)  | 22 % → 38 %                                           | 22 → 12 c                                | 23 → 24 c                                           |
| Vox 4 (lower) | 21 % → 34 %                                           | 22 → 18 c                                | 22 → 25 c                                           |

The processed track differs from the raw one by 10 c at the median and 20–30 c at the 90th
percentile; a regression of the change against the raw error gives a correction fraction of
roughly 35–60 % (2-cent run, small sample). So the current setting is **moderate**: it moves
note centres about halfway to equal temperament and **leaves the within-note wander
untouched**. It is not rigid — there is no sign of the flat, stepped tracks a fast chromatic
setting produces — and it is not removing the micro-variation that helps voices blend.

What it does do is pull Vox 3's sixths _away_ from just intonation and toward ET (her M6
centre moved from −20 c to −10 c on the processed stem). For a stack that is meant to fuse
that is the wrong direction on principle: a just major third is 14 c narrow of ET and a just
major sixth 16 c narrow, and the singers were already there.

Recommendation (principle, testable by ear on the two verse blocks):

- Lead: leave as is (chromatic, slow response ~70–100 ms). The lead sets the reference.
- Harmony voices: rather than harder correction, try **Nectar 4 Pitch in scale mode, E
  minor, with a slower response (100–150 ms) and a lower strength (50–70 %)**, or Logic
  PitchCor with the scale set to E natural minor (E F♯ G A B C D) and Response ~120 ms. Scale
  mode removes the chance of a chromatic snap to a non-scale semitone; the lower strength
  keeps the just-tuned sixths where the singers put them and only trims the ±25 c spread.
- Do not go the other way (fast, 100 %) on the backing voices: the ~19 s that matter are all
  sustained sixths where a hard ET quantise is audibly wider than what the singers sang, and
  hard correction on a bleed-laden mic corrects only that mic while the same note sits
  uncorrected in the other three (see `live-mix-starting-points.md` § 3).
- If the wander in § 2.2 is what you hear as "shimmer", the knob is response time, not
  strength: 60–80 ms on the two harmony voices, keep the lead slower. Judge by ear on
  1749–1755 s; if the high part starts to sound flat-lined, go back.

## 3. Entry and release timing [measured]

Level-based entry detection is useless here (§ 10.2). The robust measurement is per _note_:
segment each pitch track into notes, keep only harmony notes that are ≥ 150 c away from the
other voice's concurrent pitch (bleed cannot make those), and match each onset/release to the
other voice's nearest within ±300 ms. Song 6, raw mics:

| pair           | notes | onset       | Δt   | median / p75 | onsets within 30 ms         | onsets > 100 ms off | release Δt median (sign) | releases > 100 ms off |
| -------------- | ----- | ----------- | ---- | ------------ | --------------------------- | ------------------- | ------------------------ | --------------------- |
| Vox 3 vs lead  | 70    | 40 / 108 ms | 41 % | 26 %         | +40 ms (Vox 3 holds longer) | 34 %                |
| Vox 3 vs Vox 4 | 35    | 30 / 55 ms  | 63 % | 14 %         | +15 ms                      | 9 %                 |
| Vox 4 vs lead  | 18    | 30 / 40 ms  | 61 % | 11 %         | 0 ms                        | 32 %                |

Song 4 (Vox 3's low harmony vs lead, 92 notes): onsets 40 / 90 ms, 22 % beyond 100 ms;
releases 70 ms median, 38 % beyond 100 ms. The stems-v3 export gives the same numbers, so
nothing in the chain is changing the timing.

Reading: the two harmony singers are tight with _each other_ (two-thirds of shared onsets
within 30 ms, ends within ~15 ms). Against the lead they are looser, and **releases are the
audible fault**: a third of Vox 3's phrase ends are more than 100 ms away from the lead's,
typically late. Late releases are exactly what reads as "another person" rather than a chord
tail.

Recommendation:

- Editing, not mixing, and only on the verse blocks: on the per-song alternative, trim the
  ends of Vox 3 / Vox 4 regions (or fade them) to the lead's release on the ~10 phrase ends in
  1686–1700 and 1746–1780. Onsets can stay; 40 ms is within what a listener fuses.
- A gate or expander keyed from the lead is not worth it: the harmony singers sing
  call-and-response elsewhere in the same song and a key-side-chain would chop them.
- Limits: 10 ms frames, ±20 ms note-boundary jitter; nearest-onset matching can pair
  unrelated notes at phrase edges (the > 100 ms tail will include a few of those).

## 4. Dynamic consistency [measured]

Phrase-to-phrase level spread, 200–3000 Hz, phrases defined on the de-bled stem
(> floor + 15 dB for ≥ 0.5 s), raw mic → stems-v3:

| song | voice       | phrases | phrase-to-phrase std, raw → processed | p90−p10, raw → processed | within-phrase 100 ms std, raw → processed |
| ---- | ----------- | ------- | ------------------------------------- | ------------------------ | ----------------------------------------- |
| 6    | Vox 2 lead  | 28      | 4.2 → 4.5 dB                          | 7.7 → 7.7                | 5.7 → 7.2                                 |
| 6    | Vox 3 high  | 37      | **8.7 → 6.9 dB**                      | **21 → 15**              | 4.3 → 3.8                                 |
| 6    | Vox 4 lower | 45      | 3.8 → 4.2 dB                          | 9.3 → 10.8               | 2.6 → 3.0                                 |
| 4    | Vox 3 low   | 40      | 4.5 → 3.4 dB                          | 11.2 → 8.7               | 4.8 → 5.3                                 |
| 2    | Vox 3 lead  | 37      | 5.4 → 3.8 dB                          | 12.8 → 6.4               | 5.0 → 4.7                                 |

Two facts:

1. **Vox 3 is the dynamically inconsistent voice** — a 21 dB phrase-to-phrase range on the
   raw mic in song 6 (her high notes are loud, her lower entries are quiet, and she works the
   mic distance). The channel chain takes 6 dB out of that range and leaves 15 dB. The lead
   and Vox 4 are already within ~8–10 dB and the chain does not change them.
2. **The VOX bus compressor is doing nothing.** VOX bus minus the stereo sum of its four
   stems, loud frames relative to quiet frames: median 0.0 dB, worst −0.8 dB in song 6,
   −1.3 dB in song 3 (the 3 Sep export showed at most −2.5 dB). Whatever it is set to, its
   threshold sits above the programme.

Method limits: the bus-minus-sum figure also contains pan-law and any bus EQ, but those are
constant, and a constant is removed by the quiet-frame reference.

Recommendation:

- Bus compression is the single cheapest fusion move and it is currently absent. Either
  bring the VOX bus compressor down to **2–3 dB of gain reduction on the verse blocks**
  (2:1, attack 20–30 ms so consonants pass, release ~200 ms or auto), or — better for a mix
  where the lead must stay forward — make a **BV bus** for Vox 3 + Vox 4 with that compressor
  on it and keep the lead's compression separate. Moving the two harmony voices together is
  what makes them one instrument; compressing them with the lead makes the lead pump the
  stack. [principle; the measured fact is only that no bus compression is happening]
- Vox 3 needs levelling _before_ the compressor, not more compression: Nectar Auto-Level
  or clip gain per phrase on the verse blocks, aiming for the phrase-to-phrase std to come
  down toward Vox 4's ~4 dB. A compressor asked to do 15 dB of phrase levelling will breathe
  the bleed. [principle]
- Within-phrase variance goes _up_ slightly through the chain on the lead (5.7 → 7.2 dB).
  That is consistent with an expander/de-bleed opening and closing on syllables; not a
  fusion problem for the harmonies, but if the lead sounds nervous, look there.

## 5. Frequency space

### 5.1 Who lives where [measured]

Third-octave spectra while singing, bleed-floor frames subtracted in the power domain,
song 6 (dB relative to each voice's own total; then the difference from the lead's shape):

| voice       | spectral centroid | notable vs the lead's shape                                             |
| ----------- | ----------------- | ----------------------------------------------------------------------- |
| Vox 2 lead  | 969 Hz            | energy at 800 Hz and 1.6 kHz; 4–8 kHz −19…−28                           |
| Vox 3 high  | 793 Hz            | **+9 dB at 1 kHz**, +5 at 500 Hz; −6…−12 dB at 1.6–3.15 kHz; darker top |
| Vox 4 lower | 540 Hz            | +4…+9 dB at 100–315 Hz, −6…−8 at 1.6–3.15 kHz, +7…+12 at 8–10 kHz       |

Caveat on Vox 4: the silent Vox 1 mic shows the same "+LF, +10 kHz" residual in song 6, so
that part of Vox 4's shape is the bleed-subtraction leaving hi-hat and stage rumble behind,
not her voice. Vox 3's 1 kHz bump and dark top are not of that pattern and are real.

Pitch ranges [measured]: lead A3–A4 (median E4); Vox 3 D♯4–C♯5 (median A♯4/B4); Vox 4 A3–F4
(median D4) — Vox 4 and the lead occupy the same octave.

### 5.2 What the current chain does [measured]

Net processing spectrum, stems-v3 ÷ raw, active frames, normalised at 1 kHz (song 6):

- Lead: gentle low cut (−3 dB below 200 Hz) and a broad +3…+4 dB from 250 Hz to 5 kHz.
- Vox 3: +5…+7 dB at 2.5–4 kHz, +3…+5 at 315–500 Hz.
- Vox 4: −8…−12 dB at 100–250 Hz, −9 at 400 Hz, −5…−10 at 2–6.3 kHz (some of this is the
  de-bleed removing cymbals rather than EQ).

### 5.3 Recommendation [principle]

- Presence belongs to the lead. The +5…+7 dB at 2.5–4 kHz on Vox 3 pulls the high part
  forward and is the opposite of fusion. Flatten it; if anything give the harmony voices a
  gentle shelf down above ~6 kHz so the air is the lead's.
- Take 2–3 dB out of Vox 3 around 1 kHz (Q ~1.5). That bump is her most distinctive
  feature, and distinctiveness is what stops a voice disappearing into a chord.
- Carve the harmonies away from the lead's core? Not here: the lead's core is 800 Hz–1.6 kHz
  and the harmonies are _already_ weaker there. Carving further makes them thin, not fused.
  The only carve worth doing is low: Vox 4's 100–250 Hz cut is right and should stay.
- **Treat Vox 3 and Vox 4 identically in the verses** (same EQ preset after the two corrective
  moves above, same compressor, same send); treat them individually only where one of them
  carries a line alone (chorus call-and-response, song 2, song 4). Identical processing on
  parts that sing together is the single biggest "one instrument" cue after level; it costs
  clarity only when the parts need to be told apart, which in the verses they do not.

## 6. Shared ambience [principle — not measurable from stems, Aurora is an aux]

- One reverb for the stack, both harmony voices sent at the same level, and sent 2–3 dB
  hotter than the lead. Common reverb is what glues two dry sources into one; the level
  difference keeps the lead in front.
- Pre-delay: keep the lead's (20–30 ms) so its reverb reads as space behind it, and give the
  harmony send little or none — a tail that starts with the note makes the harmony sit _in_
  the reverb rather than in front of it. If Aurora's pre-delay is global, put the harmonies
  through the same send and accept the lead's pre-delay; do not build a second reverb.
- A short plate or the venue-matching Equinox on the stack is fine; two different reverbs on
  lead vs harmonies is not — different spaces read as different people.
- Send post-fader so the rides in § 4 carry the reverb with them.

## 7. Width and panning

[measured] Pans baked into stems-v3 (R−L RMS): Vox 1 −3.9 dB, Vox 2 0, Vox 3 +3.1, Vox 4
+4.2. VOX bus side/mid during three-voice harmony −19 dB (L/R correlation 0.992) vs −33 dB
lead-only — i.e. a nearly mono stack with **both harmony voices sitting to the right of the
lead**.

[principle] That is the stage plot, and it is wrong for fusion: two voices offset the same
way from the lead read as "two people over there". Options, in order of preference:

1. Keep stage positions but narrow the harmony pair: Vox 3 +8, Vox 4 +12. Video viewers get
   the right side; the chord stays centred enough to fuse.
2. Symmetric stack: Vox 3 −15, Vox 4 +15 (or the reverse), lead centre. Best fusion, breaks
   picture continuity for a viewer who watches the singers.
3. Leave as is — acceptable only if the harmony passages are so short that nobody localises.
   At ~19 s of three-part, that is arguably true; the choice is a taste call, not a
   measurement.

Do not widen: width separates, and the goal is to fuse.

## 8. Balance within the chord

[measured] In the verse harmony frames of song 6, stems-v3 has the three voices at
**equal level within ±0.3 dB** (200–3000 Hz medians: lead −35.4, Vox 3 −35.2, Vox 4
−35.2 dBFS). On the raw mics Vox 4 was +11.5 dB and Vox 3 +5.9 dB above the lead — the Vox 4
preamp is ~8–10 dB hot (its bleed floor sits at −43…−46 dBFS against −55…−58 for the others).

[principle] Starting point for "one instrument" voicing, verse blocks:

| voice       | level vs lead                                                             | why                                                                                                                    |
| ----------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Vox 2 lead  | 0                                                                         | reference; the melody must be the line the ear follows                                                                 |
| Vox 3 high  | −1.5 dB                                                                   | high parts are perceptually louder and more localisable; a sixth above the melody at equal level takes over the tune   |
| Vox 4 lower | −2.5 dB if she is doubling the melody; −1.5 dB if it is a true lower part | a near-unison double at equal level thickens and detunes the lead; a real third below can sit level with the high part |

Which line should dominate: the **lead**, then the lower part, then the high part. In a
chord the ear pins the top voice anyway; keeping it slightly under stops the stack tipping
into "melody + descant". Outro two-part (lead + Vox 3 a sixth apart, 1855 s on): Vox 3 at
−1 dB. Song 4 (Vox 3 a 3rd–6th below): −1 dB, same reverb as the lead. Song 3 (Vox 1 and
Vox 4 doubling the melody near-unison): −6 dB, no pitch correction on the doubles
(correcting two unison mics to the same grid produces chorusing against the uncorrected bleed
copies), or mute them if the double is not wanted. Song 2: Vox 3 is the lead — give it the
lead chain and centre it.

## 9. Measurement procedure (re-runnable)

```bash
cd doc/production/scripts
venv/bin/pip install librosa soundfile        # once; numpy/scipy already there
nice -n 15 venv/bin/python vocal_harmony_scan.py \
  --raw "/Volumes/Extreme SSD/.../01_Media/<Band>" \
  --proc "/Volumes/Extreme SSD/.../02_Production/<Band>/stems-vN" \
  --songs "241:500,540:762,804:1075,1106:1344,1366:1593,1606:1961" \
  --mic v1="17 Vox 1.wav" --mic v2="15 Vox 2.wav" --mic v3="16 Vox 3.wav" --mic v4="18 Vox 4.wav" \
  --lead v2 --bus "VOX_1.wav" --only-song 6 --timeline 1749 1755 0.25 --out harmony-s6.json
```

Stages and what to read in each:

1. **Alignment** raw vs processed (1 ms envelope cross-correlation). Anything over 5 ms means
   the pitch comparisons are invalid — fix the export first. Here: 0–3 ms.
2. **Activity map** on a 200–3000 Hz band envelope, floor + 10 dB. Use only the band-limited
   version (§ 10.1).
3. **Prominence histogram** per mic. One cluster below 0 dB = the mic never dominates = not
   singing a distinct part. A second cluster above 0 = singing. A hot preamp biases this by
   its gain offset; read it with the raw floors beside it.
4. **Pitch** (pyin, ~real-time; cached). Do not gate on `voiced_prob` — it sits around 0.05
   on these mics; gate on level and on pyin's own voiced flag.
5. **Intervals** per pair with ET/JI deviations. Frames within ±40 c are unison-or-bleed and
   say nothing; harmonic-interval frames are proof of two voices.
6. **Raw vs processed shift** = what the correction chain did.
7. **Note-onset timing** on distinct notes only (§ 3).
8. **Spectra** with bleed-floor subtraction; check a silent mic for the residual pattern.
9. **Levels**: phrase spread on de-bled phrases; bus-minus-sum for bus compression; L/R
   side/mid for width.
10. `--timeline` prints a per-quarter-second note table for listening against.

Budget: ~10 min per song for the pitch stage on this machine at nice 15, the rest seconds.

## 10. What did not survive, and why

1. **Wideband activity found "harmony blocks" that were bass bleed.** The first activity
   map used a full-band envelope; in song 6 it marked 1688–1780 s as "≥ 3 backing voices"
   because the kick/bass bleed lifted every vocal mic by 10 dB together. A 200–3000 Hz band
   before the envelope removed it. _Always band-limit a vocal activity gate._
2. **Level-based entry timing said the three backing voices enter within 10 ms of each
   other 80–96 % of the time.** That is the bleed opening every mic at once, not three
   singers breathing together; the tell was a spike at 0 ms with no human-sized scatter.
   Replaced by the distinct-note method in § 3. _When a timing result is too good, suspect
   that all channels are seeing the same source._
3. **A frame-count bug (×10 instead of ×100) silently analysed the first tenth of each
   song** and reported "no harmony frames". Caught because the voiced fractions were
   impossible against the activity map. _Cross-check two independent measures of the same
   thing before believing either._
4. **A timeline table indexed the level envelope relative to the song start instead of
   absolute time** and showed every harmony block as silent. Same lesson.
5. **`voiced_prob > 0.6` discarded 90 % of real singing.** pyin's probability is not
   calibrated for bleed-laden mics; its Viterbi voiced flag plus a level gate is.
6. **The Vox 4 question (§ 2.3) stayed open.** A cross-correlation control could not tell
   same-pitch bleed from same-pitch singing. It is listed here so nobody upgrades the lean
   into a finding.
7. The 2-cent pitch run voiced far fewer frames than the 10-cent run (pyin's voicing prior
   changes with bin count) and is quoted only as a cross-check.

## 11. Settings summary (verse blocks of The Chain, 1686–1700 and 1746–1780 s)

| element                         | now [measured]                                       | try [principle unless noted]                                                                                   |
| ------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Pitch correction, Vox 3 / Vox 4 | moderate; halves the ET error, leaves wander         | scale mode E minor, response 100–150 ms, strength 50–70 %; or response 60–80 ms if the wander is what you hear |
| Pitch correction, lead          | moderate                                             | unchanged                                                                                                      |
| Vox 4 verse notes               | unison-or-sharp reading, unresolved                  | solo and listen; Flex Pitch to the intended notes on the song copy if she is off                               |
| Phrase ends, Vox 3              | a third of releases > 100 ms late vs lead [measured] | trim/fade to the lead's release, ~10 edits                                                                     |
| Vox 3 level consistency         | 15 dB phrase range after the chain [measured]        | Auto-Level / clip gain before the compressor                                                                   |
| VOX bus compressor              | 0 dB GR [measured]                                   | 2–3 dB GR on the stack; ideally a BV bus (Vox 3 + Vox 4) so the lead does not pump it                          |
| Vox 3 EQ                        | +5…+7 dB at 2.5–4 kHz, 1 kHz bump [measured]         | remove the presence boost; −2…−3 dB at 1 kHz; identical preset on Vox 4                                        |
| Reverb sends                    | unknown (aux not exported)                           | same send both harmonies, +2–3 dB over the lead, post-fader, minimal pre-delay on the harmonies                |
| Pans                            | Vox 3 +15, Vox 4 +20, both right [measured]          | narrow to +8 / +12, or symmetric ±15                                                                           |
| Balance                         | all three equal ±0.3 dB [measured]                   | lead 0, Vox 3 −1.5, Vox 4 −2.5 (double) / −1.5 (true part)                                                     |
| Width                           | S/M −19 dB, near mono [measured]                     | leave; do not widen                                                                                            |
