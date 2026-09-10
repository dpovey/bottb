# Video post (DaVinci Resolve) — learnings log, BOTTB Brisbane 2026

Companion to `live-mix-logic-learnings.md` (audio side). Things that were **not** obvious.
Resolve Studio 21.0.4, macOS, M4 Pro / 24 GB. Timecodes are show TC (00:00:00:00 = video
timeline zero = first frame of the earliest camera clip, CAM D `C3776.MP4`), 25 fps.

## Cameras and formats

- CAM A = Sony FX3 (roaming), CAM B = A7S III (stage left, audience view), CAM C = A7S III
  (stage right), CAM D = A7 IV (wide, back of room). All XAVC S 4K 3840×2160 25p,
  **H.264 High 4:2:2 10-bit**, 140 Mbps, Rec.709/Rec.709 — _not_ Log. The container's NCLC
  tags say bt709 on every Sony clip regardless of profile; the authoritative field is Sony's
  embedded XML `<Item name="CaptureGammaEquation" value="rec709"/>` (S-Log3 shows
  `s-log3-cine`). Verified on all 33 clips (`strings` on the last 4 MB of each file), plus
  pixel checks (blacks reach <10/1023, highlights hit 1023 → not Log). No LUTs, no RCM; plain
  DaVinci YRGB, timeline Rec.709 Gamma 2.4.
- Every camera is in **Rec-Run timecode**: TC is gapless across clips even when the camera was
  stopped for ten minutes. Never derive clip positions from source TC on this footage. Sony's
  `CreationDate` (1 s resolution) is the only per-clip wall-clock and it is per-camera
  (each camera's clock is offset differently; CAM D's clock read 14 May +09:30).
- Sony writes `DeviceSerialNo="4294967295"` (blank) on these bodies.
- Metadata CSV import into Resolve: the file must be **UTF-16 with BOM, unquoted**, with
  Resolve's own column names (`File Name`, `Clip Directory`, `Camera #`, `Angle`, …). A UTF-8
  CSV silently matches nothing ("No matching media pool entries"). Easiest: Export Metadata
  from Resolve first and append columns to that file.

## Sync — how the multicam was built (and what was wrong with it)

- Resolve's own "Create Multicam Clip → Sound sync" on this material dropped 12 of 33 clips
  and placed three of the six band blocks 24–55 min wrong (no continuous audio across
  changeovers; it chained clips pairwise and lost the chain). Don't use it for a whole show
  with gaps.
- Replacement: measured sync by audio cross-correlation (8 kHz mono, 100 Hz log-RMS
  envelope, FFT correlation) of every clip against a **CAM B timeline laid out from
  CreationDate**. Camera clock offsets vs CAM B were constant to ±1 s per camera all night
  (CAM A −646.5 s, CAM C −147.2 s, CAM D +105 days). Short changeover clips (<45 s) that
  don't correlate were placed from CreationDate + camera offset and refined against the Zoom.
  A 4-track timeline was built via the scripting API (`AppendToTimeline` with `recordFrame`,
  `trackIndex` — which also selects the audio track, so create 4 audio tracks first) and
  converted with _Convert Timelines to Multicam Clips_. Grades applied to the timeline
  **survive** conversion (tested with a blue CDL).
- **The flaw**: CAM B clips were placed from 1-second CreationDates and never checked against a
  continuous clock. Cameras are correctly synced _to each other_ inside each band block, but
  each block's absolute position was off by a different constant. Measured against the Zoom
  (band-limited 300–3000 Hz, 6 probes per clip, ±3 ms consistency):

  | Block (CAM B clip)                    | Show range        | Zoom vs picture (old ref)           |
  | ------------------------------------- | ----------------- | ----------------------------------- |
  | Set 1 `C8816`                         | 00:00:12–00:39:48 | −14…−17 ms                          |
  | Set 2 `C8817` (Epsonics)              | 00:49:24–01:20:26 | **−1312 ms**                        |
  | Set 3a `C8818` (ShipRex, Zoom file 1) | 01:32:16–01:49:02 | **−170 ms**                         |
  | Set 3b `C8818` (Zoom file 2)          | 01:49:02–01:57:38 | −22 ms                              |
  | Set 4 `C8820`                         | 02:11:36–02:39:55 | −80 → −105 ms (23 ms step mid-clip) |
  | Set 5 `C8821`                         | 02:52:41–03:26:01 | −9…−12 ms                           |
  | Encore `C8822`                        | 03:35:06–03:38:52 | **−441 ms**                         |

  Zoom-vs-camera clock drift is ~2 ppm (negligible); the "~30 ppm drift" seen from the stems
  side was these block offsets plus the Zoom-1/Zoom-2 join being anchored to two different
  blocks (148 ms discontinuity). The multicam could not be re-timed without destroying the
  existing cut (404 cuts on set 3), so the **reference audio was rebuilt piecewise** on
  2026-08-30 with a per-block delay (linear interpolation between the measured points, 5 ms
  crossfades every second) so that it sits on picture everywhere: residuals 0–5 ms at 12/14
  probes, −22 ms at one point in set 4. The **picture blocks remain where they are**; anyone
  placing continuous desk audio must use _per-set_ anchors measured against picture (or
  against `BOTTB_reference_48k.wav`, which is now picture-true), not one global offset.

