# mix-analyser on BOTTB Brisbane 2026 — learnings

What the offline mix analyser (`~/src/personal/mix-assist`, `uv run mix-analyser …`) taught us
on the ShipRex set (S1 and S5 "Covered in Chrome"), and what to do differently next time.
Expands the "mix-assist first run (S5)" section of `live-mix-logic-learnings.md`; that section
can be replaced by a pointer here.

Sessions referenced: S1 slice `22628d7f3a18c648`, S5 cycle export `3a95e16d6e19ed55`
(stems in `/tmp/shiprex-stems/covered-in-chrome/`, sidecar `session.json` in the same folder).

## Export settings that gave usable stems

Logic **File › Export › All Tracks as Audio Files… (⇧⌘E)**, for the song's cycle range:

| Setting                       | Use                    | Why                                                                                                                                                                                                                           |
| ----------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Save format                   | WAVE, **32-bit float** | 24-bit clipped the lead vocal flat at 0 dBFS in 8 places (the channel runs over 0 inside Logic's float mixer, which is fine there; the file can't hold it). True-peak / gain-staging findings are wrong from a 24-bit export. |
| Sample rate                   | project (48 k)         | —                                                                                                                                                                                                                             |
| Range                         | **Cycle**              | One song per analysis. Stems then start at the cycle start; `session.json` `"daw": {"tempo_bpm": 120, "start_bar": 677}` lets findings quote Logic bar numbers.                                                               |
| Bypass Effect Plug-ins        | off                    | Processing is what's being judged. Stereo Out (Ozone) is never in per-track stems — no need to bypass mastering.                                                                                                              |
| Include Volume/Pan Automation | on                     | Faders and pans _are_ the mix.                                                                                                                                                                                                |
| Normalize                     | **Off**                | Normalising destroys level relationships.                                                                                                                                                                                     |
| Include Audio Tail            | on                     | —                                                                                                                                                                                                                             |
| Export as                     | one file per track     | —                                                                                                                                                                                                                             |

**Track Stacks are the trap.** "All Tracks" exports every summing-stack header (Drums, GTRS,
MIDRANGE, VOX, Crowd) _and_ its children, so the stack material is in the sum twice. Symptoms:
mix "+1.9 dBTP", same-performance groups containing the stack and its kids, masking findings
against the stack. Either deselect the stack headers in the export list, or leave them in and
mark them `"mute": true` in `session.json` (the analyser's `mix_sum` skips muted stems). With
the stacks out, S5's stem sum was −16.2 LUFS / +0.7 dBTP; the delivered bounce (through Ozone)
is −1.0 dBTP, i.e. the limiter is absorbing ~2 dB of overs from the vocal transients.

A 2-track bounce with the master chain **bypassed** passed as `--bounce` gives the print-check
(stem sum vs bounce residual); with Ozone on it just measures the limiter.

## Running it per song on the Logic project alternatives

- Full-set exports are 28 min × 22–29 stems (~14 GB in RAM); analyse one song at a time.
  Either export the alternative's cycle range (preferred), or slice a full-set export with
  `--start S --end S` (song boundaries found from the drum stem's silences: S1 134–512 s,
  S2 557–617, S3 775–952, S4 1040–1329, S5 1409–1603 in the 28-min export).
- One `session.json` per band folder, copied into each song's export folder:
  `mode: live`, role overrides (Erhu → mid_bed, Hi-Hats → transient_rhythmic, Vox 2 Lead →
  lead, Vox 1/3/4 → mid_bed, Crowd mics → ambience_fx), stack headers muted, `daw` grid.
- Command: `uv run mix-analyser --pretty analyse <folder> --session-json <folder>/session.json --top 12`
  (~4 min for 29 stems × 4 min). `summary`, `findings`, `get`, `dismiss` are instant
  afterwards (served from the saved record); `explain`, `propose`, `solo`, `audition`, `ab`,
  `simulate/apply` reload the audio (~3–4 min).
- Finding ids are content-hashed and **repeat across songs** for mix-level findings (e.g. the
  mix-bus clipping id is identical in every song). Always pass `--session <sid>` for
  finding-scoped commands or you get the most recent session containing that id.
- `diff <sid_a> <sid_b>` after a re-export is the real check that a change did what it was
  meant to (tracks matched by audio fingerprint, so renamed stems still match).
- Blind listening: `ab --dir .mixassist/renders/<sid> --finding <id>` from a real terminal
  (Terminal/iTerm; the `!` runner has no TTY and falls back to an auto-cycle). A/B/C switch in
  sync with a 15 ms crossfade; votes written to `<id>_vote.json`.

## Detectors on live material — useful vs noise

Useful (acted on or confirmed by ear):

- **True-peak / clipping (20)** on the mix and per track, now split into "hot but clean — trim"
  vs "flat-topped at capture/export — a trim won't undo it". Located the 8 vocal peak events
  by time (Logic bars 735, 746, 748, 762, 771–775) — the loudest _passage_ (715–721) is not
  where the peaks were; peak findings now place their audition loop by peak, not RMS.
- **Resonance (9)**: Vox 1 ~459 Hz (+14 dB, Q≈12) and Vox 2 Lead ~446 Hz — same band on two
  mics ⇒ stage/room. Band-limited solo render makes it obvious.
- **Sibilance (11)** on the lead in one section; **noise floor (14)** on open vocal/guitar
  mics = bleed level between phrases; **gate-threshold (40)**: 7–8 dB separation on Vox 1/4
  and Gtr 2 R ⇒ gates would chatter, expanders or RX De-bleed instead.
- **Vocal-to-mix ratio (24)** once gated properly (see tweaks): lead sits 1–2 LU _under_ the
  band in choruses, 5.5 LU under in the bridge (Logic ~705–711) ⇒ ride, not compression.
  The vocal's _peaks_, not its level, were driving the bus ⇒ limiter/clipper on the vocal.
- **Stack / duplicate detection (31)** once added; **kick in/out grouping** (GCC-PHAT) was
  clean and reported no polarity/alignment problem on the pair.
- Masking of Vox 1/4 and erhu under the lead in choruses: correct, and mostly _arrangement_
  ("that might be the sound you want") — dismissed as intentional for S5.

Noise on live material:

- **timing_drift (28)** 26–47 ms across the song for vocal/guitar/erhu vs a _fixed_ 188-bpm
  grid: the band's tempo movement, not edits. Confidence ≤ 0.5 — ignore.
- **Masking (8)** of quiet tracks (room mic, tom) "99 % across 81 Hz–10 kHz": true but useless
  (a −44 LUFS room mic is drowned by a −20 LUFS vocal). Fixed by a 12 dB level gate and
  reporting only the maskee's core band.
- "Lead masked by Room mic" in bars 175–201: the vocal isn't singing there; the mic is bleed.
- Silent/near-silent flags per song for instruments that only play in some songs (Acoustic,
  Snare Bottom) — expected, low impact.
- Detector 21 "gain staging" without `session.json` fader values only sees post-fader peaks
  — not meaningful until faders/pans are scraped in (Mixer window must be visible to the MCP).

## Threshold / mode tweaks made during the run (`ANALYSIS_VERSION` 0.1.1)

- Vocal ratio: BS.1770-style relative gate (short-term > integrated − 10 LU) using the
  _song-level_ integrated vocal loudness, so gaps between phrases and bleed-only sections
  don't drag the ratio down (first pass said −17.8 LU; truth ≈ 0).
- Masking: skip maskees > 12 dB below their masker (non-lead); skip a lead in sections where
  it's 12 dB under its own song average; band = maskee's top-energy region; same-source group
  members never mask each other; confidence halved in live mode.
- Gate-threshold detector skips DI/sustained sources (bass, keys, > 92 % active) — a DI has no
  bleed floor, its "floor" is sustain.
- Pumping detector rewritten as "dips right after drum hits with no own onset", median vs
  median (the min-after-hit version flagged every strummed guitar).
- Resonance: drop harmonic partials of a detected fundamental (tonal sources); 1/48-octave
  grid. Room-mode detector restricted to mic captures.
- Roles: multiple `Vox` tracks → only the one named lead (else loudest) is lead, rest
  backing; `crowd` matched before `mic`; hi-hat → transient rhythmic; erhu/strings family.
- Same-source test = GCC-PHAT peak + lag stable across halves + energy-weighted MSC ≥ 0.5 +
  lag ≤ 25 ms (the peak-ratio alone grouped phase-locked partials).
- Read-only CLI commands served from the persisted record; finding lookups scoped by session.

## What the tool should do differently for live-capture sessions (to-do)

1. **Detect stack/bus stems automatically and merge or drop them.** The current detector
   (31) requires the stack's children to be individually same-source with it at lag 0 and the
   residual < −12 dB; it caught nothing on S5 because a 7-child stack correlates weakly with
   any single child. Better: for each track, least-squares fit it as a sum of the others and
   flag residual < −20 dB; then auto-mute it (with a warning) rather than double count.
2. **Elastic beat grid in live mode.** Track the drums' tempo over time (beat tracking with a
   drifting period) and measure timing offsets against that, not a fixed bpm — that converts
   detector 28 from noise into "who is drifting relative to the drummer".
