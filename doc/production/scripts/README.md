# Production audio scripts

Offline analysis for mixing desk multitracks. Need ffmpeg on PATH and a Python venv with
numpy + scipy (`python3 -m venv venv && venv/bin/pip install numpy scipy librosa soundfile`).

- `drum_polarity.py <stem folder>` — finds a loud 20 s window from the snare track, then
  cross-correlates each drum close mic against the overheads (L+R) and a few pairs. Reports
  polarity (SAME / INVERTED) and arrival lag in samples/ms. Negative lag = close mic earlier
  than OH (expected; ~48 samples per 0.3 m). Use: flip the INVERTED ones (Gain → Phase
  Invert); optionally Sample Delay the close mics by |lag| to align to OH, revert if the kit
  sounds smaller. Expects the BOTTB desk file names (01_Kck IN.wav … 21&22_Room.wav); edit the
  `tracks` dict for other layouts.
- Stem loudness/peak table: see the ffmpeg one-liners in `../live-mix-logic-learnings.md`.
- `find_start.py` — cross-correlates a stem (default: the OH file) against the Zoom TrLR
  recordings at 4 kHz to find the stem's show timecode; two probes 10 min apart must agree.
  Edit the `stem`, `zooms` (path, file start TC in seconds) at the top. Prints the start TC
  per Zoom file; only the file that actually covers the set will show a strong peak (>30×
  noise). Follow with per-second RMS of the Zoom Tr1_2 (desk feed) to find the band onset and
  check the stems cover both ends of the set.
- `build_media.py [band …]` — per band: locate the engineer's Reaper render inside the
  Direct-to-USB recording (OH cross-correlation, refined to the sample on kick-in), verify
  identity, measure how much music the render missed at head/tail, convert the full USB set
  to named 24-bit WAVs with pairs merged (09+10 → OH, 13+14 → Keys, LineL/R → Room), and
  re-verify. Writes `media_report.json`. Paths at the top.
- `vocal_harmony_scan.py --raw DIR [--proc DIR] --songs "a:b,…" --mic v1="17 Vox 1.wav" … --lead v2
[--bus VOX_1.wav] [--only-song 6] [--fine] [--timeline 1688 1695] [--out report.json]` — who is
  actually singing a harmony part on bleed-heavy live vocal mics, and what the processing did to it.
  Ten stages: raw-vs-processed alignment (1 ms envelope cross-correlation), 200–3000 Hz activity map,
  prominence histograms (the bleed check — a single cluster below 0 dB means the mic never dominates),
  pyin pitch tracks, per-pair intervals (unison/octave %, 50-cent bins, ET-vs-JI deviation per interval
  class), raw-vs-processed pitch shift, bleed-proof note-onset timing on notes ≥150 c away from the
  other voice, per-voice third-octave spectrum with the bleed floor subtracted, per-phrase level spread
  plus bus-minus-sum and bus width, and a note-name timeline table. Pick stages with `--stages 2,3,5`;
  processed stems are name-matched loosely; pyin results are cached in an `.npz` beside `--out` so only
  the first run pays for pitch tracking (~1 min for one song × 8 files). Needs the venv plus librosa and
  soundfile. Gotchas baked in: never gate on the wideband envelope (bass bleed swamps it) or on pyin's
  `voiced_prob` (~0.05 on these mics).
- `make_fcpxml.py <stem folder> --file-start-tc <pos> [--project-start-tc <pos>] -o out.fcpxml`
  — stdlib only (no venv needed). Writes a Final Cut Pro XML (version 1.8, the newest DTD
  Logic 12.2 ships) with one connected `asset-clip` per WAV so Logic's File › Import › Final
  Cut Pro XML creates one named track per stem with the region at
  (file start − project start) from bar 1, sample-accurate (`N/48000s`). `<pos>` is
  `HH:MM:SS:FF` (25 fps, frame-rounded), `2823.692s`, `135537216smp` or a float in seconds —
  use the seconds/samples form when the README gives a sub-frame start. `--project-start-tc`
  = the Logic project's "Plays at SMPTE" (00:00:00:00 for a whole-show project, the band's
  file start for a per-band project → offset 0). Prints a per-file table (channels, samples,
  offset). Check with `xmllint --noout --dtdvalid FinalCutProX_DTD_v1.8.dtd out.fcpxml`
  (copy the DTD out of `/Applications/Logic Pro.app/Contents/Resources/`). See
  `../live-mix-logic-learnings.md` § FCPXML import.