- Sign convention used above and in `scratchpad/zoomsync.json`: lag = position of the Zoom
  event minus position of the same event in the camera; negative = Zoom is _early_, i.e.
  Zoom-derived TCs must be moved earlier by |lag| to land on picture.

## `BOTTB_reference_48k.wav` (48 kHz, 24-bit stereo, starts at 00:00:00:00, 03:39:00.76)

- 00:00:00–00:00:12.40: CAM D `C3776` mic. 00:00:12.40–00:15:51.13: CAM B `C8816` mic,
  EQ-matched to the Zoom (30-band gain curve from Welch spectra over an overlapping minute:
  camera mic had ~10 dB too much <150 Hz and rolled-off highs) and level-matched (−6.7 dB);
  50 ms / 1 s equal-power crossfades. Zoom TrLR from 00:15:51.13; file joins at 01:49:01.98
  and 03:22:12.97 with 20 ms crossfades, each Zoom file placed at its own measured position.
  Zoom normalised +21.65 dB to −1 dBFS peak. Then the per-block delay above (v2).
- **The Zoom "TrLR" is identical to "Tr1_2"** (my own window test showed corr 1.00, lag 0 —
  I failed to flag it at the time). So the reference is the **FOH desk feed**, not room mics;
  only camera audio is room-delayed (CAM D's mic is ~30 ms later than CAM B's).
- Zoom level: −45…−50 dBFS RMS while a band plays (32-bit float, no harm).

## Desk stems (audio session's domain — cross-checks from this side)

- Epsonics Reaper renders (old `01_Media/Audio/Epsonics`) started at Zoom-time
  **00:49:43:12** (2983.480 s, three probes 20 min apart agree to ±5 ms) — that is a Zoom
  anchor, so picture-true is 1.312 s earlier: **00:48:42:04**. With the USB file's 159.788 s
  offset, the USB Epsonics file starts at picture-true ≈ 2822.38 s. Confirmed by the audio
  session against the rebuilt reference (2026-08-30): **Epsonics USB file start 2822.441 s
  (00:47:02:11)**; **ShipRex file start 5497.340 s (01:31:37:08 +20 ms)**; both consistent to
  ±2 ms across Zoom regions. Recorded in `01_Media/README.md`.
- ShipRex: the audio session's −130 ms picture correction is consistent with the block-3b
  measurement (−22 ms) and their stems-vs-old-reference (+130 ms late) to within a frame.

## Resolve scripting API — what it can and can't do (README in

`/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Scripting/`)

- Can: read/write clip metadata and Clip Attributes (`SetClipProperty("Super Scale", 2)`),
  build timelines with exact record frames, create/assign Colour Groups, `SetCDL` on clip
  nodes, `SetLUT`/enable nodes on group and timeline graphs, markers, clip colours,
  `GrabStill` + `ExportStills` (gets graded frames out for measurement), render settings/jobs,
  `SetSetting` for many project settings (cache location, proxy resolution, proxy mode).
- Can't: create or switch multicams; see inside a multicam (no timeline object when it's
  "Open in Timeline"); add OpenFX (Deflicker, Film Look Creator); generate proxies/optimized
  media; set proxy _format_ or _location_; read node enable/bypass state; select items in the
  UI. Settings calls return `None` while a modal dialog is open.
- The project database (`~/Movies/DaVinci Resolve/Resolve Projects/Users/guest/Projects/<name>/
Project.db`, SQLite) is readable: `Sm2TiTrack` / `Sm2TiItem` (Start/Duration stored as text
  frames) reveal multicam angle contents. Used to verify the multicam and to diagnose the
  broken one.
