# songmap — what's going on in each song, for the multicam cutter

Per song of the BOTTB Sydney 2026 show (take `#02`, REF seconds = desk multitrack file seconds), a map
of **sections with musical names**, **who is featured** and **events**, so an automatic cutter
(gigstills) can show the singer who is singing, the guitarist who is soloing, and change pace with the
song. Built 2026-10-13/14 overnight for the editor session (bottb-68).

Outputs in `/Volumes/BOTTB/Sydney - 2026/video/song_maps/`:

| File                       | What                                                                                                            |
| -------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `<Set>/<song>.events.json` | one song: `sections`, `featured`, `secondary`, `events`, `performers`, `stage_x`, `lyrics`, `hooks`, `boundary` |
| `<Set>/_review/<song>.png` | review plot: sections, vocal excess per mic, lead scores + featured spans, band level, crowd, events            |
| `songs.json`               | every song plus the talk/changeover spans between, REF + timeline frame + TC (for Resolve markers)              |
| `events_index.json`        | one row per song map                                                                                            |
| `EVENTS-README.md`         | the per-song confidence table and what was looked at                                                            |
| `_cache/`                  | features (`<band>_features.npz`), vocal sums for ASR (`vox16k/`), Whisper words                                 |

`index.json`, `README.md` and `*.grid.json` in that folder belong to mix-assist (beat/bar grids); this
never writes them. Song windows and section boundaries come from those grids.

## Run

```bash
cd doc/production/scripts
PY=<venv with numpy scipy soundfile librosa matplotlib>     # e.g. a uv venv; bottb's venv lacks matplotlib
$PY -m songmap.features <band>                              # ~40 s/band, 0.55 GB peak: features cache
$PY -m songmap.run_band <band> --plots                      # maps + review plots (needs the grids)
$PY -m songmap.lyrics prep <band>                           # gated vocal sums, 16 kHz
<gigstills venv>/python songmap/lyrics.py asr "<song_maps>/_cache/vox16k/<band>"   # Whisper, 1.7 GB peak
$PY -m songmap.run_band <band> --plots                      # again, now with the lyric hooks
$PY -m songmap.index                                        # songs.json + events_index.json
$PY -m songmap.frames out.jpg 4296 5210 --angles 1,3,4      # look: camera frames at REF times
$PY -m pytest songmap/tests -q
```

Bands: `shiprex bandlassian canvanauts amakazaam v2voyagers`. Per-band facts (mic → person, track →
instrument and stage position, per-song players, per-song overrides) live in `config.py`; what was
confirmed by looking is commented there.

## Method (and why)

Research (2026-10-13): pretrained structure models were checked first. **All-In-One (`allin1`)** is
MIT, tiny (8 × 1.4 MB folds) and labels intro/verse/chorus/bridge/inst/solo, and it can skip demucs if
handed four stems — but on macOS arm64 it needs NATTEN 0.15.1 patched to C++20 plus a torch shim
(installed and imported in a scratch venv, never run on audio). **SongFormer** is GPU-oriented with
unclear weight licensing; **MSAF** fails to import on current scipy; **librosa** novelty gives
unlabelled boundaries only. None knows who is featured. A live multitrack makes the hard part —
"who is playing/singing now" — directly measurable per channel, and mix-assist already supplies
bar-snapped section boundaries, so the build measures the multitrack instead of running a model.

1. **Vocal activity per mic.** Mic level in 200 Hz–4 kHz minus the overheads' level in the same band
   (the overheads hear the same stage bleed), minus that difference's 25th percentile over the song;
   gated within 12 dB of the mic's noise floor. Idle mics sit at 0–3 dB, a singer at 12–25 dB; on
   above 9 dB, off below 6 dB, phrases joined across gaps < 1.5 s. Simple per-mic floors failed: a
   loud band hit lifts every mic together (Joker 4120–4123). Checked by looking: Canvanauts RX3-only
   moments frame the singer in the hat, RX2-only the blond singer (4130–4156).
2. **Instrument activity** per DI/amp track: > 15 dB (or half its range) over its own floor.
   **Kit playing** from the kick/snare close mics (the overheads hear the guitar wedge: the Joker
   intro guitar alone looked like "drums on").
