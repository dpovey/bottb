# Live multitrack mix in Logic Pro — learnings log

Running log of things learned while mixing BOTTB Brisbane 2026 (Logic Pro 12.2, macOS 26.6,
logic-pro-mcp 3.14). Entries are things that were **not** obvious up front. Reuse for every
band set. Newest entries at the bottom of each section.

## Project setup

- Logic 12 moved sample rate out of _Logic Pro › Settings › Audio › Devices_. The project rate
  is only in **File › Project Settings › Audio**; the hardware rate is in Audio MIDI Setup.
  Logic follows the output device's rate — a Roland TD-27 sitting at 44.1 k silently forced a
  44.1 k session. Check `system_profiler SPAudioDataType | grep -A8 <device>` before trusting
  the project.
- Per-band projects with all stems at bar 1 are fine. To put the ruler on show timecode
  **don't move regions** — set _Project Settings › Synchronization › "Plays at SMPTE"_ to the
  set's start TC once it's measured. Zero risk, doable after automation exists.
- Default project start is 01:00:00:00; the whole-show project needs 00:00:00:00.
- Use a slow nominal tempo (60 bpm) for a 3.5 h show so the bar count stays small.

- "Plays at SMPTE" lives in _File › Project Settings › Synchronization › General_: the row
  "Bar Position 1 1 1 1 plays at SMPTE …" — type the TC there; leave "Enable separate SMPTE
  view offset" off. The Project Settings toolbar shows "120 AUTO" under Smart Tempo — that's
  the Flex & Follow/analysis icon, not the Project Tempo Mode (which is "Keep Project Tempo").
- Dragging a file onto a track **adds** a region; it never replaces. Delete the old region
  first, then drop the new file at bar 1, otherwise both sit stacked and the old one is drawn
  on top (waveform "looks unchanged").
- ⇧⌘I "Use existing tracks" counts stack headers as tracks, so it goes off by one once a
  summing stack exists — drag per file instead.

## Scripting Logic beyond the MCP (options, best first)

- **OSC control surface** (Control Surfaces › Setup › New › OSC): faders, pans, sends,
  mutes, transport, markers, selected-strip plugin params; bidirectional; ~20 lines of
  `python-osc`. Best for bulk balance and live automation writes.
- **Controller Assignments** (Logic Pro › Control Surfaces › Controller Assignments, Learn in
  "Selected Track" mode): any plugin parameter on the selected track via MIDI CC from a
  virtual port — the way to set Gain dB / Channel EQ bands / gate thresholds by script.
- **MIDI-learned key commands**: fire any menu action; can't type into dialogs.
- **AppleScript/JXA GUI scripting**: typing into dialogs/inspector; fragile.
- **Final Cut Pro XML import**: scripted region placement at exact TC on named tracks
  (`scripts/make_fcpxml.py`, see below).
- The `.logicx` package is undocumented binary — never edit it.

## Importing stems

- Multi-file WAV import lands regions at the playhead: press `/` (Go to Position), type the
  SMPTE TC, then ⇧⌘I. Verify in the Event List with _View › Event Position and Length in
  SMPTE Units_.
- The desk exports mono sources as 2-channel files. Don't re-encode; click the channel-strip
  format button to switch the strip to mono (uses the left channel) so the pan pot pans.
- The "Smart Tempo Multitrack Set 1.aif" in the stem folder is Logic's analysis file from a
  previous import — never import it as audio.
- Desk exports carry a BWF `time_reference` (samples since midnight on the _desk's_ clock,
  e.g. 201,984,000 = 01:10:08). It is not show TC, but identical values across all files
  confirm a shared start. File sizes can differ by ~0.5 MB with identical sample counts
  (metadata chunks) — check `ffprobe -show_entries stream=duration_ts`, not `ls -l`.

## Source of truth: the Direct-to-USB FLACs, not the Reaper renders

