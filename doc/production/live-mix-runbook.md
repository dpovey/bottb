# Live-mix runbook — from desk stems to Resolve

The ShipRex process, in order, with the lessons folded in. Each step says who does it
(**you** in Logic, **agent** = Claude with the scripts / MCP / Resolve API). Companion docs:
`live-mix-starting-points.md` (why), `live-mix-logic-learnings.md` (gotchas),
`scripts/TOOLBOX.md` (commands), `mix-analyser-learnings.md`, `video-post-learnings.md`.
Offline `.logicx` reader + `doctor` (orphan/permission/version checks): `~/src/personal/logic-cli`.

Time budget from ShipRex: prep ~1 h (mostly agent), static setup ~2 h, first song ~1.5 h,
each further song ~45 min, delivery/QA ~10 min per song.

---

## Phase 0 — Prep (agent, before Logic opens)

1. **MCP orphans** — before anything else: `ps -eo pid,ppid,etime,command | grep
[L]ogicProMCP` (or `logic-cli doctor`, once it exists, in `~/src/personal/logic-cli`).
   Anything older than the current session is an orphan — kill it; the `SessionEnd` hook in
   `~/.claude/settings.json` does this automatically on exit (`tail
~/.claude/logs/kill-logic-mcp.log` says whether it fired).
2. **Stems**: `01_Media/<Band>/` already exists for all five bands (USB-derived, 19 files,
   pairs merged). Confirm with `ls` and `01_Media/README.md` (offsets, truncation notes,
   label conflicts).
3. **Coverage**: README says whether the Reaper render missed anything; the USB set is
   complete for every band. Nothing to do unless a folder is missing.
4. **Dead-channel check** on every stereo file (`09 OH`, `13 Keys`, `21 Room`): per-channel
   RMS. A silent channel ⇒ set that strip to mono in Logic.
5. **Loudness/peak table** (ffmpeg ebur128 one-liner in TOOLBOX) → Gain-trim column with
   the rule `trim = min(target − LUFS, ceiling − TP)`.
6. **Polarity/alignment**: `venv/bin/python drum_polarity.py "<stem folder>"` → snare flip?,
   Sample Delay values for kick/toms.
7. **Show TC of file start**: measure with `stem_vs_ref.py` against the rebuilt picture-true
   `BOTTB_reference_48k.wav` (lead-vocal stem, 3 probes; negative lag = stems late). Never
   use a Zoom-derived TC directly — picture blocks carried offsets up to 1.3 s.
8. **Song boundaries**: per-second RMS of the desk feed → provisional song list with bars
   (agent), to be nudged by ear. Three things that make this go wrong, all seen on this event:
   - **A count that disagrees with the setlist usually means a tape intro, not a segue.**
     Recorded intros never hit the desk, so they are absent from the stems: Epsonics opens on
     a recorded Severance theme at 00:49:41:06 and Jumbo on a recorded theme at 02:11:59.
     Look for those before concluding two songs ran together.
   - **A song that opens quietly cannot be found by level at all.** The Chain begins on a
     dobro figure that sits _below_ the applause preceding it, so every level method returns
     nothing or a result pinned to its own search window. Find those by ear or by pitch.
   - **Trailing fragments are usually the previous song's tail**, not a short extra song.
     Epsonics' provisional list had seven; there are six.

   The **confirmed, Dean-checked table for all 30 songs across the five sets** now lives in
   `video-post-learnings.md` → "Song starts, title cards and chapters (final, 2026-09-06)".
   Use that in preference to anything derived here.

9. Deliverables so far: trim table, polarity/delay table, song table, TC. Put them at the
   top of the band's `03_Delivery/<Band>/DELIVERY-NOTES.md`.

## Phase 1 — Project (you, 15 min)