3. **Lead score** per melodic instrument, each term against the track's own median in this song:
   monophony (chroma entropy down) 0.25, level boost 0.2, brightness 0.1, exposure (its level over the
   other melodic tracks) 0.2, and **chroma flux** (pitch-change rate) 0.25 — the term that separates
   solos: Life Is a Highway's solo 0.25 vs 0.14 in the verse, Pokémon 0.33 vs 0.19, So Easy's BASS Q
   0.27 vs 0.15. Bass gets −0.2 (it is rarely featured; Beggin's bass solo still clears it).
   A band's melodic lead instrument (ShipReX's erhu) gets +0.4. While nobody sings, the top
   instrument is featured if > 0.45 and 0.15 ahead of the next; a lone instrument with the kit off
   is featured; only the kit → `drums`; otherwise `band`. Under the vocals, an instrument > 0.6 is a
   `secondary` span (a lead line under the singing).
4. **Featured** spans at 0.5 s resolution: the vocal block (phrases joined across < 3 s) → the mic
   with the most activity-weighted excess over 3 s (`with` lists the other live singers);
   instrument features must hold ≥ 3 s.
5. **Sections.** mix-assist's bar-snapped, lettered sections, split where the vocal state (none /
   one singer / two or more) changes for ≥ 6 s, snapped to its bar lines. Names:
   - before the first section that is ≥ 50 % sung → `intro`; after the last → `outro`;
   - vocals off mid-song: `solo` (an instrument leads ≥ 40 % of it), `breakdown` (band −5 dB or kit
     mostly off), else `unknown` ("instrumental");
   - **chorus = the sung sections that contain the song's hook words** (title/hook phrases found by
     Whisper small.en on each song's gated vocal-mic sum, `lyrics.py`), when ≥ 2 sections have them;
     otherwise the loudest repeated group (grid letter + vocal state; energy, cymbals, dual vocals);
   - a short (≤ 16 s) repeated sung section right before a chorus → `pre`; one sung section after the
     second chorus that was never heard before → `bridge` (at most one); the rest → `verse`.
     Each section carries `energy_db` (band level vs the song median) so the cutter can pace even where
     the name is unsure.
6. **Events**: `song_start/end`, `vocal_entry` (a sung phrase after ≥ 4 s without vocals),
   `solo_start/end`, `drum_fill` (T1/T2/FT hits from 300 Hz low-passed envelopes: an 8 dB rise to
   within 10 dB of that tom's p99.5; ≥ 3 hits with gaps < 0.5 s; clusters that repeat within 10 s or
   last > 3 s are flagged `pattern: true`, confidence 0.2 — a tom groove, not a fill), `stop`
   (band > 15 dB under its 4 s median for 0.2–3 s) with the `big_hit` after it, `big_hit` at section
   starts with a ≥ 9 dB cymbal jump, `crowd_cheer` (FOH camera audio minus desk sum, 300 Hz–4 kHz, 7 dB
   over the song's own median for ≥ 2 s).
7. **Boundaries** (`songs.json`): start = the grid's first downbeat (it trims count-ins and walk-on
   noodling), except (a) an unaccompanied vocal that runs straight into it (≥ 4 s, ≥ 90 % voiced, one
   singer: Beggin' 4810.05) and (b) music the grid left unmapped (melodic instruments on ≥ 60 % of the
   head: Careless Whisper's erhu from 474.68, I'm a Believer from 3184.40). End = the sound's end: the
   instrument sum > 18 dB under the song median (or within 10 dB of the following gap's floor) with
   gaps < 0.5 s bridged; the grid's last bar line is kept in `boundary.grid_end_s`. Between songs:
   `talk` (who speaks, from the vocal mics) or `changeover`, with the FOH crowd level.

## What does not work well (yet)

- Section names inside songs with no clear hook or with grid sections that hold verse + chorus in one
  instrumentation; one-off sections; songs whose arrangement differs from the record.
- Lead attribution between two guitars playing in unison, and keys features: the camera operators
  framed a guitarist, not the keys, at every keys claim checked (Joker 4302/4322, Thnks 4452).
- ShipReX's Thiago section in Uprising (764–841): the cameras frame him, but no audio term picks it
  out of the riff (mic'd amp, constant level, flux at the song median).
- Crowd: one room camera vs the desk; singing along under a loud chorus is missed.
- Whisper on singing is approximate (verse words garbled), but hook phrases are reliable.

## Memory

Features 0.55 GB/band (one track at a time in 60 s blocks); mapping 0.9 GB; frame grabs 0.1 GB;
vocal prep 1.0 GB; Whisper small.en 1.7 GB with segment timestamps (word timestamps cost 9.9 GB and
the pipeline's own chunking 5.2 GB — don't).