- `~/Downloads/BOTTB@Triffid/` has two sets per band: **Reaper Renders** (2-ch WAVs, trimmed
  by the engineer — ShipRex's started 65 s into song 1) and **Direct to USB Renders** (mono
  FLAC per desk channel, 48 k, untrimmed — ShipRex's runs 2199 s and covers the whole set plus
  the changeover). The Reaper render is bit-identical audio (0.00 dB, 0.04 % residual) at a
  fixed sample offset inside the USB file (ShipRex: sample 34,998,636). **Build every band's
  project from the USB set.**
- USB naming: `01 KCK IN … 20 ERHU`, OH as `09 OHD L`/`10 OHD R`, keys as `13 KEYS MONO`/
  `14 KEYS R` (that's L/R), and the room pair is `LineL Track`/`LineR Track` (verified
  identical to Reaper's 21&22_Room). Merge pairs with `ffmpeg -filter_complex amerge`.
- Converting: `ffmpeg -i x.flac -af "atrim=start_sample=${S}:end_sample=${E}" -c:a pcm_s24le`
  → mono 24-bit WAVs the strips read as mono without the format-button step. Number the
  output files in the _Logic track order_ so ⇧⌘I › "Use existing tracks" drops each onto the
  right track. ShipRex replacement set: `01_Media/The ShipRex/usb_full/`, trimmed to USB
  sample 25,398,636 so the old material starts at exactly 200.000 s (bar 101 @ 120 bpm).
- Reaper render vs USB: identical audio, but Reaper's render carries 1–2 sample per-track
  offsets (latency compensation) and a ~50 ms fade-in at the region start.
- All five bands rebuilt from USB (`build_media.py`, 2026-08-30): three Reaper renders were
  truncated — ShipRex −65 s head, Off The Record −45 s tail, Jumbo −128 s tail — and Off The
  Record's kick-in render had an expander + HF cut baked in. Layout, offsets and show TCs are
  in `01_Media/README.md` on the SSD. Epsonics' file start is 00:47:03:17 (2823.692 s).
- **Check every stereo stem for a dead channel before mixing.** ShipRex keys: ch14 was
  silent, so the "stereo" keys played hard-left at half level on a stereo strip (pan = balance)
  — the reason they sounded buried. Per-channel RMS (`pan=mono|c0=c1` into astats) on every
  2-ch file is now part of the per-band prep; switch such strips to mono.
- Desk channel labels come from a template; the engineer's Reaper labels are per band but
  contain copy-paste slips (OTR ch17 "Gtr 2", Jumbo ch20 "Gtr 3") — confirm ch17–20 by ear.

## Check the stems cover the whole set (they didn't)

- ShipRex stems began **65 s into the first song** (desk recording started late). Found by
  cross-correlating the OH stem against the Zoom crowd track (`scripts/find_start.py`):
  stems start at show TC 01:34:57:12 (Zoom 192449 sample 227,825,954), band started
  01:33:52:03, stems run 75 s past the last note. Always check both ends against the Zoom
  before mixing.
- Fix: cut sample-accurate fill from the Zoom desk feed (Tr1_2) + crowd (TrLR) with
  `ffmpeg -af atrim=start_sample=N:end_sample=M` (braces `${S}` in the shell), sized so the
  stems can sit at a round bar (bar 101 = 200 s at 120 bpm) and the fill at bar 1; crossfade
  at the join; "Plays at SMPTE" = TC of bar 1.
- Zoom vs desk clocks drift ~8 ppm (2.5 ms per 5 min) — fine for a fill at the join, not fine
  for long parallel use of Zoom under stems.
- On this Zoom, band-playing level is only −45…−50 dBFS on LR / −27…−33 on Tr1_2 (low gain,
  32-bit float); changeover silence −73. Calibrate before reading onsets from level alone.
- ffmpeg `astats=reset=N` + `ametadata=print` gave cumulative values here — use numpy for
  per-second RMS.

## Per-song mixing: Project Alternatives, not Save-As copies (decided 2026-08-30)

- Dean prefers per-song mix states over automation between songs. Use **File › Project
  Alternatives**: one package, shared audio, each alternative its own mixer/plugins/
  automation/cycle. Build the static chain + Ozone preset in "Master", then New Alternative
  per song (S1…S5). Track Alternatives are _not_ a substitute (they share the channel strip).
- Bounce each alternative over the song ± 5 bars (10 s) so consecutive files overlap 20 s in
  the applause; crossfade there in Resolve. Name `Band_Sn_title_vN_at_HH-MM-SS-FF.wav`;
  TC(bar) = fileStartTC + (bar − 1) × secondsPerBar.
- Consistency: identical Ozone preset in every alternative; QA each bounce's LUFS and trim
  the Stereo Out gain per song to within ±1 LU.
- Markers: created via MCP at whole bars; `rename_marker` doesn't verify — rename by hand.
  New markers have length ∞ until the next marker; give them lengths (drag right edge or type
  in the Marker List) so Set Locators by Marker (⌘U) works.
- Monitoring: −4 dB on Stereo Out for the rough bounce made the Mac headphone jack too quiet
  — mix at 0 dB, apply the trim only at bounce time (or get a headphone amp).
- Logic came back to the project chooser after a 100 % CPU stall (overviews for 19 new
  files + AX hammering). Markers survived (autosave); ⌘S often.

## Bounce QA

- `ffprobe` for rate/bits/`duration_ts`; `ffmpeg -af ebur128=peak=true,astats=…Peak_count`
  for LUFS / true peak / clipped-sample count; a numpy scan for _where_ the clips are.
- Checking bounce alignment by cross-correlating the mix against a stem: use a source
  with little processing and a narrow band (Keys 200–2000 Hz, OH >2 kHz). Wide-band mix-vs-OH
  gave a bogus +210-sample "lag"; the pitch-corrected/auto-levelled vocal gives random
  lags (+71…+1282). Keys read ±1 sample → bounce is sample-locked to bar 1.
- ShipRex rough v0 clipped: 12 transient events in the loud last third at 0 dBFS. Master
  needs ≈ −4 dB headroom before the rough; rough stays limiter-free.
- Logic 12 default Plug-in Latency Compensation is already "All (recommended)".
- The Bounce dialog appends `.wav` itself — typing the extension yields `name.wav..wav`, and
  it defaults to the project folder, not the last-used one. Name without extension, pick
  `03_Delivery/<Band>/`.
- ShipRex v0 rough delivered 2026-08-30: `03_Delivery/ShipRex/ShipRex_mix_v0_rough_at_01-31-37-12.wav`
  — −22 LUFS, peak −2.8 dBFS, 1678.0 s from show TC 01:31:37:12.

## Sync against picture — trust nothing until measured against the reference

- Zoom TrLR ≡ Tr1_2 (both desk feed; corr 1.00). The show reference is therefore the FOH
  mix; "crowd" it is not. Camera audio is the only room-delayed source.
- Stems vs reference (Vox stem, 300–3000 Hz, ±2 s window, 3 probes; **negative lag = the
  reference has the event earlier = stems are LATE**): Epsonics 60 ms early, ShipRex/Zoom1
  15 ms early, ShipRex/Zoom2 **130 ms late**. Dean confirmed the reference matches the camera
  in S5. **Resolution (video agent, same day):** Zoom-vs-camera drift is ~2 ppm; what looked
  like drift was each _picture block_ carrying its own constant offset vs the Zoom (Epsonics
  −1312 ms, ShipRex −170/−22 ms, encore −441 ms) plus a 148 ms discontinuity at the Zoom file
  split. The reference was rebuilt picture-true; against it ShipRex stems are 154 ms late
  (file start 5497.340 s) and Epsonics 1251 ms late (2822.441 s). Rule: measure every band
  against the rebuilt reference; never trust a Zoom-derived TC. Always run
  `stem_vs_ref.py`-style checks per Zoom region; use a narrow window (±250 ms) only after
  a wide one (±2 s) has found the true peak — a too-narrow window returns confident garbage.
- Final arbiter is the picture: a stick-on-snare frame vs the transient, once per Zoom
  region; apply as a global offset per region.

## Resolve hand-off

- Resolve Studio's Python API places a clip frame-accurately (`AppendToTimeline` with
  `recordFrame`); sub-frame remainders are a Fairlight nudge. While Resolve is rendering
  proxy media the API silently degrades — `GetCurrentPage()`/`DeleteClips()` return None —
  wait for the render, don't retry in a loop.