- Multicam group grades are only reachable via Media Pool → right-click multicam → _Open in
  Timeline_ → Colour page (four dots: Group Pre-Clip / Clip / Group Post-Clip / Timeline).
  From the edit timeline the multicam item only exposes the current angle and isn't itself a
  group member. The 2×2 Multicam Viewer exists only on a normal timeline.

## Grading structure (decided)

Group Pre-Clip = camera correction (+ Deflicker) → Clip = per-shot exceptions →
Timeline node = Film Look Creator (Aurora, tuned: contrast ~1.1, fade 0.03–0.06, highlight
roll-off up, tint 0, richness over saturation, skin bias +0.1–0.2, halation small, bloom off).
Auto camera-match from frame statistics gave usable _colour balance_ (CAM D −15 % blue) but
**wrong exposure** (framing bias — "CAM C darker" was dark background, not the sensor); exposure
is matched by eye on a common reference (e.g. both cameras at the same spot, 08:34). CAM A is
natively ~+0.3 st hot.

## Flicker

- Stage-light PWM banding (rolling bars on performers): real on CAM C (worst sets 4–5) and
  intermittently CAM A; CAM B/D effectively clean. Detector: 3 consecutive frames, row-mean
  luma profiles, narrow spectral peak in the frame-difference profile at 3–40 cycles/frame,
  same frequency in two consecutive differences. First version measured the **LED screen**
  (bands on all four cameras) and flagged everything; mask the screen region per camera.