1. New project 48 kHz, 25 fps, **Plays at SMPTE = file-start TC**, tempo 120, end marker past
   the last file's end (files are ~2000–3250 s ⇒ set end marker at bar 1700).
   Smart Tempo **Keep**, Flex & Follow **Off**. Input Device **none**.
   **Then read the value back out of the project and check it against the pre-flight table**
   (_File › Project Settings › Synchronization › General_, row "Bar Position 1 1 1 1 plays at
   SMPTE"). A project started from another band's project or a template silently inherits
   that band's offset, and nothing in the mix ever reveals it — see the 2026-09-05 entry in
   `live-mix-logic-learnings.md`. Re-check after every Project Alternative is branched:
   settings do not reliably propagate across alternatives.
2. Import: `/` → `1 1 1 1`, ⇧⌘I, all 19 files, Create new tracks. (Or the agent generates an
   FCPXML with `make_fcpxml.py` and you File › Import › Final Cut Pro XML — untested once.)
3. Rename tracks to the clean names (agent can do this via MCP, one call per track, by
   `target_ref`). Order: drums, OH, room, bass, guitars, keys, extras, vocals.
4. Stereo strips with a dead channel → mono (format button). Record-arm off everywhere.
5. Markers from the song table (agent: `goto_position` + `create_marker`, one pair at a
   time; names/lengths finished by you).
6. ⌘S as `<Band> - Full Set.logicx` in `02_Production/<Band>/`.

## Phase 2 — Static chain (you + agent, ~1.5 h, mostly copy from ShipRex)

Reuse instead of rebuilding:

- **Channel Strip Settings**: in the ShipRex project, on each strip type: Setting › _Save
  Channel Strip Setting As…_ (Kick In, Kick Out, Snare Top, Hi-Hats, Tom, OH, Room, Bass DI,
  Gtr, Acoustic, Keys, Erhu/extra, Vox Lead, Vox Backing, MIDRANGE bus, Crowd, Stereo Out).
  In the new project, Setting › load. That brings Gain/EQ/gate/comp/de-esser/saturation/
  Sample Delay chains in one click per strip.

  > **⚠ As of 2026-09-06 these do not exist.** `~/Music/Audio Music Apps/Channel Strip
Settings/{Track,Bus,Master,Instrument}/` are all **empty**, and
  > `~/Music/Audio Music Apps/Project Templates/` is empty too. The saving step above was
  > never done, or the files were lost. **Do the saving pass before starting a new band**,
  > and save from **Epsonics** rather than ShipRex — it is the more developed project
  > (Drums / MIDRANGE / GTRS / VOX / Backing stacks, Aux 5 Vocal Reverb, Aux 6 Room Verb,
  > Neutron Unmask on MIDRANGE keyed from VOX, the vocal chains from
  > `vocal-harmony-blend.md`). Check the folders are non-empty before planning around them.
  >
  > The alternative — duplicating a band's `.logicx`, deleting the regions and importing new
  > media — is faster for one band but inherits **every** setting of the source project,
  > including `Plays at SMPTE`. That is exactly how Epsonics acquired The ShipRex's offset
  > and lost a day. If you take that route, **reset and re-measure Plays at SMPTE as step 1**,
  > not as a later check.

- **Ozone preset "BOTTB ShipRex"** on Stereo Out; **Loudness Meter/Insight** after it.
- **Snare Bottom**: rebuild the trigger (Replace or Double Drum Track) per band; load the
  saved Quick Sampler setting.

Then adjust per band:

1. **Gain trims** from the Phase-0 table (type into the Gain plugin).
2. **Polarity/Sample Delay** from `drum_polarity.py` (snare flip; kick/tom delays).
3. **Pans** to the stage plot (audience view; lead vocal centre; drums from the audience side).
   Agent sets these via MCP once you give the layout.
4. **Stacks**: DRUMS, GTRS, VOX, MIDRANGE (GTRS + Keys + extras), CROWD (Room + a
   vocal-mic copy for applause). Buses: Vocal Reverb (Aurora), Room Verb (Equinox).
   Neutron Unmask on MIDRANGE keyed from VOX. Bass ducker keyed from Kick In.
5. **Chorus listen**, fader balance (agent can drive faders via MCP: value ≈ 0.758+0.026×dB).
6. **Rough bounce**: Stereo Out −4 dB, Ozone off, whole file, `<Band>_mix_v0_rough` →
   agent QA + TC-stamped rename + notes.
7. Save Channel Strip Settings again if anything improved.

Keep the MCP disconnected while you type in Logic (its poller steals text-field focus).
Re-check for orphans here too: `ps -eo pid,ppid,etime,command | grep [L]ogicProMCP` — one
server per live `claude`; anything older than the current session is an orphan, kill it (the
`SessionEnd` hook reaps them on exit, not mid-session). A slow Logic with no obvious cause is
accumulated MCP servers before it is anything else: read its CPU with `top -l 2 -pid <logic
pid>` and take the _second_ sample — `ps -o pcpu` is a decaying lifetime average and read
75 % when `top` said 37 %.

## Phase 3 — Branch (you, 5 min)

File › Project Alternatives › Edit Alternatives: rename current to `0 - Master`; New
Alternative per song `n - <title>` (always create from Master). ⌘S once (one file).
Nothing global after this without re-branching unmixed alternatives.

## Phase 4 — Per song (you, ~45 min each; agent QA)

1. Pick alternative, check the song's real first note (level-based markers miss quiet
   intros), set locators **marker −5 bars → next marker +5 bars** (overlaps land in applause;
   never end a bounce inside the next song's music).
2. Static tweaks for the song → rides (lead vocal Latch; crowd up in gaps, ducked −8 for
   speech; mutes on silent instruments; keys/erhu lifts where they carry a part).
3. Ozone on; chorus short-term ≈ **−12 LUFS**, integrated lands ~−14.5; TP −1.0.
4. ⌘S, bounce cycle into `03_Delivery/<Band>/` as `<Band>_Sn_<title>_vN` (no extension —
   Logic adds `.wav` and defaults to the project folder; navigate).
5. Agent: QA (rate/bits/length/peak/LUFS/chorus), verify start bar by correlation, stamp
   `_at_HH-MM-SS-FF`, append to DELIVERY-NOTES, place on the Resolve track.

## Phase 5 — Analysis (optional per song)

⇧⌘E export leaf tracks only (or stacks muted via `session.json`) over the cycle,
`uv run mix-analyser … --mode live --bounce <song wav>`; act on crowd-floor, masking and
vocal-peak findings; ignore fixed-grid timing drift. See `mix-analyser-learnings.md`.

## Phase 6 — Sync and hand-off

0. **Confirm the project's "Plays at SMPTE" before any delivery bounce.** Read it out of
   _Project Settings › Synchronization › General_ and check it equals the band's measured
   file-start TC. This is the last chance to catch an inherited offset; every place-at TC in
   DELIVERY-NOTES is derived from it, so a wrong value puts the whole set at the wrong point
   on the video timeline with nothing audible to warn you.
1. **Picture check** once per set before locking (stick-on-snare frame vs mix transient) as
   a sanity check on the `stem_vs_ref.py` number. Picture blocks are placed per set with
   independent offsets, so anchor each band separately (ShipRex −154 ms, Epsonics −1.25 s
   relative to their Zoom-derived TCs).
2. `stem_vs_ref.py` against the current reference for a numeric cross-check (negative lag =
   stems late). Three probes ten minutes apart must agree to within a few ms; a wrong
   candidate TC gives correlations at the noise floor (≈0.02) and lags that disagree by
   seconds, so the test tells right from wrong unambiguously — see TOOLBOX.md.
3. Resolve: agent imports each song WAV into `<Band> mixes` bin, track `<Band> Sn MIX`,
   `recordFrame` = TC × 25; sub-frame nudge in Fairlight if wanted. Keep filenames stable
   once in the media pool.
4. DELIVERY-NOTES.md is the contract with the video agent: file, place-at TC, length,
   overlap/crossfade rule, loudness.

---

## Epsonics pre-flight (what we already know)

| Item          | Value                                                                                                                                    | Status                                           |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Stems         | `01_Media/Epsonics/` — 19 files, 2023 s, full set (Reaper missed nothing)                                                                | ready                                            |
| Channels      | 01–08 drums, 09 OH, 11 Bass DI, **12 Gtr 1 (mic dead all set)**, 04 Gtr 2 (+19 Gtr 2 DI), 13 Keys, 15–18 Vox 2/3/1/4, 20 Keytar, 21 Room | OH/Keys/Room stereo verified healthy             |
| File-start TC | **00:47:02:11** (2822.441 s), measured against the rebuilt picture-true reference (3 probes ±2 ms)                                       | done — set Plays at SMPTE to 00:47:02:11 (+1 ms) |
| Polarity      | Snare Top inverted vs OH → flip                                                                                                          | measured                                         |
| Sample Delay  | Kick In 125, Kick Out 82, Tom 1 107, Tom 2 97, Floor 105                                                                                 | measured                                         |
| Gain trims    | table below                                                                                                                              | done                                             |
| Song table    | 7 provisional songs, table below                                                                                                         | done (nudge by ear)                              |
| Vocals        | Vox 2 = lead; Vox 3 = lead for one song only; Vox 1 & 4 = backing                                                                        | known — L→R positions still needed for pans      |
| Extras        | Gtr 1 unused (delete track); Gtr 2 DI (mute unless re-amping); Keytar (own track, pan to player)                                         | —                                                |
| Project       | `02_Production/Epsonics/Epsonics - Full Set.logicx` (to create)                                                                          | —                                                |

First actions: agent runs the loudness table + dead-channel check + song table (10 min);
you save Channel Strip Settings from the ShipRex project; then Phase 1.

### Epsonics Gain trims (from LUFS / true peak, 2026-08-30)

| Track        | Gain trim (dB)                                   |
| ------------ | ------------------------------------------------ |
| 01 Kick In   | +7                                               |
| 02 Kick Out  | +7                                               |
| 03 Snare Top | +0                                               |
| 04 Gtr 2     | +6                                               |
| 05 Hi-Hats   | +1                                               |
| 06 Tom 1     | +0                                               |
| 07 Tom 2     | +2                                               |
| 08 Floor Tom | +4                                               |
| 09 OH        | +1                                               |
| 11 Bass DI   | +2                                               |
| 12 Gtr 1     | — (mic dead all set: −53 LUFS, bleed only; mute) |
| 13 Keys      | -2                                               |
| 15 Vox 2     | +7                                               |
| 16 Vox 3     | +7                                               |
| 17 Vox 1     | +0                                               |
| 18 Vox 4     | +2                                               |
| 19 Gtr 2 DI  | +1                                               |
| 20 Keytar    | −3 (clips only after the set, at 1970 s)         |
| 21 Room      | +4                                               |

Notes: Tom 1 peaks at −3.5 dBTP with −38 LUFS (crest factor ⇒ gate, no boost); Vox 1 is a
quiet mic (−34…−46 dBFS per song — backing/talk); Keytar plays in songs 1, 2, 7, near
silent in 6; Gtr 2 has cab mic + DI (use the DI only as re-amp backup).

### Epsonics songs — MEASURED (2026-09-06, supersedes the provisional table)

Measured from the media: six sources summed, applause gaps located, then the first sustained
rise searched forward from the middle of each gap. **There are six songs, not seven** — the
old #7 was the tail of #6. Starts for 2, 3 and 4 were 11–22 s out in the provisional table.

| #   | start s  | end s | bar @120 | start TC    | end TC      | note                              |
| --- | -------- | ----- | -------- | ----------- | ----------- | --------------------------------- |
| 1   | 242      | 500   | 122      | 00:51:04:11 | 00:55:22:11 |                                   |
| 2   | 541      | 762   | 271.5    | 00:56:03:11 | 00:59:44:11 | **Vox 3 sings lead on this one**  |
| 3   | 805      | 1075  | 403.5    | 01:00:27:11 | 01:04:57:11 | Vox 1 and Vox 4 double the melody |
| 4   | 1108     | 1344  | 555      | 01:05:30:11 | 01:09:26:11 | Vox 3 sings a low harmony         |
| 5   | 1368     | 1593  | 685      | 01:09:50:11 | 01:13:35:11 |                                   |
| 6   | 1662.6\* | 1956  | 832.3    | 01:14:45:01 | 01:19:38:11 | The Chain. \*see below            |

\* **Song 6's start could not be measured by level and this figure is the delivered bounce's
cycle start, not the first note.** The Chain opens on a quiet dobro figure that sits _below_
the applause preceding it, so every level-based method returns either nothing or a result
pinned to its own search window. The music is present from the first frame of
`Epsonics_S6_The_Chain_v1.wav`, so the bounce start is a safe upper bound. If an exact first
note is needed, find it by ear or by correlating against the dobro's pitch, not by level.

The old provisional numbers, kept so nobody re-derives them: 241 / 530 / 820 / 1086 / 1369 /
1650 / 1845. Songs 1 and 5 were close; 2, 3 and 4 were not; 7 does not exist.

---

## Jumbo pre-flight (measured 2026-09-06, offline — WP-J0)

Nothing below touched Logic. Full working, per-probe numbers and the commands are in
`03_Delivery/Jumbo/DELIVERY-NOTES.md`.

| Item          | Value                                                                                                                                                                                                                                                                             | Status                          |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Stems         | `01_Media/Jumbo/` — 19 files, 2354.347 s (113,008,640 frames each), 48 k/24-bit, full untrimmed USB recording; changeover included                                                                                                                                                | ready                           |
| Channels      | 01–08 drums, 09 OH (stereo, healthy), 11 Bass DI, **12 Gtr 1 (dead cab mic, −53.7 LUFS — mute)**, **04 Gtr 2 (bleed, not a guitar)**, 13 Keys (**mono, left only**), 15–18 Vox 2/3/1/4, **19 Gtr 3 · 20 Special 4** (the two live guitar-ish channels), 21 Room (stereo, healthy) | measured                        |
| File-start TC | **02:02:49:06** (7369.229 s) — **consistent to ±1 frame, not confirmed at the ms level**                                                                                                                                                                                          | ⚠ picture check mandatory       |
| Polarity      | **No flips anywhere.** Snare Top is _not_ inverted on this band (unlike ShipRex/Epsonics)                                                                                                                                                                                         | measured                        |
| Sample Delay  | Kick In **192** (hypothesis), Kick Out 167, Snare Top 118, Tom 1 108, Tom 2 103, Floor 111; hats/room 0                                                                                                                                                                           | measured                        |
| Gain trims    | table below                                                                                                                                                                                                                                                                       | done                            |
| Song table    | 7 provisional songs, table below                                                                                                                                                                                                                                                  | done (nudge by ear)             |
| Vocals        | `15 Vox 2` is the lead (best correlation with the FOH mix, ±0.74); **digitally silent 1095–1255 s**. `16 Vox 3` and `17 Vox 1` **clip at source**. `18 Vox 4` is an unused mic (−70 LUFS) — delete                                                                                | measured; L→R pans still needed |
| Keys          | plays the **song-1 intro only**, file s 547–640, alone; right channel dead all file                                                                                                                                                                                               | for Dean's ear                  |
| Import file   | `02_Production/Jumbo/jumbo-import.fcpxml` — 19 clips, all at bar 1, fcpxml 1.8                                                                                                                                                                                                    | written, validated offline      |
| Project       | `02_Production/Jumbo/Jumbo - Full Set.logicx` (to create)                                                                                                                                                                                                                         | —                               |

### Jumbo TC — why it is a "±1 frame", not a number

Measured two ways against the rebuilt picture-true reference: the `stem_vs_ref.py` maths
(300–3000 Hz, ±2 s wide then a ±250 ms re-centred narrow pass) and band-limited GCC-PHAT
(±100 ms). Convention: lag = T0_true − T0_assumed; negative = stems late.

`11 Bass DI` (a DI — no acoustic path) and `15 Vox 2` agree **to within 0.1 ms at every
probe**, and `21 Room` tracks both at a constant **−62.0 ± 0.1 ms** (its distance from the
desk feed). `17 Vox 1` and `09 OH` read 10–20 ms low or sit at the noise floor — bleed-locked,
useless for TC. So the estimator is sound, and what it finds is a real split:

| region (file s)         | lag                                | implied file start | as TC           |
| ----------------------- | ---------------------------------- | ------------------ | --------------- |
| 665 – 965 (songs 1–2)   | +52.4 … +53.8 ms                   | 7369.279 s         | 02:02:49:**07** |
| 890 – 1240              | ramps +53 → +34 ms                 | —                  | —               |
| 1265 – 2140 (songs 4–7) | +34.15 → +38.06 ms, drift +3.9 ppm | 7369.258 s         | 02:02:49:**06** |

The +3.9 ppm inside the late plateau matches the Epsonics (+3.3) and ShipRex (+4.3) controls —
ordinary desk-vs-reference clock drift. The ~19 ms step between plateaus is not drift and is
not a vocal artefact (the Room mic reproduces it at corr 0.35–0.87). **Keep 02:02:49:06;
no single "Plays at SMPTE" is frame-exact across the whole set. Do the stick-on-snare picture
check before any delivery bounce.**

Method note worth keeping: **plain GCC-PHAT is degenerate on these desk stems.** Full-band
phase whitening amplifies the correlated noise floor the desk channels share, and every pair
pins to lag 0 with |peak| ≈ 1. Zero the weighting outside the analysis band and regularise it
(eps = 1 % of the in-band mean |R|); it then beats plain cross-correlation comfortably.

### Jumbo Gain trims (music region 639 s → EOF; `ebur128=peak=true` + `astats`, 2026-09-06)

`trim = min(target − LUFS, ceiling − truePeak)`; targets −26 close drums / −28 OH+room+hats /
−22 bass+vox / −26 rest; ceiling −3 dB drums, −4 dB vocals and rest.

| Track        | LUFS    | True peak | Crest    | Gain trim (dB)                                  |
| ------------ | ------- | --------- | -------- | ----------------------------------------------- |
| 01 Kick In   | −34.1   | −7.6      | 26.0     | +4.6                                            |
| 02 Kick Out  | −32.4   | −6.2      | 24.6     | +3.2                                            |
| 03 Snare Top | −32.8   | −2.7      | 33.6     | 0 (rule: −0.3; TP already at ceiling)           |
| 04 Gtr 2     | −37.9   | −18.1     | 20.0     | +11.9 — ⚠ bleed-dominated, do not boost blindly |
| 05 Hi-Hats   | −29.6   | −3.2      | 30.2     | 0 (rule: +0.2)                                  |
| 06 Tom 1     | −43.9   | −8.1      | 37.0     | +5.1 + gate                                     |
| 07 Tom 2     | −44.7   | −2.8      | **43.1** | **0 + gate** (crest exception)                  |
| 08 Floor Tom | −41.0   | −7.2      | 34.8     | +4.2 + gate                                     |
| 09 OH        | −28.4   | −6.0      | 27.3     | +0.4                                            |
| 11 Bass DI   | −31.4   | −7.6      | 24.1     | +3.6                                            |
| 12 Gtr 1     | −53.7   | −33.7     | 20.4     | — (dead mic, bleed only: mute)                  |
| 13 Keys      | −38.1 † | −16.0 †   | 22.8 †   | **+12.0**                                       |
| 15 Vox 2     | −34.6   | −3.3      | 35.7     | −0.7                                            |
| 16 Vox 3     | −30.5   | **+0.1**  | 35.7     | −4.1 — **clips at source, 510 samples**         |
| 17 Vox 1     | −28.9   | **0.0**   | 31.6     | −4.0 — **clips at source, 149 samples**         |
| 18 Vox 4     | −70.0   | −74.2     | 15.0     | — (unused mic: delete the track)                |
| 19 Gtr 3     | −30.8   | −15.6     | 17.4     | +4.8                                            |
| 20 Special 4 | −29.4   | −9.3      | 22.6     | +3.4                                            |
| 21 Room      | −32.1   | −14.1     | 20.7     | +4.1                                            |

† Keys is measured over its **active span only** (left channel, 547–641 s). Over the whole
music region it reads −33.9 LUFS with a 55 dB crest, which is meaningless: the channel is
digital silence for 96 % of it.

### Jumbo polarity / Sample Delay

Three methods on the loudest drum windows (chosen from the OH per-second RMS: 1039–1059 s,
1183–1203 s, 1180–1300 s). Value = |lag| samples, **Delay › Sample Delay** as the last insert.

| Track        | GCC-PHAT ±5 ms      | envelope | plain xcorr | Sample Delay         | Polarity           |
| ------------ | ------------------- | -------- | ----------- | -------------------- | ------------------ |
| 01 Kick In   | −11 † / −191 / −192 | −177     | −178        | **192** (hypothesis) | SAME               |
| 02 Kick Out  | −170 / −166 / −167  | −180     | −144        | **167**              | SAME               |
| 03 Snare Top | −117 / −118 / −118  | −149     | −112        | **118**              | **SAME — no flip** |
| 05 Hi-Hats   | −213 / −55 / −20    | −26      | −20         | 0 (unstable)         | —                  |
| 06 Tom 1     | −109 / −108 / −108  | −82      | −112        | **108**              | SAME               |
| 07 Tom 2     | −105 / −103 / −103  | −91      | −98         | **103**              | SAME               |
| 08 Floor Tom | −96 / −99 / −111    | −120     | −110        | **111**              | SAME               |

† One 20 s window returns −11 for Kick In (half-cycle sidelobe); the other two windows and
both other methods land at 177–192. Supporting cross-check: Kick In vs Kick Out measures
−33 samples SAME in all three windows (in-mic before out-mic — correct geometry), and
192 − 167 = 25 is close to that. **Verify Kick In by ear before keeping 192.**

Brisbane 2026 running list — ShipRex: KI 145, KO 118, T1 105, T2 92, FT 97, **snare flip**.
Epsonics: KI 125, KO 82, T1 107, T2 97, FT 105, **snare flip**.
Jumbo: KI 192, KO 167, ST 118, T1 108, T2 103, FT 111, **no flip anywhere**.

### Jumbo provisional songs (file seconds; TC = 7369.229 + s; bar @120 = 1 + s/2)

| #   | start s | length | bar @120 | TC              | note                                                                                                                                                                                 |
| --- | ------- | ------ | -------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **550** | 4:44   | 276.0    | **02:11:59:06** | **keys intro 550–640 alone** (first keys audio 547 s), band enters 640. The level detector put this at 639 and missed the intro entirely — exactly the failure Phase 0.8 warns about |
| 2   | 886     | 3:35   | 444.0    | 02:17:35:06     | 52 s gap before                                                                                                                                                                      |
| 3   | 1160    | 1:31   | 581.0    | 02:22:09:06     | ⚠ probably not a separate song: bass and both guitars run at −30 dBFS through the 1101–1159 "gap", only the drums stop; Vox 2 digitally silent 1095–1255                             |
| 4   | 1278    | 3:54   | 640.0    | 02:24:07:06     | 28 s gap                                                                                                                                                                             |
| 5   | 1553    | 3:35   | 777.5    | 02:28:42:06     | 42 s gap; Vox 2 active from 1516 (talk?)                                                                                                                                             |
| 6   | 1810    | 4:26   | 906.0    | 02:32:59:06     | 43 s gap                                                                                                                                                                             |
| 7   | 2090    | 0:51   | 1046.0   | 02:37:39:06     | ⚠ 14 s gap, every channel live through it — likely a segue from 6                                                                                                                    |

Machine-readable: `03_Delivery/Jumbo/jumbo-songs.json`.

### Jumbo 19 Gtr 3 vs 20 Special 4 — measured, **for Dean's ear**

Both live in all seven songs (71–100 % activity). `19 Gtr 3` holds its true peak within
0.9 dB across the whole set (−17.2…−18.1 dBTP) while its spectral centroid swings 474 →
1774 Hz — level held, tone free: **DI-like**. `20 Special 4` spreads 9.3 dB of true peak
(−9.3…−18.6) on a stable centroid (820–1189 Hz) and stable HF/LF (−3…−6 dB): **mic-like**.

GCC-PHAT (±30 ms, 200–6000 Hz, 60 s at each song midpoint) finds **no stable lag between 19
and 20** (+1.5, +13.6, −19.1, −7.1, +8.8, −6.9, −10.0 ms) — so they are **not** a DI/cab pair
of one amp, which would show a constant offset. Both sit a constant **−13.5 ms** ahead of
`04 Gtr 2` and `12 Gtr 1`, i.e. those two hear them acoustically at ≈4.6 m.

`04 Gtr 2` is **not a guitar on this set**: 85 % spectral rolloff at 200–460 Hz, HF/LF −18 dB,
−38 LUFS — low-frequency stage bleed (a cab mic rolls off at 1.5–3 kHz). `12 Gtr 1` is dead
(−53.7 LUFS, −33.7 dBTP), the same failure as Epsonics ch12. Which of 19/20 is the third
guitar is a listening call.