- Keep delivered filenames stable once they're in a Resolve media pool (relinking is worse
  than a stale TC in the name); carry corrections in DELIVERY-NOTES.md.

## mix-assist (Dean's stem analyser)

See `mix-analyser-learnings.md` (written by the mix-assist session) for export settings,
per-song workflow on alternatives, useful-vs-noise detectors on live material and the
live-mode to-do list. Headlines that changed a decision here:

- Logic's ⇧⌘E "All Tracks" also exports summing-stack auxes → double counting; mute stacks
  via `session.json` (or drop the aux files). S5 with stacks excluded: −16.2 LUFS / +0.7 dBTP
  pre-master; the +1.9 dBTP I first reported included the stacks.
- "timing_drift" vs a fixed bpm grid = live tempo movement (elastic grid is on their to-do).
- The vocal peaks that drive the S5 mix bus are at bars 735 / 746 / 748 / 762 / 771–775 /
  777 / 783 — not the loudest chorus — i.e. candidate spots for a per-song vocal ride.
  Lead sits 1–2 LU under the band in choruses, 5.5 LU under in the bridge (~705–711).

## Measuring stems offline (fast, and it beats guessing)

```bash
# per file: LUFS, LRA, true peak, RMS, sample peak
ffmpeg -nostats -i "$f" -af "ebur128=peak=true,astats=measure_overall=Peak_level+RMS_level:measure_perchannel=0" -f null - 2>&1 \
  | grep -E "I:|LRA:|Peak:|RMS level dB|Peak level dB" | tail -5
# clipped-sample count on the left channel
ffmpeg -nostats -hide_banner -i "$f" -af "pan=mono|c0=c0,astats=measure_overall=Peak_count+Flat_factor+Peak_level:measure_perchannel=0" -f null - 2>&1 | grep -E "Peak count|Flat factor"
```

