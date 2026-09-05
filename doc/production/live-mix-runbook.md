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
   (agent), to be nudged by ear.
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

### Epsonics provisional songs (level-based, file seconds; TC = 2822.441 + s)

| #   | start s | length | bar @120 | TC (picture-true) | note                            |
| --- | ------- | ------ | -------- | ----------------- | ------------------------------- |
| 1   | 241     | 4:09   | 121.5    | 00:51:03:11       |                                 |
| 2   | 530     | 3:52   | 266      | 00:55:52:11       |                                 |
| 3   | 820     | 4:15   | 411      | 01:00:42:11       |                                 |
| 4   | 1086    | 4:26   | 544      | 01:05:08:11       | 11 s gap before — segue?        |
| 5   | 1369    | 4:02   | 685.5    | 01:09:51:11       | 17 s gap — check                |
| 6   | 1650    | 3:05   | 826      | 01:14:32:11       |                                 |
| 7   | 1845    | 2:03   | 923.5    | 01:17:47:11       | 10 s gap — may be the tail of 6 |