- Fix: Resolve FX Revival → Deflicker (Fluoro Light) in the CAM C / CAM A group Pre-Clip;
  LED screen = separate Deflicker node with a Power Window on the screen _and_ Limit Analysis
  Area on the screen (window = where it's applied, analysis area = where it measures). For
  moiré on the screen: Advanced → Mo.Est. Faster/None, Reduced-Detail Motion on, Detail to
  Restore up, chroma threshold ~30–50, Magnified Flicker output to check. A small blur inside
  the window is often the cleaner fix.

## Playback / proxies / caches — the expensive lessons

- Apple silicon does **not** hardware-decode H.264 4:2:2; these Sony files are software-
  decoded. A 2×2 multicam view = four software 4K decodes → unusable regardless of grading.
  **Generate Proxy Media, Half res, H.264** (33 clips → 59 GB on `/Volumes/BOTTB/Proxies`),
  then Playback → Proxy Handling → Prefer Proxies. The defaults ("Choose automatically" +
  ProRes 422 HQ) produce full-4K ProRes HQ proxies ≈ 4 TB for 14.6 h — filled a 1.8 TB SSD
  twice. Never Optimized Media at 4K ProRes HQ either (hundreds of GB).
- Super Scale is a _source-clip_ attribute (greyed out on multicam items) and processes the
  whole clip at every use; 2× on five 30-min clips made playback crawl. Plan: off while
  cutting; at picture lock enable 2× on the clips feeding zoomed cuts, **Render in Place** only
  those cuts (ProRes 422 HQ, Include Video Effects on, Include Color Grading off, timeline
  res, 12-frame handles), then off again. 3×/4× Super Scale isn't worth it on the noisy wide.
- Render cache: no "render now" button; background caching only when idle (after 5 s).
  Cache format stays ProRes 422 HQ (cache frames are used in the final render); cache location
  moved to the Extreme SSD via `SetSetting("perfCacheClipsLocation", …)`. Proxy location and
  format are UI-only (Working Folders / Optimized Media and Render Cache panels).
- Film Look Creator + Deflicker: bypass (Cmd-D) while cutting; Node Cache: On at finish.
- Internal disk filled to 2.6 GB free during this: 34 GB Resolve cache, 53 GB Bazel cache,
  plus the runaway proxies. Check `df` before any generate/cache job.

## Markers on `BOTTB Brisbane 2026`

blue = set start/end (from CAM B rolling), green = song candidates (level/flatness detection
on the reference — rough), yellow = flicker ranges, red = per-shot exposure/colour exceptions
(rolling stats per clip vs that camera's norm; most CAM A/D "dark" flags are blackouts/crowd,
not fixes). Zoomed cuts are clip-coloured orange (1.3–2.4×) / red (≥2.5×) for Render in Place.

## Scratch / tooling

Session scratchpad: `build.py` (POS table: measured clip start positions in CAM-B time,
anchor 243.58 s = `C3776` start), `clips.json`, `zoomsync.json` (Zoom-vs-picture probes),
`buildref.py` / `buildref2.py` (reference build and per-block correction), `flicker2.py`,
`exceptions.py`, `zoomed.json`. Python venv with numpy/scipy/soundfile/tifffile; ffmpeg/
ffprobe/exiftool; Resolve manual extracted to text for menu-path checks.

## Render gotcha (2026-08-31, corrected 2026-09-05)

- `SetRenderSettings({"VideoQuality": N})` DOES restrict bitrate — but **N is in Kb/s**
  (same units as the Deliver page's "Restrict to" field), not bits/s. Passing 120000000
  (intended as 120 Mb/s) is read as 120 Gb/s -> effectively auto/max, which is how a
  "120 Mbps" job came out at 506 Mbps and a "16 Mbps" 1080p at 179 Mbps. Correct:
  `"VideoQuality": 24000` = 24 Mb/s. Direct Resolve renders at target bitrates work with
  the right units; ffmpeg from a ProRes master stays the fallback
  (`ffmpeg -i master.mov -c:v hevc_videotoolbox -b:v 24M -tag:v hvc1 -pix_fmt p010le -c:a aac -b:a 320k out.mp4`).
- Cancelling a Resolve render mid-job leaves truncated output AND lets automation chains
  keep going on the partial file — any waiter must verify JobStatus == Complete AND the
  expected duration before consuming the output.
- QC pass used on the ShipRex master: blackdetect/freezedetect (ignore the end fade),
  ebur128 (true peak <= -1 dBTP), cross-correlation of render audio vs
  BOTTB_reference_48k.wav at 3 points (< 1 frame).

## Dynamic Zoom is invisible to ZoomX/ZoomY (found 2026-09-06)

- The Edit page's Dynamic Zoom does not touch `ZoomX/ZoomY`; the only API trace is
  `DynamicZoomEase` != 0 (no on/off flag, no rect access). 54 dynamic-zoom cuts (34 Epsonics,
  20 ShipRex) were missed by the static-zoom detector and shipped without Super Scale in the
  first two releases. Detector rule now: static zoom >= 1.3 OR DynamicZoomEase != 0.
  Render in Place with Include Video Effects ON bakes the DZ animation correctly.

## Song starts, title cards and chapters (final, 2026-09-06)

All five sets titled: 30 song cards on the master's V2 and 30 Mint "CH <band> <n> <song>"
chapter markers. Every start below is Dean-confirmed by ear or measured and then confirmed;
this is the authoritative song-start table (show TC, 25 fps):

- **Off the Record** (set 1): Just a Girl 00:10:03:20 · Immigrant Song 00:14:19:19 ·
  It's All Coming Back to Me Now 00:17:48:00 · Barracuda 00:22:54:00 · It's My Life
  00:28:45:00 (stick-click count-in) · Never Miss a Beat 00:33:03:00. First ~10 min of the
  show is the event opening; walk-off music ≈ 00:38:40.
- **Epsonics** (set 2): Severance Main Title Theme 00:49:41:06 (RECORDED intro — not on the
  desk stems) · No One Knows 00:51:04:11 · It's My Life 00:56:03:11 · Uptown Funk 01:00:27:11 ·
  Electric Feel 01:05:30:11 · When You Were Young 01:09:50:11 · The Chain 01:14:45:01
  (last note 01:19:40). Vox 3 sings lead on No One Knows-slot song 2.
- **ShipRex** (set 3): Careless Whisper/Uprising 01:33:51:09 · Espresso 01:40:50:09 ·
  Dumb Things 01:44:32:09 · Everlong 01:48:40:09 (band 01:49:00:09) · Covered in Chrome
  01:54:23:09 (band 01:55:06:09).
- **Jumbo Band** (set 4): recorded intro theme 02:11:59 · Bring Me to Life 02:12:56:00 ·
  Beer 02:17:35:06 · Never Had So Much Fun 02:22:09:06 (genuinely ~90 s) · Chelsea Dagger
  02:24:07:06 · Say It Ain't So 02:28:42:06 · Take the Power Back 02:32:59:06; outro jam
  02:37:39 (50 s, not a song).
- **Total Loss** (set 5): Back in the U.S.S.R. 02:55:06:00 (count-in) · Gold on the Ceiling
  02:57:50:00 · Message in a Bottle 03:01:35:00 · We Can Get Together 03:06:49:00 ·
  Sultans of Swing 03:10:31:00 · Paint It Black 03:16:34:00; house music resumes 03:20:43.

Lessons that got us there:

- **Setlist count vs measured slots never matched at first** — every mismatch was explained by
  non-song audio: recorded walk-on tapes (Epsonics Severance, Jumbo theme), event opening
  (10 min before OTR), outro jams and house music. Always reconcile counts against the bottb
  DB setlist before mapping slots to songs.
- Level-based onset detection triggers ~1 min EARLY on this material (mic'd between-song
  banter over the PA reads as an onset). Fix that worked: bass(40–180 Hz)/mid(300–3k) power
  ratio per second, calibrated on a known song (median 0.44) vs known banter (0.06),
  threshold 0.19, sustained 6-of-8 s. Refined starts landed within a few seconds; Dean's ear
  did the last word.
- **Title-card pipeline**: `src/scripts/generate-song-overlays.ts` (new) renders the admin
  band-set "song overlays" headlessly — @napi-rs/canvas + a document.createElement('canvas')
  shim, Jost woff2 via GlobalFonts, setlists/logos from Postgres (.env.local). PNGs →
  5-s ProRes 4444 movs with fades BAKED IN ALPHA (ffmpeg fade=alpha=1: in 12f, out 22f),
  because clip fades are not settable via the Resolve API. Placement rule: card at
  first note +32 frames on V2. /Volumes/BOTTB/TitleCards/ holds the movs; PNGs in each
  band's 02_Production/<Band>/Overlays/.

## End card asset gotcha (2026-09-07)

`TitleCards/EndCard_2x.mov` (and EndCard.mov): the alpha channel is FULLY OPAQUE — the in/out fades are baked into RGB, not alpha (unlike the 30 song cards, whose ffmpeg fades used alpha=1). Any compositing must use **Additive blend** (white-on-black logo over picture), as on the timeline; a normal over-blend replaces the programme. Caught by Social Posting QC on The Chain full-length outro.

## API cannot enable group-graph nodes (2026-09-07, caught in release QC)

`ColorGroup.GetPreClipNodeGraph().SetNodeEnabled(i, True)` returns True for every node but has NO effect on the rendered output (verified: release flicker amplitude ≈ deflicker-bypassed measure render on CAM C; also suspicious that every group reported exactly 2 nodes). Treat group-graph SetNodeEnabled as a silent no-op. Deflicker bypass/enable is MANUAL ONLY (Open in Timeline → group Pre-Clip → Cmd-D), and any render that depends on Deflicker must be verified in the output (per-frame mean-luma residual on a known flicker range) before shipping.

## Render jobs bind to the multicam when its Open-in-Timeline view is active (2026-09-07, caught by Dean)

While a multicam's Open in Timeline view is open, `AddRenderJob` binds the job to "BOTTB Multicam" even though `GetCurrentTimeline()` still REPORTS the master timeline — the name assert passes on bad data. Detection: every entry in `GetRenderJobList()` carries a truthful `TimelineName` field. Rule: after queueing, verify `TimelineName == "BOTTB Brisbane 2026"` on every job BEFORE `StartRendering`; abort and fix the UI context (switch timeline away/back + OpenPage("edit")) if not.

## Render QC: check the AUDIO STREAM, not the container (2026-09-07)

A Resolve render completed (JobStatus Complete, video 7475 frames, correct container duration) with the AAC stream ending 56 s early (243.3 s of 299.0). Window-sampled correlation QC passed because the sampled window preceded the dropout. Mandatory render QC since: (1) ffprobe audio stream duration must match video duration within 0.2 s; (2) decode the last 5 s of audio and require nonzero samples (volumedetect); (3) the existing checks (flicker metric where relevant, content NCC, windowed audio correlation, bitrate, JobStatus).

## Audio placement caveats from logic-cli TC re-check (2026-09-09; corrected same day)

- Anchors must NEVER be transferred between sets: the rebuilt picture reference's OTR region sits ~1.30 s off its Epsonics region. Cross-set alignment searches need a ≥ ±5 s window before "no result" means anything.
- Intra-set discontinuities initially reported for Total Loss (97 ms) and OTR (~40 ms) were RETRACTED — measurement artefacts from wide-window probes. Both sets are continuous: one anchor per band is fine. Total Loss drifts smoothly ~4 ppm, every song within ~3 ms of anchor 02:44:28:17; OTR anchor −5.125 s confirmed to 3 ms.
- All Dean-confirmed song starts were measured locally per song and stand.