- Grepping `I:` from ebur128's _info_ log captures every 100 ms progress line (4 MB/file);
  take the last match or use `-v error` with the summary only.
- Trim rule that worked: `trim = min(targetLUFS − LUFS, peakCeiling − truePeak)`, targets
  ≈ −26 LUFS close drums / −28 OH+room+hat / −22 bass+vox / −26 everything else, ceiling −3 dB
  drums, −4 dB vocals. Drums with huge crest factor (Rack 1: −32 LUFS, −1.4 dBTP peaks) get
  trim 0 and a gate, not gain.
- Live vocal desk feeds can touch 0 dBFS. 5 clipped samples ≈ harmless; check `Flat factor`.

## Polarity / alignment (measure it — `scripts/drum_polarity.py`)

- Cross-correlating close mics vs OH on a loud 20 s window gives polarity and lag in one
  run. ShipRex: **snare top inverted vs OH** (corr −0.65) — flip it; kicks/toms same.
- Close mics led the OH by 92–145 samples (2–3 ms ⇒ OH ≈ 1 m from the kit). Snare top
  arrived 15 samples _after_ the OH — a desk-channel latency artefact (≈3 ms), so the snare
  can't be aligned by delaying it; flip only.
- Room pair 25 ms late: leave it. OH L/R didn't reveal which side the hat is (corr ≈ 0).
- Applied on ShipRex: **Delay › Sample Delay** (not Utility) last insert on Kick In 145 /
  Kick Out 118 / Tom 1 105 / Tom 2 92 / Floor 97 samples; hats, snare, OH, room untouched.
  A/B with the whole band: subtle, "a bit fatter" on → kept.