3. **Bleed-aware activity gate.** A mic that is 80 % "active" because of bleed poisons the
   masking, vocal-ratio and noise-floor measures; in live mode gate on level relative to the
   track's own singing level (the fix applied to detector 24 should be the default gate).
4. **Fixed-tempo DAW grid mapping** is in (`daw` in `session.json`); a proper mapping needs the
   project's tempo map — export it (Logic's tempo list) rather than assuming constant.
5. Scrape faders/pans/inserts from `logic://mixer` into `session.json` when the Mixer is
   visible so gain staging and the `fixes_export(format="logic")` recipe have real values.
6. Crowd mics: role `ambience_fx` is right (excluded from balance rules); the noise-floor
   finding on them is a taste call ("crowd bed"), should be phrased as one.

## Logic-side gotchas hit while acting on findings (not analyser issues, but they cost time)

- Enabling **Flex Pitch** on a full-set region in a fixed-120 project conforms the region to
  its Smart Tempo analysis (95 bpm variable) — the region shrinks/moves and looks "corrupted".
  The audio file is untouched (verified sample-identical to the `Project.logicx` copy after
  "Write Project Tempo to Audio File"). **Flex & Follow → Off restores it.** Neither "Remove
  Tempo Information", "Write Project Tempo to Audio File", "Set as Constant Tempo" nor
  "Apply Project Tempo to Region and Downbeat" stopped the conform on this region.
  Prevention: Project Settings › Smart Tempo → KEEP; imported/recorded files Flex & Follow
  **Off**; analysis trigger **Off**. To pitch-fix a note: split at locators and Flex/bounce
  the short piece, or use the Pitch Correction/Nectar chain already on the vocal.
- Adaptive Limiter's Out Ceiling bottoms out at −2 dB: to shave ~3 dB off vocal peaks use
  Gain +2 / Ceiling −2 / 20 ms lookahead / true-peak on, then take the fader down ~1 dB by
  ear (the arithmetic −2 sounded too quiet). A −2 dB Gain before Ozone was audibly identical
  in a loudness-matched blind A/B and just gives the limiter headroom.