- Snare-bottom layer: samples staged at `01_Media/_samples/Snare Bottom (DrumThrash SnareB)/`
  (DrumThrash free kit, royalty-free; 48 k/24-bit; Soft/Med/Hard round-robins, fundamental
  ~196 Hz ≈ the ShipRex snare's 200 Hz). `00 SnareBottom oneshot.wav` for Quick Sampler; the
  layered set for Sampler. Pack = the bottom mic's recording of every kit piece; only the
  `Snare*-*` files are snare hits.

## Signal chain (static, per source)

- Order: **Gain → Noise Gate → Channel EQ → Compressor → (DeEsser 2)**. Gate before comp —
  compression raises bleed and makes gates chatter. Vocals: **Gain → Pitch Correction →
  Channel EQ → Compressor**, pitch first on clean signal (Chromatic, Response ~70 ms lead,
  ~40 ms backing).
- Gates on a live kit: Reduction −20…−25 dB, not full; Detector High Cut (200 Hz kick,
  500–800 Hz toms) matters more than threshold; judge with the whole kit, not solo.
  RX De-bleed (offline, needs a reference track) beats gates on toms but only for the final
  mix on duplicates — gates for the rough.
- Gain plugin for staging, faders for mixing, region gain for per-song differences. Trim
  vocals to similar _pre-compressor_ level so one compressor setting fits all.
- Insert on many strips at once: multi-select strips in the Mixer, choose the plugin once.
- Add DeEsser/gates on vocals only when heard; leave inserted-but-bypassed at most.
- iZotope Nectar 4 ships its modules as **standalone plugins** (Compressor, Auto-Level,
  Breath Control, …) — use modules individually rather than the full Nectar chain so all
  vocals share one chain: Gain → Auto-Level → Pitch Correction → Channel EQ → Compressor.
  Anything non-stock is invisible to the MCP; keep stock Compressor where remote tweaks matter.
- Sample naming when hunting a snare-bottom: **Bottom/Under/Wires/Snares** is the layer
  wanted; "Body" = shell tone, "Transient" = attack click — neither adds rattle. Drum Replacer
  (Track › Replace or Double Drum Track, mode Double) adds a MIDI layer without moving audio.

## logic-pro-mcp (community MCP) — what it can and can't do on Logic 12.2

- Install: `brew tap MongLong0214/logic-pro-mcp … && brew install logic-pro-mcp`, then
  `claude mcp add --scope user logic-pro -- /opt/homebrew/bin/LogicProMCP` (absolute path —
  the session's spawn PATH may lack Homebrew). New user-scope servers need a **new session**
  (`claude -c`); `/mcp` in the running one won't see them.
- Control surface: the manufacturer is listed as **"Loud Technologies / Mackie"** (not "Mackie
  Designs" as the docs say); there is a search box. Click **Add**, not Scan. The
  `LogicProMCP-MCU-Internal` port only exists while the server process is running.
  Untick "Transport Button Click" on the device card.
- Works with verified readback: track list, mute/solo/rename, volume, pan, metronome,
  `logic_plugins.insert_verified` into **slot 0**, `get_inventory`, markers. Batched calls
  are serialised safely by the server.
- Doesn't work: WAV import (MIDI only), region placement, any insert slot > 0 (only occupied
  slots enumerate), sends, cycle locators, strip mono/stereo format, plugin params other than
  **Compressor threshold** (Gain dB and Channel EQ are insert-only in its catalog),
  goto_position readback unless the LCD is in SMPTE mode.
- Fader readback is 0–1 with ~10-raw-unit detents (≈2 dB). Calibrated against Logic's
  display: **value ≈ 0.758 + 0.026 × dB** — 0.758 = 0 dB, 0.705 = −2 (checked), 0.446 = −12
  (checked); linear at least over 0…−12 dB. 0.68 ≈ −3, 0.60 ≈ −6, 0.53 ≈ −8.5, 0.41 ≈ −13.5.
- **Track indices shift** whenever the user adds a stack header, aux, or reorders — an
  index-based write can land on the wrong track (a rename hit Rack 2 instead of Floor). Use
  `target_ref` (trk\_… from `logic://tracks`) for every write while the user is editing.
- After a stack is created the track-header pan readback returns 0 for everything; the
  `logic://mixer` resource still reads the real values. Cross-check before "fixing" pans.
- Track icons and stack creation are not reachable; both are quick by hand.
- The server's `sampleRate` field reported 44100 while the project was 48 k — treat it as a
  placeholder; verify sample rate with ffprobe on the bounce.
- `get_inventory` lists inserts **bottom-up** (verified: Gain at the top of the strip shows
  as the highest index). Reverse it before reasoning about chain order.
- Pan readback: Logic's ±64 pan maps to −1…+1 in ~10-raw-unit detents (≈ ±10 pan units), so
  requested 0.35 lands at 0.32 (+21). Fine for placement; not for surgical widths.

## Gotchas

- A stray record-arm (R) on a track + Record makes Logic record the Mac's mic onto it. Undo
  removes the region but the file stays in `Project.logicx/Media/Audio Files/` — delete via
  Browsers › Project Audio › Select Unused › Delete File(s). The MCP's `arm` toggle (MCU) did
  not clear it on 12.2; click R in Logic. Consider disabling the MacBook mic as Logic's input
  device (Settings › Audio › Input Device: none) on a mix project so this can't happen.

## Open items / to verify

- Fader dB calibration below −2 dB (spot-check Hi-Hat, Room, Vox 2).
- ShipRex start TC from the video agent → "Plays at SMPTE".
- Whether `Smart Tempo` mode survived the multitrack-set import as Keep.

## FCPXML import (scripted region placement)

- Logic 12.2 imports Final Cut Pro XML via **File › Import › Final Cut Pro XML…** (no
  options dialog; a sample-rate prompt appears only if the assets differ from the project).
  It bundles DTDs for fcpxml **1.0–1.8 only** (`Logic Pro.app/Contents/Resources/`), so
  write `version="1.8"`; 1.9+ are not covered. Its importer reads `asset-clip`/`audio`/`clip`
  with `lane`, `offset`, `start`, `duration`, `name`, `audioRole`, `audioChannels`, and the
  sequence `tcStart`/`tcFormat`; media is referenced by `file://` path, so the SSD must be
  mounted. It makes **one track per clip**, named from the clip.
- `scripts/make_fcpxml.py` writes one connected clip per stem (lanes −1…−N under a gap) at
  (file start − project start) as `N/48000s`; set `--project-start-tc` to the project's
  "Plays at SMPTE". Untested until a real import: whether Logic honours `tcStart` as the
  project start (script sidesteps it by writing `tcStart="0s"` + relative offsets), whether
  it rounds offsets to frames, and dual-mono → stereo quirks.
- After import, verify: open the Event List (D), set units to SMPTE (View › Event Position
  and Length in SMPTE Units), and check the first region's position equals the file-start
  TC (whole-show project) or 1 1 1 1 (per-band project); confirm OH/Keys/Room came in stereo.

## Epsonics mix scan (2026-09-03) — what the measurements found

Scripts added: `mix_scan.py` (per-second third-octave scan of every stem -> per-song levels
and tonal balance), `drum_scan.py` (polarity/lag, snare tone, sampler-trigger health, width),
`mix_findings.py`, `desk_compare.py` / `desk_project.py` (compare against the FOH desk feed).
Report: artifact "Epsonics Mix Scan".

- **The OH strip sums the stereo pair to mono.** Confirmed directly, not inferred: least-squares
  fit of the exported stem against the two source channels gives export ~= 0.52*L + 0.45*R
  (R^2 0.80, lag -2 smp, stable across the set). The pair is genuine (residual 79-93 % after a
  best scalar+delay fit, 12-19 samples apart; a true duplicate measures 0.0 %). Two possible
  causes to check: the channel-strip format button, or the **Mono button on the Gain plugin**
  in that chain. Epsonics exported 1 channel (points to format); ShipRex exported 2 identical
  channels (points to the Gain plugin). Biggest single cause of "thin drums".
- **The snare-bottom sampler sits +3.6 dB ABOVE the real snare's own contribution** - measured
  per hit (40 ms window) with the pre-hit bleed floor subtracted from the mic. Consistent
  +2.9..+4.4 dB across songs. Drop the sampler ~9 dB.
- **The snare mic is only mildly dark**: with each mic's bleed floor removed, crack 2-5 kHz is
  -2.6 dB and air -2.6 dB vs the ShipRex kit, and it has **+5.7 dB more 60-150 Hz thump**.

### Two first-pass findings that did not survive review (Dean caught both)

- "Snare 6 dB darker" was **bleed**. Comparing raw hit spectra between two bands compares their
  bleed floors too: the ShipRex snare mic sits 5 dB higher in the crack band because it picks up
  more hats. **Always subtract a pre-hit window** ([-75,-20] ms) from the hit window ([0,+30] ms)
  in the power domain before comparing two different mics.
- "The sampler misses a third of the set" was an **artefact of relative-threshold onset
  detection**. In passages where the drummer is not playing the snare, a per-window relative
  threshold finds bleed transients and calls them hits, then scores the sampler's correct
  silence as a miss. With an absolute threshold calibrated on loud sections, the sampler fires
  on **98.9 %** of 3123 real hits and 98.2 % of the softest quartile; 3 genuine misses in 161
  blocks. **Use an absolute threshold whenever "did X respond to Y" is the question.**
- Sample pitch matters: this snare is 200 Hz, the loaded DrumThrash SnareB is 193 Hz. SnareA is
  200 Hz with the best crack-to-body ratio; staged at `_samples/Snare Bottom (DrumThrash SnareA)/`.
- vs the FOH desk feed, consistently across all 7 songs: **+9.6 dB sub-40 Hz** (fix - pure
  headroom loss), +5 dB weight/body and +2.7/+4.0 edge/air (expected and correct for a playback
  mix), and a **2-3 dB midrange scoop at 300-1500 Hz** (watch - that is what "thin" sounds like).
- A FOH mix is a sanity check, never a target: the room supplies the acoustic kit and cabs, the
  PA is voiced mid-forward for intelligibility, it is effectively mono to the audience and it
  carries no ambience.

### Method notes worth keeping

- Compare a stem's level against the mix **over the seconds that stem is playing**, not the
  song average - otherwise a tom heard only in fills reads as "as loud as the whole mix".
- Gate "sits out this song" against the stem's **own median**, not its loudest song; anchoring
  to the max marks a quiet backing vocal absent all set.
- Tonal comparison of an intermittent source is bleed, not tone - require >=60 % active.
- Per-band NNLS of the desk mix onto grouped stems is **ill-conditioned** (it zeroed drums out
  of the presence band); projecting onto single stems explained only 2-18 %. Neither is
  reportable. Whole-mix tonal comparison is reliable and was used instead.
- Logic appends `_1` to exported stem names when the export finishes, which pulls files out
  from under a running analysis - wait for the rename, not just for the size to stop growing.

### Sub-40 Hz rumble: it is the kick mics, and steep beats shallow (2026-09-04)

- Ranking every post-fader stem by sub-40 Hz energy: **Kick In 95.1 %, Kick Out 4.7 %, all
  other 16 sources 0.2 % combined**. High-passing anything but the kicks buys nothing.
- It is the drum, not noise: only 6-7 % of the 20-40 Hz energy falls between kick hits (which
  are silent 48 % of the time), and it is 11 dB louder during hits. Beater impact exciting a
  long low resonance. The 20-40 band decays slower than 50-120 (11 vs 18 dB down between
  hits), which is the resonance signature.
- Simulated filters on the kick mics, measured mix-wide:
  30 Hz/24 dB oct -3.2 dB sub-40, no weight cost - 35 Hz/24 **-6.4 dB, -0.2 dB weight** -
  40 Hz/24 -11.2 dB, -0.5 dB - 40 Hz/**12** dB oct -9.1 dB but **-1.4 dB weight**.
- **A steeper filter is better here.** A 12 dB/oct slope has to start cutting 40-80 Hz to
  reach down to 30; 24 dB/oct cuts below and leaves the fundamental. Shallow-and-high is the
  worse trade in both directions.
- Corrects the original static table ("Kick In: no HPF") - keep the weight, but put a
  subsonic filter under it.

### Sampler root key vs Drum Replacer trigger note (2026-09-04)

Set a sampled drum zone's **Root Key = the Drum Replacer trigger note** (here D1), and the
zone's key range to that single note. Root note == trigger note means zero transposition by
construction, whatever the Pitch toggle is doing. Do not leave the default Root Key C3.

**Do not try to measure the transposition from the rendered stem.** I tried and got two
incompatible answers on the same material: +1.15 semitones from the dominant partial, -11
semitones from log-frequency spectral alignment (correlation only 0.61), against a predicted
-26 if the zone really were tracking a D1 trigger from Root Key C3. A snare-bottom sample is
noise-like, so "pitch" is ill-defined and the alignment locks onto octave-ish false optima;
the track's reverb and EQ also stretch the decay (rendered 189 ms vs source 76 ms), so decay
length is not clean evidence either. Make it deterministic instead of diagnosing it.

Related: pick the sample on its native pitch, and treat fundamental estimates on these
sources as +-7 Hz at best - that is the spread I got just from changing the analysis window.

### Reading a .exs Sampler instrument directly (2026-09-04)

Logic's `.exs` files are a flat chunk list, no container. Each chunk is an 84-byte header
followed by `size` bytes of body:

| offset | field |
|---|---|
| 0 | uint32 signature |
| 4 | uint32 body size |
| 8 | uint32 id |
| 12 | uint32 flags |
| 16 | char[4] magic `TBOS` |
| 20 | char[64] name |

Signatures seen: `0x00000101` header, `0x01000101` zone, `0x02000101` group,
`0x03000101` sample, `0x04000101` params, `0x0a/0x0b000101` other.

Zone body fields, verified against hand-set values in the UI:

| byte | field |
|---|---|
| 1 | root key (38 = D1) |
| 6, 7 | key range low / high |
| 9, 10 | velocity range low / high |
| 16-23, 24-31 | sample length in frames |
| 88 | group index (0-based) |
| 92 | zone order |

Sample chunks carry the **absolute** volume path plus the filename as plain strings, so an
instrument built from `01_Media/_samples/` is portable across bands but **not** across
machines or a renamed volume.

**This is a good way to verify what the UI actually wrote.** Setting Root Key on one zone in
the Sampler UI silently didn't take here - five zones read 38, one still read 14, which is a
2-octave transposition on the loudest velocity layer. Patching byte 1 of that zone's body
fixed it in a second. Keep a `.bak`; if Logic still has the instrument loaded it will
overwrite an external edit on its next save, so reload the instrument afterwards.

**What this method could not settle: round robin.** Both group bodies are byte-identical
apart from a per-group Unix timestamp at bytes 136-139, so comparing the groups to each other
proves nothing either way - a shared round-robin chain would look exactly like this, and so
would round robin being off. Deciding it needs an A/B against a saved copy with the setting
off. Don't infer a binary field from a single sample of the file.

### Logic at 90%+ CPU doing nothing: stale MCP servers (2026-09-04)

Symptom: Logic pegged near 100% CPU with **zero windows open**, and every
`logic_system.health` call timing out at 25 s. It reads exactly like a hang. It is not.

`sample <pid>` showed the main thread parked in `nextEventMatchingMask` - an idle event
loop - but constantly interrupted by accessibility traffic:

```
_XCopyAttributeValue -> _AXXMIGCopyAttributeValue -> CopyAttributeValue
  -> -[NSApplication accessibilityWindowsAttribute] -> run_query (SkyLight)
```

**Every Claude session spawns its own `LogicProMCP`, and it does not exit when that session
ends.** Two were running: one from the live session, and an orphan from a session opened
three days earlier, each polling Logic's AX tree continuously at ~15% CPU of their own. The
orphan had been doing this for 2 days 19 hours.

```bash
ps -eo pid,ppid,etime,command | grep LogicProMCP    # ppid tells you which claude owns each
kill <orphan pid>                                    # helper process, respawns on demand
```

Killing the orphan took Logic from 97% to 37%. **Check this before diagnosing anything else
as a Logic problem** - a slow, unresponsive Logic with no obvious cause is more likely to be
accumulated MCP servers than a fault in the project.

Two measurement traps this exposed:

- **`ps -o pcpu` is a decaying lifetime average, not instantaneous.** It still read 75% when
  `top -l 2` showed 37%. Use `top` for a live number.
- **"0 windows" from System Events does not mean the app is wedged.** Confirm the session is
  actually unlocked (`osascript ... first process whose frontmost is true` - if it returns
  `loginwindow`, AX automation cannot work at all) before concluding anything from an empty
  window list.
