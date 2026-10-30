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

**Halation, with numbers (2026-09-14).** "Small" is: **Enable Halation on, Highlights Only on,
Amount 0.250, Radius 4.00, Saturation 1.000, Hue 0.500** — what The Chain and Bring Me to Life
were delivered with. Two things pin it there:

- **It is one node over the whole 3 h 39 m.** `Timeline.GetNodeGraph()` node 1 is the timeline
  grade; there is no per-song FLC. Any halation change re-grades two published songs, so the
  bar for moving it is "the show was wrong", not "this song would prefer it".
- **Hazy does not mean more halation here.** The intuition is that a bright, smoky song blooms
  harder, and the measurement says the opposite. Duration-weighted frame fraction above luma
  0.75 / 0.85 / 0.95, post-grade: Bring Me to Life **6.59 / 3.94 / 2.26 %**, Sultans of Swing
  **4.92 / 2.85 / 1.39 %** — 0.75× to 0.62× the area. The haze _offset_ pulls the wash down,
  and with it the shoulder that "Highlights Only" acts on. Same Amount reads lighter on the
  hazier song, not heavier.

Why light at all, on this footage: real smoke already scatters the spots optically, so halation
is re-doing in software what the room did — and it puts light back into exactly the floor the
haze Offset just pulled from ~0.10 to ~0.02. **Highlights Only must stay on**: without it the
effect lands on hazy midtones, which is the whole problem. If a halo ever reads as coloured
smear on the magenta/blue gels, that is the source colour bleeding — drop Saturation toward
0.85, do not touch Hue (0.5 is the red/orange end, which is what film halation physically is).
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

## ~~API cannot enable group-graph nodes~~ — FIXED IN 21.1 (2026-09-07, retested 2026-09-11)

**Superseded. On 21.1 `SetNodeEnabled` on a group graph WORKS.** Verified by setting CAM A's
pre-clip node 2 ("Deflicker", `OFX: Deflicker`) to enabled and having Dean confirm the flip in the
UI, then restoring it to bypassed. So Deflicker bypass-while-cutting and enable-at-finish are now
scriptable across all four groups in one call.

The whole group-graph introspection layer looks fixed, not just this call: `GetNumNodes` now
returns real, differing counts (CAM A pre 2, CAM B/C pre 3 — not the "exactly 2 everywhere" that
was the giveaway in 21.0.4), and **`GetToolsInNode` returns the actual contents** — e.g. CAM B
pre-clip is `["Primary Balance"]`, `["OFX: Deflicker"]`, `["OFX: Noise Reduction", "Power
Windows"]`. Grade structure can now be audited programmatically, which is worth doing in release
QC.

**Still true, and still the trap:** there is **no `GetNodeEnabled`**. You can set state, you can
never read it back. So: set it explicitly before every render rather than assuming, and never
toggle a node whose original state you did not record — you cannot restore what you cannot read.

Original 21.0.4 finding, kept for context: `SetNodeEnabled(i, True)` returned True for every node
but had no effect on rendered output (release flicker amplitude ≈ deflicker-bypassed measure
render on CAM C).

**Method note.** The first attempt to retest this used `GetCurrentClipThumbnailImage` to compare
pixels before and after the toggle. It showed no change and looked like a clean confirmation of
the no-op — it was wrong. **`GetCurrentClipThumbnailImage` returns a per-clip poster frame, not
the current frame**: moving the playhead a full second within one clip gives a byte-identical
image, while moving between clips gives different ones. It cannot detect a grade change on the
same clip and is useless for this kind of verification. Use `GrabStill` + `ExportStills`, a
measure render, or a human looking at the node graph.

## Render jobs bind to the multicam when its Open-in-Timeline view is active (2026-09-07, caught by Dean)

While a multicam's Open in Timeline view is open, `AddRenderJob` binds the job to "BOTTB Multicam" even though `GetCurrentTimeline()` still REPORTS the master timeline — the name assert passes on bad data. Detection: every entry in `GetRenderJobList()` carries a truthful `TimelineName` field. Rule: after queueing, verify `TimelineName == "BOTTB Brisbane 2026"` on every job BEFORE `StartRendering`; abort and fix the UI context (switch timeline away/back + OpenPage("edit")) if not.

## Render QC: check the AUDIO STREAM, not the container (2026-09-07)

A Resolve render completed (JobStatus Complete, video 7475 frames, correct container duration) with the AAC stream ending 56 s early (243.3 s of 299.0). Window-sampled correlation QC passed because the sampled window preceded the dropout. Mandatory render QC since: (1) ffprobe audio stream duration must match video duration within 0.2 s; (2) decode the last 5 s of audio and require nonzero samples (volumedetect); (3) the existing checks (flicker metric where relevant, content NCC, windowed audio correlation, bitrate, JobStatus).

## Audio placement caveats from logic-cli TC re-check (2026-09-09; corrected same day)

- Anchors must NEVER be transferred between sets: the rebuilt picture reference's OTR region sits ~1.30 s off its Epsonics region. Cross-set alignment searches need a ≥ ±5 s window before "no result" means anything.
- Intra-set discontinuities initially reported for Total Loss (97 ms) and OTR (~40 ms) were RETRACTED — measurement artefacts from wide-window probes. Both sets are continuous: one anchor per band is fine. Total Loss drifts smoothly ~4 ppm, every song within ~3 ms of anchor 02:44:28:17; OTR anchor −5.125 s confirmed to 3 ms.
- All Dean-confirmed song starts were measured locally per song and stand.

## Resolve 21.1 + the Blackmagic MCP server (2026-09-11)

Resolve Studio **21.1** ships its own MCP server — this is first-party Blackmagic, not a
community bridge. Two pieces inside the app bundle:

- `Contents/Applications/ResolveMCP` — the real server, speaks MCP over stdio.
- `Contents/Resources/DaVinciResolve.mcpb` — a Claude Desktop extension that is only a thin
  node wrapper around that binary (lazy-spawns it, kills it after 5 min idle).

For Claude Code, register the binary directly — the wrapper buys nothing here:

```bash
claude mcp add --scope user davinci-resolve \
  "/Applications/DaVinci Resolve/DaVinci Resolve.app/Contents/Applications/ResolveMCP"
```

14 tools: `run_script` / `run_script_unsafe` (sandboxed Python 3.14 with `resolve` and
`project` pre-injected; the plain one blocks `os`/`sys`/`pathlib`/network/subprocess, the
unsafe one is the one to use for ffmpeg or reading media), `get_scripting_api` /
`search_scripting_api` / `get_scripting_docs` / `get_whats_new` (the server serves the 21.1
`.pyi` stubs and docs itself, so no more guessing at API names), `launch_resolve`,
`get_resolve_status`, plus LUT/DCTL authoring (`update_dctl` compiles before writing,
`generate_lut` evaluates a Python transform over the lattice) writing into `…/LUT/MCP/`.

This replaces the `RESOLVE_SCRIPT_API` / `RESOLVE_SCRIPT_LIB` / `PYTHONPATH` bootstrap in
`scripts/TOOLBOX.md` for interactive work. Studio only; _External scripting using_ must still
be Local (`System.Scripting.Mode = 1` in `Preferences/…/config.dat`).

**Gotcha that cost the setup 20 minutes:** installing 21.1 while 21.0.4 is _running_ leaves the
old process up, and the 21.1 `ResolveMCP` binary then **hangs** on the init handshake rather
than reporting a mismatch — Claude Code just times out at 30 s. `--dump-tools` still works
(it never connects), which makes it look healthy. Check the running build in
`logs/davinci_resolve.log` (`DVIP release/…`), not the version on disk; relaunch Resolve.

### 21.1 API additions that retire workarounds documented above

- **Multicam is scriptable at last**: `MediaPool.CreateMulticamClip`,
  `TimelineItem.FlattenMulticam`, `PerformMulticamSmartSwitch`, `Timeline.AutoAlignClips`.
  The "Can't: create or switch multicams" line above is now false for 21.1. (The measured
  cross-correlation sync is still the right call on this material — Resolve's own sound sync
  is what dropped 12 of 33 clips — but the _build_ no longer needs the 4-track-timeline →
  _Convert Timelines to Multicam Clips_ dance.)
- **`TimelineItem.SetFades({FadeIn, FadeOut})`** — clip fades ARE settable now. The title-card
  pipeline's baked-in-alpha fades (ffmpeg `fade=alpha=1`) were a workaround for this and are
  no longer necessary for new cards (corrected 2026-10-29: settable, but API-set fades read 0 after a reopen on Black Parade
  2026-10-19 and on the V2 medley master 2026-10-29, so a fade set by API is not proven to persist; baked alpha fades can't be
  lost, which is why the Sydney 2026 cards stay movies). Note this does NOT retroactively fix
  `EndCard_2x.mov`, whose fades are baked into RGB (still needs Additive blend).
- `TimelineItem.AddTransition`, `Get/SetProperty` for native audio properties and enabled
  states, `Timeline.NormalizeAudioLevel`, `MediaPoolItem.GetTranscription`,
  `MediaPoolItem.SetAudioMapping`, project-settings / render / keyboard presets.
- Still unverified against 21.1 and assumed to still bite until retested: group-graph
  `SetNodeEnabled` being a silent no-op, render jobs binding to an open multicam view, and
  Dynamic Zoom being invisible to `ZoomX/ZoomY`.

## The 21.1 multicam flow moved — and has a gate (2026-09-11)

Two changes broke the 21.0 muscle memory:

1. **`Timeline > Multicam Editing` must be enabled first.** It is a toggle in the Timeline
   menu and it is OFF by default. Until it is on, the Multicam Viewer is simply absent from
   the UI — no error, no greyed-out control, nothing to click. This is the actual gate, and
   it is **not in the manual anywhere** (grep of the 21.1 manual finds no mention of the menu
   item; chapter 49 never refers to it).
2. **The Multicam Viewer is now a 2×2 grid button on the _Timeline_ viewer** (bottom-left,
   just right of the Transform-mode dropdown), not an entry in the Source Viewer mode
   dropdown. In 21.1 that dropdown reads Source / Offline / Audio Track / Annotations /
   **Immersive** — "Multicam" is gone from it and Apple Immersive Video took the slot.

Chapter 49 of the 21.1 manual is stale on both counts: it still says "Choose Multicam Mode at
the bottom of the source viewer". The only hint in the whole document is one line in the
keyboard-shortcut section — "These work in both the source viewer and the Multicam Mode in the
timeline viewer". Don't trust the manual's multicam UI prose on 21.1; trust the menu.

Routes that work regardless of any of the above, and are worth preferring for one-off angle
fixes: right-click a timeline clip → **Switch Multicam Clip Angle**; `Edit > Multicam`
submenu; Cmd-Shift-Left/Right for previous/next angle; 1–9 to cut-and-switch, Option-1–9 to
switch without adding a cut.

Note for this project specifically: only 1141 of the 1329 V1 items are still genuine multicam
items. The other 186 are the Render-in-Place ProRes clips, and they will never offer multicam
switching — that is expected, not a symptom.

## Multicam SmartSwitch evaluated — not for bands (2026-09-11)

Resolve 21.1's AI Multicam SmartSwitch was tested on a 4:35 pilot (Jumbo / Chelsea Dagger). It
cuts for **active speaker and lip movement**, so on a band it lives wherever the singer's mouth
is: 46% CAM B, 13% CAM C, **2% CAM D** against Dean's wide-led 52% CAM D — and it used the two
static side cameras that Dean did not use at all in that song. Not a tuning problem; the
objective is different. Also: `switchOnVideoOnly` is rejected on a source-audio multicam,
`run_script` times out at 10 s while the analysis keeps running, and analysis ran at 5 fps
(~20 min for 4:35, so ~2 h for the Jumbo set, ~16 h for the show).

Proxies do **not** accelerate analysis — proxy handling is documented purely as a playback
optimisation, with no link to analysis anywhere in the manual.

Full write-up, plus the feasibility study for a music-aware assisted rough cut and the
literature, is in `auto-cut-feasibility.md`.

## Playbook audit against the 21.1 API (2026-09-11)

Re-tested the "Can't" list above against the live 21.1 API rather than the changelog.

| Was "can't"                                   | 21.1                                                                                                                                                                                                         |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Create / switch multicams                     | **Now possible** — `CreateMulticamClip`, `FlattenMulticam`, `PerformMulticamSmartSwitch`, `AutoAlignClips`                                                                                                   |
| See inside a multicam                         | Still no timeline object, but group graphs are now introspectable (above)                                                                                                                                    |
| **Add colour nodes**                          | **Still not possible** — `Graph` has no `AddNode` of any kind                                                                                                                                                |
| **Add OpenFX (Deflicker, Film Look Creator)** | **Still not possible.** `InsertOFXGeneratorIntoTimeline` inserts a generator _clip_, not an effect on a node. Fusion comps are scriptable (`AddFusionComp`) but that is the Fusion page, not Colour-page OFX |
| Generate proxies / optimized media            | Still can't trigger generation — but `LinkProxyMedia` / `UnlinkProxyMedia` / `LinkFullResolutionMedia` let you attach externally generated proxies (Blackmagic Proxy Generator or ffmpeg, then Link)         |
| Set proxy format / location                   | **Partly** — `perfProxyMediaMode`, `perfProxyResolutionRatio`, `perfOptimisedCodec`, `perfOptimizedResolutionRatio` all read/write. Generation _location_ still not exposed                                  |
| Read node enable/bypass state                 | **Still not possible** — no `GetNodeEnabled`                                                                                                                                                                 |
| Select items in the UI                        | **Partly** — `MediaPool.SetSelectedClip` exists; still no setter for timeline items                                                                                                                          |
| Clip fades                                    | **Now possible** — `TimelineItem.SetFades({FadeIn, FadeOut})`                                                                                                                                                |
| Dynamic Zoom on/off                           | **Now possible** — `DynamicZoomEnabled`. Start/end rectangles still inaccessible, and there is no general sizing-keyframe API, so camera _moves_ remain manual                                               |
| Per-timeline resolution                       | **Possible** — `SetSetting("useCustomSettings","1")` + `timelineResolutionWidth/Height`, reverts cleanly. This is what makes scripted 9:16 reels work                                                        |

Also new and useful: `Timeline.GetSelectedClips`, `TimelineItem.GetType`, `AddTransition`,
`MediaPoolItem.GetTranscription`, `SetAudioMapping`, `Timeline.NormalizeAudioLevel`.

### Settings found drifted from the documented setup (2026-09-11)

- **`perfCacheClipsLocation` = `/Users/deapovey/Movies/CacheClip`** — back on the **boot disk**,
  not the Extreme SSD as this document describes. Boot volume was at 21 GB free when found. This
  is the configuration behind the 2.6 GB-free incident.
- **`perfOptimisedMediaOn` = 1, `perfOptimisedCodec` = `apch` (ProRes 422 HQ),
  `perfOptimizedResolutionRatio` = `auto`** — exactly the combination this document says never to
  use. The setting is on; whether media has actually been generated is not visible from the API.

Both are now scriptable, so they can be asserted before any cache/generate job rather than
checked by memory.

## `StartRendering()` with no arguments starts EVERYONE'S jobs (2026-09-12, caught by Dean)

`Project.StartRendering()` with no arguments starts **every pending job in the render queue**,
not just the one you queued. Always pass the job id: `StartRendering([jid])`.

Cost of learning this: it kicked off `BOTTB_Epsonics_TheChain_4K_YT.mp4`, a queued YouTube
deliverable nobody had asked to run. Stopped at 62%, leaving a truncated 187.6 s file where
298.96 s was expected, at the deliverable path, **overwriting** what was there. The render queue
on this project is used as a to-do list, so other people's Ready jobs are routinely sitting in
it — this will happen again to anyone who forgets.

**The existing rule is not sufficient.** Verifying `TimelineName` on your own job guards against
the open-multicam binding bug (above); it says nothing about what else is in the queue. Both
checks are needed:

1. `GetRenderJobList()` → refuse to start if there are **`Ready` jobs that are not yours**,
   or pass only your own job id.
2. `TimelineName` correct on your job.
3. After any cancel, treat the output as poisoned: `JobStatus == Complete` **and** expected
   duration **and** the audio-stream checks before anything consumes it. Delete truncated
   output rather than leaving it at a deliverable path.

Note also that `StopRendering()` marks _all_ jobs `Cancelled`, including ones that had previously
reported `Complete` — job status after a stop is not a reliable record of what actually
succeeded. Check the files on disk (`ffprobe` duration) instead.

## Jumbo audio anchor + BMTL placement (2026-09-12; plateau theory retracted same day)

Jumbo multitrack file-start = show TC **02:02:49:06** (7369.229 s) against the rebuilt picture-true reference. The reported ~19 ms two-plateau step within the set was RETRACTED (wide-window near-tie measurement, marked unproven by the 2026-09-09 mix-build correction) — do not use it to predict per-song offsets.
What stands empirically: BMTL's delivered mix needed **+56.5 ms** vs the naive mapping (picture-verified); the corrected file `Jumbo - Bring Me to Life_v2.wav` places at **show 7979.320 s = 02:12:59:08 = frame 199483**, verified to +0.12 ms mean residual. Rule for the rest of the set: **every Jumbo song mix gets its own picture check on delivery** (120 s probes, ±15 ms window, judge by cross-probe consistency) — no predicted anchors. Working: 03_Delivery/Jumbo/DELIVERY-NOTES.md.

## Timeline node graph is scriptable in 21.1 — measurement renders are now automatic (2026-09-12)

`Timeline.GetNodeGraph()` returns the timeline-level graph and `SetNodeEnabled` works on it.
On this project node 1 is `["OFX: Film Look Creator", "Primary Balance"]` and node 2 is the
black anchor `["Primary Balance"]`. So the cut-recipe measurement render's setup — bypass the
look and the black anchor, keep Group Pre-Clip — no longer needs a human.

Verified on pixels rather than on the return value: bypassing changed **97.9 % of pixels**
(mean |Δ| 9.7/255, R +9.3 / G −3.4 — the FLC's shaping), and restoring afterwards reproduced the
same frame **byte-identically** (mean |Δ| 0.0000, max 0). Given `SetNodeEnabled` returned `True`
while doing nothing in 21.0.4, and there is still **no `GetNodeEnabled`**, the rule stands:
**set state explicitly, verify on a grabbed still, and never toggle a node whose original state
you did not record.** Dean confirmed "FLC enabled as is the primary balance" before the run;
without that there would have been nothing to restore to.

Measurement render timing, for planning: **291.76 s of 1080p H.264 took 47 seconds** with the
look bypassed. A deliverable of the same length takes ~25 minutes — the Film Look Creator is the
expensive part. Do not budget one from the other (I predicted 20–25 min and was out by 30×).

Related gotchas found the same day, both in `../../../gigstills/docs/cut-recipe.md`:
`GetSourceStartFrame()` returns the timeline frame on multicam items (so `source_clip` cannot be
derived), and gigstills' `_is_transition()` silently drops any row whose `media_type` and
`source_clip` are both null.

## Render in Place and Super Scale on 21.1 (2026-09-13, Jumbo / Bring Me to Life)

### A requested `VideoQuality` silently did not take (cause NOT yet proven)

Asked for `"VideoQuality": 120000` (120 Mb/s) on a 4K H.264 job; the file came out at
**46.7 Mb/s**. No error, no warning, and the job dict exposes no quality field to read back.

**Leading hypothesis, UNVERIFIED:** the settings were applied and _then_
`SetCurrentRenderFormatAndCodec` was called, and changing the codec resets codec-specific
quality parameters — which would make the fix "codec first, then settings". Plausible, since
the Deliver page UI resets its quality controls when the codec changes, but it has **not been
tested**. Other explanations are open: the key may be ignored for this format, clamped to an
encoder ceiling, or need a companion rate-control field. Queue a 100-frame render each way
and compare the achieved `bit_rate` before trusting either.

This is the mirror of the 2026-09-05 units bug (asked 120, got 506 Mb/s). Different causes,
same symptom: a file that looks finished and is nowhere near the requested rate.
**Always `ffprobe` the achieved `bit_rate`; never trust the setting.** 46.7 Mb/s happened to
be a fine delivery rate (YouTube recommends 35–45 for 4K25) so this one was kept, but it was
luck, not intent.

Also: `MarkOut` is inclusive, so the render carries **one frame more** than `out - in`
(5768 requested, 5769 delivered). Consistent across every job; QC on `out - in + 1`.

### Render in Place is not scriptable at all

There is no Render in Place API in 21.1 — nothing exposes it. It is UI-only, so the scripted
part of the workflow ends at _marking_ the clips and resumes afterwards.

### Super Scale: multicam no, source clips yes, and pass an int

- `SetClipProperty("Super Scale", 2)` on the **multicam** pool item returns `False` and does
  nothing. Confirmed by test on 21.1, not inherited from the old note.
- On a **camera source clip** it works — but only with an **integer**. `"2"` as a string
  returns `False` and silently leaves the value alone.
- So the workflow is: find the source clips feeding the set, set Super Scale on those, do the
  RiP, set them back to 1. The four clips feeding Jumbo (set 4) are
  `C5697.MP4` (CAM A), `20260827_C8820.MP4` (CAM B),
  `kurtA7S320260827_4164.MP4` (CAM C), `C3781.MP4` (CAM D) — found by querying
  `Sm2TiItem` in `Project.db` for `.MP4` names whose Start/Duration span the song. That query
  is the reliable way to map show time to source clip; the item names on the timeline only
  give the angle.

### Detector rule, corrected

Use **`DynamicZoomEnabled`** (new in 21.1) rather than inferring from `DynamicZoomEase != 0`.
On this song **all 22** zoomed cuts were Dynamic Zoom with `ZoomX` 1.0 — a static-zoom
detector finds none of them. Rule: `DynamicZoomEnabled == True OR ZoomX >= 1.3`.

Clip colours: the documented orange/red convention was never actually used. Beige and Navy
are the gigstills shot recommendations. **Orange** is now the Render-in-Place marker; there is
no way to split 1.3–2.4× from ≥2.5× on a dynamic zoom, because the API cannot read the DZ
rectangles, so everything gets one colour.

### RiP'd clips leave the colour group — check before you rely on a group change

After Render in Place the clip is a plain `Video` item and **group changes no longer reach
it**. Measured, with a control: toggling every CAM C group pre-clip node changed **0.000** on
a RiP'd clip and **7.593 mean / 88.6 % of pixels** on a multicam one in the same song.

### What RiP freezes and what stays live — the full picture (2026-09-14)

The note above is right but only covers one layer, and the question "do the colour nodes still
apply?" needs all four. Measured on a RiP'd Bring Me to Life clip (`CAM C Render 53.mov` at
02:13:43:05), each toggled and restored byte-identically:

| layer                                                        | after Render in Place          | evidence                                                                           |
| ------------------------------------------------------------ | ------------------------------ | ---------------------------------------------------------------------------------- |
| source, edit-page zoom/transform, Super Scale                | **baked**                      | the point of the exercise                                                          |
| group pre-clip — camera correction, Deflicker, NR            | **baked, no longer reachable** | 0.000 change vs 7.593 / 88.6 % on a multicam control                               |
| **clip node 1 — the gigstills CDLs**                         | **still live**                 | identity vs applied: 5.692 mean, **96.0 %** of pixels; black floor 0.0006 → 0.0065 |
| timeline node — Film Look Creator (+ halation), black anchor | **still live**                 | bypass: 11.544 mean, **98.7 %** of pixels                                          |

So RiP bakes everything _upstream of the clip grade_ and leaves the clip node and everything
downstream running on the baked result. The CDLs are applied **once**, not twice — the
double-application worry is unfounded, and it was worth testing rather than assuming, because
nothing can read a CDL back to check afterwards.

The practical consequence is unchanged and is the reason for the ordering: Deflicker and
Temporal NR live in the group pre-clip, so they must be **on before the RiP** or they are lost
for good. Grades, the look and halation can still be changed afterwards.

**Grabbing stills to verify: allow ~4-6 s after moving the playhead.** At 1.5 s the grab
returned the _previous_ playhead position — a still from a different song entirely — which read
as "the timeline node does not reach RiP'd clips" until the frame was actually looked at. A
comparison against a stale grab is worse than no comparison: it produces a confident wrong
answer. Always sanity-check that the frame is the shot you think it is.

So whatever was live at RiP time is baked in permanently. **Enable Deflicker and Temporal NR
_before_ the RiP pass, not after** — on this song CAM A's Deflicker was bypassed when the RiP
ran, so one of the 22 clips is baked without it. (`GetColorGroup()` is no help: it returns
`None` for multicam items too, so it cannot distinguish "left the group" from "never visible".)

### Check timeline resolution equals delivery resolution before any RiP

Render in Place bakes at **timeline** resolution. Lowering the timeline resolution to grade
faster is a documented trick in this very file — do that, forget it, and the RiP writes
1080 media into a 4K delivery and throws away the Super Scale with it. Verify
`timelineResolutionWidth/Height` against the delivery spec first. It was 3840×2160 on this
pass, matching delivery, so nothing was lost.

### Editing-mode policy: bypass the expensive nodes, keep the look (Dean, 2026-09-13)

When handing the timeline back for cutting, bypass **only** the genuinely expensive nodes and
leave the look running:

| bypass while editing              | leave ON                              |
| --------------------------------- | ------------------------------------- |
| CAM A Deflicker                   | timeline **Film Look Creator**        |
| CAM B Deflicker + Noise Reduction | timeline black-anchor Primary Balance |
| CAM C Deflicker + Noise Reduction | all group node 1 camera corrections   |
| CAM D Noise Reduction             |                                       |

Film Look Creator is cheap enough on this machine — the earlier note pairing it with Deflicker
as a thing to bypass while cutting is wrong, and it costs the editor the actual look for
nothing. Temporal NR and Deflicker are the expensive ones.

**Halation is the fifth switch, and it is MANUAL** (Dean, 2026-09-14). It is a checkbox inside
the Film Look Creator OFX, not a node, and **there is no OFX-parameter API** — the whole
scripting surface for OFX is `InsertOFXGeneratorIntoTimeline`, which inserts a generator clip.
Searching the 21.1 API for `Halation` returns nothing. So it cannot be scripted, will not
appear in any node-toggle result, and has to be done by hand in the FLC panel:

- **Pre-render:** tick **Enable Halation** (settings: Highlights Only on, Amount 0.250,
  Radius 4.00, Saturation 1.000, Hue 0.500).
- **Post-render:** untick it before handing the timeline back for cutting.

Because there is no `GetNodeEnabled` **and** no parameter read-back, nothing can verify this
one from the outside — not even on a grabbed still, since at Amount 0.250 on this footage the
difference is inside H.264 noise on most frames. It is a checklist item, and the only defence
is doing it in a fixed order every time.

**Before any render, all of the above go back ON.** There is still no `GetNodeEnabled`, so
nothing can read the state back — it has to be set explicitly and verified on a grabbed still.
The seven nodes are: timeline Film Look Creator; CAM A Deflicker; CAM B Deflicker + NR;
CAM C Deflicker + NR; CAM D NR.

One gotcha found doing this: **CAM A's Deflicker node also carries a Primary Offset**
(`GetToolsInNode` returns `["OFX: Deflicker", "Primary Offset"]`), so bypassing it drops that
correction too and CAM A will not look graded-correct while cutting. Harmless for editing,
confusing if unexpected.

## Per-song delivery gotchas found on Bring Me to Life (2026-09-13)

Three things that cost time on the first Jumbo song and will recur on the other five.

**`endcard-treat.sh` was hardcoded to The Chain.** `EXPECT=299.0`, `FADE_START=295.152` and
decoded-audio probes at t=240/280/295 — every one of those past the end of a 230 s song, so it
refused to run at all. Now derives the fade from the card's own measured duration and scales
the probes to the song (0.80 / 0.94 / 0.985 of length); `--expect` is optional, and omitting it
drops to an audio-vs-video check which the script says out loud. Usage:

```
endcard-treat.sh <src.mp4> <out.mp4> [--4k] [--expect S] [--fade-start S] [--fade-dur S]
```

**zsh does not word-split an unquoted scalar.** `for t in $PROBES` iterated _once_ over the
whole string, and the script reported **"no audio decoded — silent tail" on a perfectly good
master**. The fix is an array (`PROBES=(...)`, `for t in "${PROBES[@]}"`). Worth knowing
because the failure mode points at Resolve when the bug is in the QC script: **if a
tail/silence check fails on a file you have reason to trust, check the checker first.** Failing
closed was right; failing closed for the wrong reason costs an afternoon in the wrong app.

**YouTube caps thumbnails at 2 MB.** A 2.71 MB PNG is rejected on upload. JPEG q92 at
1920×1080 came out at 0.36 MB with no visible artefacts on logo or type. Export thumbnails as
JPEG, not PNG.

**Card placement that worked:** start at `video_length − card_duration` so the card's last
frame lands exactly on the last frame of picture. On this song that put it 2.1 s after the
music stops, sitting over the crowd tail — which is why the render out-point is chosen to leave
a few seconds of tail after the last note rather than cutting on it.

## Reference-audio ground truth (bottb-91, 2026-09-13)

- BOTTB_reference_48k.wav is built from the Zoom H6essential recording, whose TrLR content is (2026-09-14 re-verified, bottb-91 retraction) very likely a DESK FEED recorded onto the Zoom — not a room capture; '21 Room'/LineL/R is the actual room pair (~21 m, arriving +61.2 ms LATE vs close mics). The Zoom clock runs ~6.89–6.92 ppm vs the desk USB clock; stems-vs-reference measures ~2.84 ppm because the reference is partly drift-corrected. Always name the clock pair with any ppm figure.
- The picture-true reference is SPLICED between band regions (e.g. ~1.30 s step OTR→Epsonics) but continuous within a set. Never fit drift across a set boundary (it models the step as a bogus slope, e.g. −26.71 ppm for Total Loss vs the true 6.8935); drift/continuity → measure against the raw Zoom take, picture-true TC → measure against the reference, locally, inside the band's own region.

## Sultans of Swing grade handover (2026-09-13)

Second song through the 21.1 scripted handover, and the first with any cast in it.
Song range **03:10:31:00 → 03:16:34:00**; snapping to whole items gives record
**285735–295012** (9277 frames, 371.1 s, 93 cuts, no transitions, all four angles).

Sequence, all scripted, no human in Resolve:

1. `ClearClipColor()` on the 33 **Beige** gigstills shot-recommendation clips in range
   (the cut is made; the recommendations have done their job).
2. `GetNodeGraph().SetNodeEnabled(1|2, False)` — Film Look Creator and the black anchor —
   verified on pixels (99.92% changed, mean |Δ| 17.6).
3. 1080p H.264 measurement render, **~2 min** for 371 s.
4. Restore both nodes, verified **byte-identical** to the pre-bypass still (mean |Δ| 0.0000).
5. `gigstills cut-recipe` → 69 non-identity CDLs → `SetCDL` in three batches, 69/69 `True`.
6. Verified on Resolve's own pixels: three of the largest haze offsets read back black floors
   **0.018 / 0.021 / 0.015** against measured-before 0.095 / 0.106 / 0.103.

**The one that nearly went wrong.** 33 of the 93 cuts carry a cast remedy — Bring Me to Life
had none, so the first song never tested it. gigstills marks a cast `report`, never `apply`
("a gel is lighting"), **but the composed `item["cdl"]` still carries its Gain**. Applying
`set_cdl` verbatim — exactly what worked on Bring Me to Life — would have pushed R down and G
up on a third of the song: blue stage to teal, magenta wash to grey-green, sallow skin. Caught
by building the before/after montage instead of trusting the numbers. Re-ran with
`cut.correct_cast: false`, now the show default in `runs_bottb_config.json`.

Song-specific config lives in `gigstills/runs_bottb_sultans_config.json`
(`haze_contrast_k: 1.0` — Dean's call, this being the haziest song measured: `haze` on 64 of
93 cuts, `flat` on 61).

**Re-graded 2026-09-15 after Dean watched the preview**, and both of his notes were real
defects rather than taste:

- _"Lots of the shots are very hazy and washed out."_ `haze_cap` was pinning **55 of the 64
  hazed cuts (86%)** at 0.05, having removed 0.05 of a median 0.086 neutral pedestal — so
  nearly half the wash was still on the picture by construction. Raised to **0.10** for this
  song: black floor 0.0198 → 0.0091, and **clipping did not move** (0.110 either way), an
  Offset only lowering. Rationale in `gigstills/docs/cut-recipe.md`.
- _"The guitarist in the solo was way too dark."_ That cut had an **identity CDL**.
  `G27:1618`, CAM A, 03:15:29:14, **13 s** — the longest shot of the outro solo. The recipe's
  rules fire on the _lighting state_, and G27 pools that close-up with six CAM D wides of a
  dark stage: weighted the group reads 0.520 against a 0.498 dark band, so nothing fired,
  while the cut measures 0.483 and the frame Dean saw measures 0.375. Hand-fixed with
  **Slope 1.15 / Power 0.85**; verified on a still grabbed back out of Resolve (subject 0.621,
  black floor still 0.0000). A second cut hidden the same way, `G26:1570`, took its recipe CDL
  plus Power 0.85 at **no** extra clipping.

Applied set is now **70** non-identity CDLs of 93. Note for the next song: a pure gain of 1.33
measured the same subject lift as gain 1.15 + gamma 0.85 but looked worse, because gain raises
the beam and the haze proportionally while gamma lifts shadows preferentially — the pipeline's
own "Gain to the bottom of normal, then Gamma for the remainder" rule, confirmed on pixels.

**Boundary note:** the last item in range runs to 295012, i.e. 162 frames (6.5 s) past Paint It
Black's first note at 294850. It is graded as part of Sultans. Check it when Paint It Black is
cut — it is that song's opening shot too.

## Plain-WAV 4 GiB ceiling (bottb-91 via deapovey-0a, 2026-09-14)

BOTTB_reference_48k.wav is plain RIFF at 3.52 GiB — 88% of RIFF's hard 4 GiB limit (32-bit chunk size; a filesystem-independent format ceiling, not exFAT). If the reference is ever regenerated longer, deeper, or with more channels it will silently truncate/corrupt: use RF64 or WAVE64 (or split) for any future rebuild. Same applies to any long multitrack bounce.

## Sultans of Swing delivery (2026-09-14/15)

Render times, for planning: **4K 3840x2160 took 1306 s, 1080p 1920x1080 took 1259 s** — the same
359.28 s programme, within 4 % of each other. **Output resolution is not what costs the time**;
the Film Look Creator and the source decode are, and they are identical either way. Do not
budget the 1080p as a quick follow-up to the 4K, and do not read a slow-looking percentage as a
stall — I wrongly accused my own status polling of slowing the job, on nothing more than a
percentage that advances non-linearly. The finished numbers say otherwise.

Both masters: **8982 frames** by `-count_frames`, exactly `MarkOut - MarkIn + 1`
(285735-294716). Video 359.280 s / audio 359.360 s, a 0.080 s delta. 4K 46.6 Mb/s, 1080p
11.7 Mb/s, AAC 320 kb/s both. Integrated **-16.2 LUFS**, LRA 3.2, true peak -0.5 dBFS.

**`-v error` suppresses `volumedetect`'s output.** The tail probes reported "no audio decoded"
on _both_ good masters, because `volumedetect` prints its `max_volume:` summary at **info**
level and `-v error` throws it away. This is the second instance of the same shape in a week
(the first was zsh not word-splitting `$PROBES` in `endcard-treat.sh`), so it is now a rule:
**when a QC check fails on a file you have reason to trust, prove the checker works on a file
you know is good before you go looking in Resolve.** Use `-hide_banner -nostats` rather than
`-v error` whenever a filter's printed output _is_ the measurement, and grep the whole
`max_volume: N dB` string rather than taking the last whitespace field (which is `dB`).

**Loudness carried straight through from the bounce, and cannot be fixed downstream.** The
master measures -16.2 LUFS and the v3 bounce measures -16.3 on its own, so the timeline applies
no gain. Bring Me to Life shipped at -13.6, so there is a 2.6 LU step down between two songs on
the same channel.

The end-card pass re-encodes audio anyway (it applies a fade and writes AAC 320k), so the
obvious thought is to correct the level there and skip a re-bounce. **It does not work.** Sample
peak and true peak are both **-0.5 dBFS**: linear gain buys **0.4 dB** before clipping, i.e.
-15.8 LUFS at the absolute best. Reaching -13 needs `loudnorm` or a limiter, which changes
dynamics rather than level — a mastering decision on a master whose LRA is already 3.2, not a
pipeline tweak. **A level target missed in the bounce has to be fixed in the bounce.** Check
integrated loudness on the bounce _before_ rendering 45 minutes of deliverables.

(Care with the LRA comparison: BMTL's 8.7 LU is measured across the whole master including its
quiet intro and crowd tail, as is Sultans' 3.2. Neither is a song-only figure. The level gap is
solid; the dynamics inference is softer.)

**Upload route (from the Social Posting session, 2026-09-14).** The Chrome extension's
`file_upload` tool is capped at 10 MB, which does _not_ rule out browser upload: the working
route is `doc/production/scripts/blob-upload.mjs` (run with the repo root as cwd) to get a
public Vercel Blob URL, then a `fetch()`-inject inside YouTube Studio, which pulls the bytes
itself and never touches the local filesystem. Carried 541 MB here, 1.69 GB on The Chain.
Budget a transient Chrome peak of **~2x the file size** — which is why the 2.1 GB 4K, at a
~4.2 GB peak, is a decision to put to Dean rather than just run.

## The `run_script` 10 s timeout can truncate a script mid-edit (2026-09-15)

**The dangerous one from this session.** The documented `run_script` limit is 10 seconds and
the script is _killed_, but the edits it already made **stand**. A verification script shaped
like this is therefore unsafe:

```python
grab_still("before")
item.SetCDL(IDENTITY);  time.sleep(4.0)      # <- change applied
grab_still("identity")
item.SetCDL(REAL);      time.sleep(4.0)      # <- NEVER REACHED
grab_still("after")
```

Two 4 s settles plus three `GrabStill`/`ExportStills` round-trips exceeded 10 s, so it died
**after** setting the clip to identity and **before** restoring it. The tool returned no
result at all, which reads as "the script failed" — but one clip on the timeline was now
ungraded, and a 45-minute render was about to start. It was caught only by listing which
stills the script had managed to write (`HZ_applied` and `HZ_identity` existed, `HZ_restored`
did not), which is what proved how far it had got.

**Rules:**

- **Never put a state change and its restore in the same `run_script` call.** One call per
  step, each well under 10 s. The restore must be its own call that cannot be pre-empted.
- A missing result means **"unknown state", never "nothing happened"** — go and find out how
  far it got before doing anything else.
- Keep the artefacts the script writes in a fixed order, so their presence reconstructs its
  progress. That is what saved this.
- Budget: a `GrabStill` + `ExportStills` pair costs roughly 1-2 s, and a playhead move needs
  4-6 s to settle. That is only two grabs per call.

## A comparison is only worth what its controls are worth (2026-09-15)

Re-checking the grade after reopening the project, I compared a frame at 03:12:00 against a
still of the same timecode from two days earlier and got a result pointing the **wrong way**
(black floor 0.047 -> 0.119, when a raised `haze_cap` must _lower_ it). Nothing was wrong: in
between, that clip had been Render-in-Placed, halation had been switched on, and the cap had
changed. Three variables, one number.

The controlled comparison — same session, one variable, taken minutes apart — said the
opposite and was right: the clip's own CDL toggled to identity and back moved the floor
**0.0911 -> 0.0000** over 99.3% of pixels, restoring byte-identically.

**Same timecode is not the same control.** Before trusting an A/B across time, list every
change between the two grabs. If there is more than one, the comparison is decoration.

## Re-bouncing over an identical region needs no re-sync (2026-09-15)

Sultans v4 (level fix only, same bars) cross-correlates **0 samples** against v3 at t=20, 180
and 330 s, and lands at the same -3 to -5 ms against the picture-true reference. So a
level-only re-bounce is a straight `MediaPoolItem.ReplaceClip` at the same timeline position.
**Still measure it**: it costs 30 seconds, and v2 -> v3 on this same song moved by 1181
samples (24.6 ms) because the bounce region _had_ changed without anyone saying so.

## Loudness passes through Resolve unchanged; true peak does not (2026-09-15)

v4 bounce **-13.7 LUFS / TP -1.0 dBFS** -> 4K master **-13.7 LUFS / TP -0.6 dBFS**. Integrated
loudness is untouched, so **the bounce is the only place to fix a level target** (see the
Sultans re-bounce). True peak rose 0.4 dB through the AAC encode — intersample peaks — so
leave at least 1 dB of headroom in the bounce or the delivered file can exceed 0 dBFS.

## Where Render-in-Place media actually lives — do not assume the cache (2026-09-15)

Clearing Resolve's clip cache is safe on this project, but **verify before deleting**, because
Resolve _can_ be configured to write Render in Place output into the cache folder.

- RiP media: `/Volumes/Extreme SSD/bottb/events/2026/Brisbane/02_Production/Battle of the
Bands Brisbane Full Show/Renders/` — 249 files, 56 GB.
- `~/Movies/DaVinci Resolve/CacheClip` held 8.7 GB, **7.2 GB of it audio waveform cache**, and
  no RiP media at all (checked for `*Render*` by name _and_ for anything modified recently,
  because a UUID-named file would not match the first test).
- `/Volumes/BOTTB/Renders/` also holds 13 `... Render N.mov` files, but they are from 30 August
  — an old RiP session. Counting those is what first made it look as though tonight's media
  had gone missing.

Clearing the cache took the boot disk from **22 GB to 118 GB free** (APFS released purgeable
space along with it). 22 GB was already under the 25 GB floor.

## Disk throughput, measured (2026-09-15)

Before moving the cache anywhere, measure it. `Supp1Tb` was assumed to be "a relatively slow
SSD"; it is an SSD (0.87 ms random 4K read — a spinning disk is 5-15 ms) but its **write path
is ~20 MB/s**, consistent over two runs.

| volume      | write        | read        | free   |
| ----------- | ------------ | ----------- | ------ |
| BOTTB       | 402 MB/s     | 509 MB/s    | 969 GB |
| Extreme SSD | 412 MB/s     | 645 MB/s    | 153 GB |
| **Supp1Tb** | **~20 MB/s** | 72-174 MB/s | 243 GB |

4K ProRes 422 HQ at 25 fps is ~110 MB/s **per stream**, and multicam playback pulls several at
once. So Supp1Tb would write cache at about a fifth of realtime and could not sustain even one
4K stream on read. **Cache belongs on BOTTB**; Supp1Tb is for archive and finished
deliverables only. (A 20 MB/s write on an SSD is low enough to suspect the enclosure or the
drive itself — worth checking.)

## Delivery render checklist — before the render, and back to editing after (2026-09-27, Everlong)

The two lists are mirror images: everything switched on to make the delivery correct is
expensive to play back, so it all comes off again afterwards. Written up after Everlong, the
seventh delivery through this pipeline, because the order was re-derived — and got wrong —
more than once.

### Before the render — ORDER MATTERS

1. **Deflicker + temporal NR ON**, on the group pre-clips. **Before** the Render in Place, not
   after: the group pre-clip is baked into a RiP and group changes never reach a RiP'd clip
   again (measured: 0.000 change). Enable after the RiP and those clips ship without them.
   CAM D's group carries NR only, no Deflicker — that is correct, not an omission.
2. **Mark the zoomed cuts** with clip colour **Orange**: `DynamicZoomEnabled OR ZoomX >= 1.3`.
   Resolve has no "Red" clip colour — `SetClipColor("Red")` returns success and does nothing.
   Read the colour back.
3. **Super Scale = 2 on the camera source clips**, as an **integer**, verified by read-back.
   Never on the multicam item: one `BOTTB Multicam` pool item backed 1616 cuts across the whole
   show on Everlong, so setting it there would Super Scale all of them. Setting it on every
   non-DJI camera `.MP4` avoids having to map show time to source file (each camera has its own
   clock) and is safe because Super Scale only acts during a RiP of a clip that uses it.
4. **Decompose any already-RiP'd cut that needs Super Scale** before re-RiPping it; decomposing
   clears its clip colour, so re-mark it, **and drops its clip grade, so re-apply the CDL** (NOK, 2026-10-06).
5. **Render in Place the orange cuts**: Include Video Effects **ON** (bakes Dynamic Zoom),
   colour grading **OFF** (the clip node and timeline node stay live on top of the bake — the
   CDLs apply once, not twice).
6. **Super Scale back to 1** on every source clip, verified by read-back. Left at 2, any later
   RiP anywhere in the show silently picks it up.
7. **Halation ON**, highlights only, threshold above the haze so the sources bloom and the air
   around them does not. It lives in the Film Look Creator on the timeline node, so it stays
   live through a RiP and can be set after.
8. **Timeline resolution = delivery resolution** (3840×2160) before any RiP — a RiP bakes at
   timeline resolution.

### Render

- Codec **first**, then settings. `VideoQuality` is in **Kb/s** (45000 = 45 Mb/s).
- **Do not pass `MarkIn`/`MarkOut` to `SetRenderSettings`** — it overwrites the timeline's
  In/Out marks. Set the range with `SetMarkInOut`, and record the release range in a Cyan
  `RELEASE:` marker whose duration spans In→Out, so it can be restored if anything clobbers it.
- Start only your job id; there were 28 completed jobs in the queue on Everlong.
- **Wait on `IsRenderingInProgress()`, not the file.** A file-size watcher declared the Everlong
  render stable at 99% while Resolve was still finalising.
- QC: frame count = `out − in + 1`; **audio stream** duration vs video within 0.2 s; last 5 s of
  audio non-zero; achieved bitrate by `ffprobe`.
  `scripts/render-qc.sh <mp4> <in> <out> [fps] [min_mbps]` runs all four (proved on the Everlong
  4K master, and fails a wrong range). Late mix: `scripts/splice-mix.sh`. Resolve state before and
  after: `scripts/resolve/state.py`. The editor role that uses these is the `live-video-editor`
  skill in `~/.claude/skills/`.

### After delivery — back to editing

1. **Halation OFF** (UI only — it is a Film Look Creator parameter; the API has no OFX
   parameter access and could only bypass the whole look node).
2. **Deflicker + temporal NR OFF** on the group pre-clips. The RiP'd clips have them baked, so
   this costs nothing until the next delivery — and they must go back on **before** the next RiP.
3. Super Scale is already 1 from step 6 above; re-check it.
4. **Put the final mix on the timeline audio track.** A late re-bounce spliced straight into the
   delivered files with ffmpeg (to save a render, and a codec generation) leaves the _timeline_
   on the old mix, so the next render off the timeline silently puts it back. Everlong shipped
   v14 while A11 still held v9 until this step caught it.
5. **Clear completed render jobs**, keeping anything not `Complete`.
6. **Reset the render custom name** to the timeline name (an empty `CustomName` is rejected).
   Otherwise the next render reuses the last delivery's filename.
7. Clear the song's clip colours.
8. **Close any multicam opened in the timeline before scripting.** With it open, the API
   addresses the multicam's internal timeline: reads return plausible but wrong values (A11 read
   _disabled_ when it was enabled) and every write is refused.

### Why the late-mix splice exists, and its cost

When the mix changes after the picture is final, splice the WAV onto the finished video with
`-c:v copy` and apply the end-card audio fade in the same pass. It saves a 20-minute 4K render,
and it saves a codec generation: `endcard-treat.sh` decodes the render's AAC and re-encodes it,
so a render-then-end-card chain is **two** AAC generations before YouTube adds a third. On
Everlong that took true peak from −1.2 (WAV) to −0.8 (render) to −0.5 dBTP (end card). One
generation straight from the WAV landed at −0.9. The video stream stays md5-identical to the
source, which is the check that nothing but the audio changed.

`endcard-treat.sh` prints "run: endcard-treat.sh --qc <file>" when it finishes, but it has no
`--qc` mode — `$1` is always parsed as the source. QC the output directly.

## Four more traps from the Everlong delivery (2026-09-27)

**Superseded mixes stay in the media pool.** Every audio swap imports the new bounce and leaves
the previous one in the pool at usage 0. Delete the bounce files and those items go offline.
On Everlong the pool held v4, v8, v9 and a renamed v2 alongside the live v14 when the bounces
were about to be cleared. Before deleting bounces: read the path the timeline clip actually
resolves to (`GetMediaPoolItem().GetClipProperty("File Path")`), then remove the usage-0 items
from the pool (`MediaPool.DeleteClips` removes pool items only, never files).

**`ExportStills` on `GetStills()[-1]` exported the wrong still — the same one, three times.**
Three grabs, the album count rising 48 → 49 → 50, and all three exports identical by md5 and
all named `..._1.1.3.png`, including a control grabbed from a different song entirely. The last
element of `GetStills()` is not the newest still. This is separate from the settle-time problem
above, and a comparison built on it is worse than none. Use a short render instead: it is the
only still-grab route here whose provenance can be checked.

**Playback blocks the scripting bridge; do not kill `ResolvePython` helpers to fix it.** With
the timeline playing, even `GetCurrentPage()` timed out. Each timed-out call left a
`ResolvePython … pylauncher` helper behind, which looked like the cause. Killing them by that
pattern also killed the live MCP bridge — it uses the same launcher — and the connection had to
be re-established with `/mcp`. The fix was stopping playback. A Resolve process sitting at ~40%
CPU with nothing scripted running is the tell.

**Correlation cannot tell close mix versions apart, and a vocal-free sync check cannot see the
vocal.** v8 against v9 measured r = 0.99954 against 0.99959: a thousandth-of-a-percent margin
between mixes that differ by 0.2 dB in two third-octaves. Residual energy after alignment and
gain-matching separated them only by 0.45 dB. For near-identical versions, the timeline's file
path is the evidence and the audio test is corroboration at best. Separately, the room-mic
correlation that confirmed each bounce's placement is vocal-free by design, so it is
structurally blind to a pitch-corrected vocal that has moved inside the mix. When Dean saw
drums in sync and vocals loose, that was the only check that could not have caught it.

## Pitchcurve bounces place themselves by BWF (2026-09-28, from the repitch session)

Every pitchcurve render and deliverable carries a verified BWF `time_reference`, derived from the
song's recorded Logic landmark (Everlong's is in pitchcurve `songs/everlong.json`). Import it into
Resolve with "use timecode from BWF" and it lands at its true position: no correlation needed. The
Everlong v4→v14 swaps were all placed by correlation. Use correlation only for bounces that did
not come through that path, and as a cross-check. The room-mic sync check is vocal-blind by
construction (the mic hears the PA, not the stem); only a vocal-stem ↔ bounce comparison sees
a resynthesised vocal move. The repitch session's gain-matched best-lag residual check is the
measure that separated v8 from v9 by 0.45 dB.

### ~~Pitchcurve bounces need no check~~ — CORRECTED 2026-09-29: check bext once with `align-mix`

mix-assist's `align-mix` (merged d13b539, `uv run mix-analyser align-mix`, manual in mix-assist
`doc/mixdown-tools.md`) placed the delivered Everlong v9 against
`/Volumes/BOTTB/Audio/BOTTB_reference_48k.wav` (`--ref-tc 00:00:00:00 --search-s 12000 --band
300 3000`) at 6541.341 s = **01:49:01:09**. The filename said :09; the file's bext
`time_reference` (313,991,040) said **:12, 3.5 frames late**. So a BWF stamp can be wrong: place by
bext, then confirm once with `align-mix`. Against the room/FOH reference use `--band 300 3000`
(the default band refused on Everlong) and read only `verdict_placed`; the residual there is ~0 dB
by nature. Bounce against bounce, `reading` separates same_mix from different_version at −30 dB:
v9 vs v14 read −7.0 dB where correlation (r 0.895) could not tell them apart.

## Later: move the editor tools out of bottb (noted 2026-09-29)

`scripts/render-qc.sh`, `scripts/splice-mix.sh` and `scripts/resolve/` are general Resolve
delivery tools that live here only because BOTTB is the only show using them. When a second show
or project needs them, or they stop being show-specific, move them and the general parts of this
runbook into their own repo (e.g. `~/src/personal/resolve-tools`), keep the show-specific notes
here, and update the paths in the `live-video-editor` skill. Not before: the runbook still changes
on every song.

## Reels from other shows: Sydney 2025 Canvanauts "Anti-hero" (2026-09-30)

First job outside the Brisbane 2026 show. Everything above assumes the Brisbane project; this is
what differs.

- **A reel is its own Resolve project** (`Canvanauts - Anti-hero - Reel`), timeline
  `Canvanauts Anti-hero`, **2160×3840 vertical 25p**, cut from a multicam `Canvanauts` (starts
  01:00:00:00). `state.py`'s `MAIN_TIMELINE` check assumes the Brisbane show timeline and will
  flag a reel as "NOT the show timeline"; set `MAIN_TIMELINE` to the reel's timeline name.
- **Sydney 2025 cameras** (embedded Sony XML checked per the "Cameras and formats" method): Wide
  = A7S III `luca_2_*` (H.264 4:2:2 10-bit), Audience = A7S III `luca_1_*` (**H.264 4:2:0,
  8-bit**), Chase = FX6 `LUK-fx6-*.MXF` (XAVC). All three are genuinely `rec709`, not log, so
  "washed out and desaturated" is not a missing LUT. Project is **DaVinci YRGB Color Managed v2**,
  Rec.709 (Scene) in and out, working luminance 1000 (Brisbane was plain YRGB). Grade state found:
  **no clip grades, no colour groups, one Film Look Creator on the timeline node**, so nothing
  had been camera-matched.
- **`MVI_*.MP4` is a Canon stills camera, not a phone** (Eddy Hill's EOS R8, in
  `01_Media/Photos/Eddy Hill/...`): 1920×1080 25p H.264 8-bit **full range** (`yuvj420p`, pc).
  Rotation tag 0, so a sideways shot is baked into the pixels; fix it with the edit-page rotation.
  Dean called it "the phone clip"; read `exiftool -Make -Model` before assuming a source.
  The Canon clock read ~1 h 02 m behind the Sony TC (no daylight saving), which is a rough
  cross-check only.
- **A clip added after the multicam is not in it.** Dean's audio-sync attempt left no trace: the
  project DB (`Sm2TiItem` joined to `Sm2TiTrack`, container = the multicam) listed only the three
  cameras, `Canvanauts.wav` and two empty angle tracks. Such a clip goes on V2 over the cut.
- **Sync of MVI_0208: the lock was RIGHT to ~2 frames; the error was the room delay** (re-checked
  2026-09-30 after Dean: "That clip does not line up with audio"). I first wrote that the lock was false,
  from a pose comparison across angles (Canon low side angle vs Chase front). That was wrong and is
  withdrawn. What settled it: **three independent Canon clips** from different songs (MVI_0105, MVI_0297,
  MVI_0208) each put the Canon clock at the same offset from the Wide file, −125.4 / −125.6 / −125.7 s,
  which wrong-repeat locks cannot do. The real error: **the Wide camera's room audio lags the desk mix by
  81 ms** (27 m back of room; measured at three points, ±1 ms), and I had aligned the Canon to the Wide's
  audio. The Canon against the desk mix in a ±1 s window gives −99 ms, so reel frame **3607.98 → 3608**,
  2 frames earlier than placed. Rules: (1) confirm a short-clip sync by **clock-offset agreement across
  several clips from the same camera** (Canon MP4 CreateDate is UTC; Eddy's R8 was set to UTC+10);
  (2) align to the audio the timeline plays (the mix), or subtract the reference camera's acoustic
  delay; (3) a pose check across very different angles is weak evidence. Original entry, kept for context: New tool
  `scripts/sync-short-clip.py`. MVI_0208 (7 s) against `Canvanauts.wav` (desk mix): r 0.106 vs
  reversed-clip control 0.091, no lock. Against Wide `luca_2_20251023_9974.MP4` audio: r 0.27, next
  peak 0.144, control 0.124, and first half / second half / middle all at **404.7384 s** into the
  media file (0 ms spread); a wrong-region window reported NOT TRUSTED (6.5 s spread).
  Conversion to the reel: multicam frame = item Start (DB) + media offset × 25; reel frame =
  multicam frame − 90000 − the first cut's source frame (6511 here, the cuts are contiguous).
  MVI_0208 → reel frame 3610.46 = **00:02:24:10**.
- **Every `run_script` timed out, even a one-line read: it was playback** (Dean confirmed). Five
  in a row from ~22:05; `get_resolve_status` still said running, and the Resolve process was 13 min
  old, which sent me chasing a restart. That was a red herring (corrected same day). Ask "are you
  playing?" first; the moment playback stopped, the next call answered. Never kill `ResolvePython`.
- **A multicam cut's active angle is in its name**: `TimelineItem.GetName()` returns
  `"<multicam> - Video N"`, where N is the multicam's video track (Project.db
  `Sm2SequenceContainer_Sm2TiTrack` `VideoTrackVec` index + 1). The API has no angle getter, and
  `Sm2TiItem.CurrentSelectorIdx` reads 0 on every cut (it is not the angle). The item's `FieldsBlob`
  also carries it as "Camera N". Canvanauts: Video 1 = Audience luca_1, 2 = Wide luca_2, 3 = Chase FX6.
- **`AppendToTimeline` `endFrame` is exclusive on 21.1**: `startFrame 0, endFrame 173` on a
  174-frame clip gave record 3610–3783 (173 frames) and dropped the last frame. Pass `endFrame = frames`
  to get the whole clip.
- **Placing a stills-camera insert for a vertical reel**: `mediaType 1` (video only; the timeline
  audio stays the mix), `RotationAngle 90` (Dean confirmed the right way up), **Zoom 1.0**, and
  Super Scale 2 on the source. ~~`ZoomX = ZoomY = 1.7778` to fill 2160×3840 from a rotated 1080p that
  Resolve fitted to 2160×1215~~ (corrected 2026-09-30: Dean saw it "zoomed in too much" and said
  "that's wrong, set the zoom to 1". I assumed the fit happens before rotation and derived 1.7778
  without looking at a rendered frame. Cause of the actual fit not yet verified; check geometry on a
  rendered frame, never by arithmetic alone).
- ~~**`SetMarkInOut(0, out)` returns False and leaves In unset**~~ (corrected same day: it was the Deliver page, where the render had left Resolve; from the Edit page `SetMarkInOut(0, 6164)` returned True and set In 0).
  Out is set; with no In the render range starts at the timeline start anyway, and the queued job
  read `MarkIn 0, MarkOut 6164`. Read the job's MarkIn/MarkOut from `GetRenderJobList()`, not the
  return value.
- **Measurement render cost on this reel**: 246 frames of 1080×1920 H.264 with FLC off took 4.7 s;
  Resolve's footprint rose 5.8 → 6.6 GB (peak +0.7 GB, `top -pid` sampled at 1 s).
- **A restore check can't be a frame hash of a lossy render of a different length.** Stage 0
  restore check (25 frames) vs S0a (246 frames, same state): 0/25 `framemd5` match, because
  automatic-bitrate H.264 encodes the two jobs differently. Judge it by pixel statistics against a
  real change instead: restore vs identity mean |d| 1.15/255, mean RGB delta +0.04/−0.01/+0.04 (no
  bias); a Sat 1.20 CDL gives 3.92 and a slope/offset/power CDL 10.16. For a byte-identical check,
  render the same range at the same length (the 2026-09-12 FLC restore was byte-identical that way).
- **Measurement renders overwrite the Deliver page's settings.** `SetRenderSettings` is the same
  state Dean renders from: after the Canvanauts measurement renders the Deliver page read
  1080×1920, audio off, H.264 MP4, `/Volumes/BOTTB/Renders`, name `measure_…`, and Dean spotted the
  resolution before his 9:16 render. `GetRenderSettings` does not exist on 21.1 (a read-back call
  fails), and `GetCurrentRenderFormatAndCodec` read `unknown` beforehand, so there was nothing to
  snapshot. Rule: before a measurement render, tell Dean it will change the Deliver settings;
  afterwards set resolution back to the timeline's and audio back on, and say which fields to check.
- **MultiPassEncode on means the percentage runs 0→100 twice** (look-on render: 97% → 10% with a
  65 min estimate that then fell quickly). It was already on in the project (not set by these
  calls). Wait on `IsRenderingInProgress()`, never on the percentage.
- **`SetTrackEnable` returns True and does nothing while Resolve is on the Deliver page.** After the
  look-on render Resolve sat on Deliver; `SetTrackEnable("video", 2, True)` returned True twice and
  `GetIsTrackEnabled` stayed False. After `resolve.OpenPage("edit")` the same call took (read back
  True). Restore track state from the Edit page, and always read it back.
- **Verifying Deliver settings without a getter**: `AddRenderJob()`, read FormatWidth/Height and
  IsExportAudio from `GetRenderJobList()`, then `DeleteRenderJob(jid)` in its own call.
- **A subagent's announced peak was measured on one unit and the real run was bigger.** The gigstills
  chase-pan detector (torchvision KeypointRCNN, CPU, 4 threads) measured 1.05 GB on one cut, was
  announced as ~1.1 GB, and peaked at **2.1 GB** over 32 cuts in one process (194 s), crossing the
  ≥ 2 GB "tell Dean first" line after the fact. Measure the unit at the size of the real run, or
  require the tool to bound its peak per process, before quoting a number for it.
- **`AddRenderJob`/`StartRendering` switch Resolve to the Deliver page** (`AddRenderJob` alone did it when queuing a settings-check job; seen repeatedly on 2026-09-30: the page read
  `deliver` after each render, with Dean not touching it), and on Deliver `SetTrackEnable` returns True
  and does nothing. So after every render: `resolve.OpenPage("edit")` before any timeline state change,
  and read the change back.
- **Resolve Pan unit on the reel (gigstills `cut-pan-calibrate`, 2026-09-30):** `Pan = 2160 × ZoomX × (0.5 − cx)`,
  cx = window centre as a fraction of source width; positive Pan moves the picture right.
  Fitted k = 2158.4 on 7 of Dean's hand-framed cuts, rms 0.3 source px. The "timeline pixels"
  guess was 1.78× out, and ignoring zoom fits 50× worse. 2160 is both timeline width and source
  height here, so recalibrate on another format.
- **My cut list's `source_in_frame` was one frame early on 13 of 32 Chase cuts** (those where
  `source_in − record_in` = 6510, not 6511): `GetSourceStartFrame()` on multicam items rounds the
  multicam source frame. Matching against the render showed 0.76–0.99 similarity at the stated frame
  and 0.9997 at +1. Record frames were right. Anything that decodes source by `source_in_frame`
  should verify against a render (`cut-pan` now does and flags `source_in_frame_+1`).
- **There is no clip-move call in the 21.1 API.** To move a clip: read `GetProperty()` (all transform
  keys) and any audio properties, `DeleteClips([v, a], False)`, re-`AppendToTimeline` video and audio at
  the new record frame, re-`SetProperty` each changed key, `SetClipsLinked`, and read everything back.
  Check the node graph first; a clip grade would be lost. Done on MVI_0208 → 3608 (Dean's zoom 0.5768
  and A2 volume 4.3 carried over). Also: Dean's own nudge had left video and audio a frame apart, so read
  both positions before assuming they moved together.
- **Reel timeline FLC, as found (Dean's screenshot, 2026-10-01 00:01), before any saturation change:**
  Film Look Blend 1.000, Core Look Cinematic, Skin Bias 0.250 | Exposure 0.00, Contrast 1.300,
  Highlights 0.650, Highlight Rolloff 0.500, Fade 0.000, Fade Rolloff 0.650, White Balance 6500,
  Tint 0.0, Subtractive Sat 1.200, Richness 1.000, Bleach Bypass 0.000. Measured effect (gigstills-17,
  render 4 vs 3): shadows 0.10 → 0.044, mids +0.05, white shoulder ~0.967, saturation ×0.66 on lit
  Wide regions, ×0.84–0.85 Audience/Chase, ×0.82 Wide midtones. So Subtractive Sat 1.2 does not offset
  the look's own desaturation; the loss comes from the Cinematic core look and the highlight handling.
- **FLC change 1 (Dean, 2026-10-01): Highlight Rolloff 0.50 → 0.25**, everything else as found. Test
  render `lookon_Canvanauts_Antihero_flc_rolloff025.mp4` vs control `lookon_…control_v3.mp4` (both look-on,
  V2 off, 3099–4551). ~~Result: pending gigstills-17.~~ **Result (gigstills-17, 2026-10-03):** a small gain at no
  cost. Lit-region sat ratio look-on/look-off Wide 0.83 → 0.86, Chase 0.81 → 0.82, Audience 0.59 → 0.61;
  midtones +0.01–0.03; haze-cut on-screen p10 unchanged. **The Audience A7S III loses the most saturation
  through the FLC.** Canon (MVI_0208) grade verify PASS: p0.1/p5/p10/p50 0.004/0.020/0.027/0.096 vs predicted
  0.006/0.022/0.030/0.097.
- **Skin Bias 0.25 → 0.40: no measurable effect** (median skin sat in face boxes −0.010…+0.003 on 7 cuts). Not
  the lever for skin colour; untested candidates are Richness 1.0 → 1.2 or a post-FLC Hue-vs-Sat lift on the
  skin band.
- **Depth-Map screen darkening applied to all screen cuts:** screen ×0.65–0.70, blacks unchanged. Chase
  cuts: performers untouched (×1.00). **Wide cuts: the depth map darkens the performers too** (skin ×0.71–0.94,
  white shirts ×0.73–0.92; Dean's cut 51 screen ×0.63, skin ×0.75), visibly greyer shirts on 49/53. On the
  Wide the key needs to separate band from screen (Magic Mask on performers inverted, or a qualifier on the
  screen). Per-frame screen ratio 0.52–0.83: check 48 and 44 in playback for pumping.
- **FLC Contrast 1.3 vs 1.2:** no strong case either way; black T-shirt folds read but are low (12–22 % of
  dark pixels ≤ 0.01). Taste call, 1.2 not measured.
- **Screen darkening test (Dean, 2026-10-01):** on the Wide clip 4027–4161 (00:02:41:02), node 02 = Resolve
  FX Depth Map (preview off; Dean set Target Depth and Tolerance to 0 first, which still left the drummer
  half in), key output → node 03 key input, node 03 Gain 0.5 (Dean's choice; gigstills-17's starting target
  was ×0.75 ≈ −1 stop). The depth map keeps front performers black (untouched) and puts the drummer at
  mid-grey (half effect), which suits a gain move because the projector wash falls on everything. Needs
  both links: green = picture, blue = matte. Watch for per-frame depth flicker on the wall.
  **Settled (Dean): node 03 Gain 0.8 + Gamma −1** (keeps the screen's highlights while the grey wash sinks); a job-specific setting, not a rule.
- **Heavy-job lock with the retime session (agreed 2026-10-01).** retime's background agents can't post
  every gap, so before any Resolve render: (1) wait until none of theirs runs, checking
  `ps -axo pid,command | grep -E "wd.py|sep_runner|sep_bench" | grep -v grep` and waiting on the PID
  (each run is 2–10 min); (2) write `/Volumes/Supp1Tb/ai-models/scratch/heavy.lock` containing
  "bottb-48 resolve render"; (3) render; (4) delete the lock, **always, even if the render fails**. Keep
  each lock under ~5 min; their agents wait while it exists. A protocol between sessions only, not Dean's
  approval for anything.
- **FLC change 2 (Dean, 2026-10-02): Skin Bias 0.25 → 0.40** ("overall the skin tones need a bit more
  color"). Test `lookon_Canvanauts_Antihero_skinbias040.mp4` vs control `lookon_…_screen_depth.mp4`.
  Result: pending gigstills-17. FLC as of Dean's 2026-10-02 16:26 screenshot: as found except Skin Bias
  0.40 and Highlight Rolloff 0.25.
- **Copying a node graph to other clips: `TimelineItem.CopyGrades(targets)` REPLACES each target's whole
  grade** (current layer). Copying Dean's 3-node screen graph from Wide 4027 to 9 clips wiped the haze CDLs
  on node 1 of the 4 Chase targets (read back: node 1 empty). Fix: snapshot the targets' graphs first,
  `CopyGrades`, then re-`SetCDL` node 1 in its own call and read back `GetToolsInNode(1)`. (The UI's
  "Append Node Graph" from a still would keep the target's nodes; the API has no append.)
- **10 Depth Map nodes cost ~5× render time:** the minute look-on took 14.7 min against ~3 min without
  them, with a Resolve peak of about +0.9 GB (sampled for the first half only). Bypass them while cutting.
- **Screen node across 10 clips (first read):** with gigstills' `screen_rois.json`, screens came down
  ×0.65–0.83. Performer-box medians on the Wide cuts dropped 0.04–0.08, but the boxes include screen
  behind the band, and by eye the white T-shirt and face are unchanged. Use person masks, not boxes, for
  this check (asked of gigstills-17).
- **A Depth Map key leaves an unkeyed strip the width of the clip's Pan** (Dean spotted it, 2026-10-02).
  Chase 3751 (Pan +123): the leftmost ~120 timeline px of screen got no darkening (column ratio 1.00 vs
  ×0.72 elsewhere), and Dean confirmed on the matte (Shift+H, Isolate Specific Depth on) that the clipped
  band matches the pan. The depth analysis does not follow the edit-page transform. **Fix: Render in Place**
  (Video Effects ON, Color Grading OFF) bakes the transform, so the live clip nodes key the framed picture.
  Measured on a Pan only. **Correction (Dean, 2026-10-16: "the zoom does not seem to affect them"):** on the Canvanauts
  dynamic-zoom cuts with a depth key he saw no unkeyed edge, so the strip comes from a Pan (offset), not from zoom. A panned
  clip with a depth/AI key goes in the RiP set; a zoomed one is in the RiP set anyway for Super Scale, and the key
  recomputes on the baked picture. Check edges after the RiP either way.
- **A stills-camera insert with Super Scale goes in the RiP set too.** `superscale.py VALUE=1` resets every
  `.MP4`, including the Canon `MVI_*`, which is not behind a multicam. RiP it at Super Scale 2 first, or it
  ships at Super Scale 1. Canvanauts RiP set: Wide 3164, 3357, 4027, 4388, Chase 3751, Canon on V2.
  `superscale.py VALUE=2` set 18 (`luca_1`/`luca_2`), already 1 (the Canon), failed 0 — its first run,
  correct.
- **Canvanauts reel v1 delivered render (2026-10-02):** 2160×3840 H.264 45 Mb/s + AAC, from Dean's In/Out
  3099–4550 (RELEASE marker), 7.3 min in Resolve with 10 Depth Map nodes and multipass (the full render was
  faster than the 1080p look-on test, 14.7 min). `render-qc.sh` PASS: 1452 frames, audio 58.15 s vs video
  58.08 s, 330,373,085 bytes, which is over the 300 MB IG cap. The 1080×1920 copy (x264 slow CRF 18, audio
  stream copied, so no extra AAC generation) is 109,082,466 bytes, PASS. **That ffmpeg 4K→1080 encode peaked at
  1.12 GB** (`/usr/bin/time -l`, 33 s), so it counts as heavy: announce it.

## Resolve 21.1.1 upgrade: API audit and the local manual (2026-10-02, deapovey-be)

Installed build **21.1.1.10 Studio** (`resolve.GetVersion()`); `get_resolve_status` still says
"21.1", which is only how it truncates the version. Release notes: Dean pasted the r/davinciresolve
post (Reddit blocks scripted fetches).

**Local manual and API reference:** `~/Documents/reference/davinci-resolve-21.1/` (see its README).
The 21.1 Reference Manual PDF (4,351 pp), `manual.txt` (one form feed per page, so text page = PDF page), the bookmark
outline, and `search.sh` (`search.sh 'render in place'`, `-c multicam` for chapters, `-p 1152` for a
page). Also snapshots of the installed 21.1.1 developer stub/README/CHANGELOG and of the stub the
MCP server serves, for diffing at the next upgrade.

- **The MCP server's API reference is stale.** `get_scripting_api` / `search_scripting_api` still
  serve the 21.1 stub and `get_whats_new` reports nothing after 21.1. The 21.1.1 additions are only in
  `/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Scripting/DaVinciResolveScript.pyi`
  (copied to the reference folder). Grep that file for anything new; its `CHANGELOG.md` also stops at 21.1.
- **New in 21.1.1, verified live:** `Project.GetRenderWithQuickExportStatus`, `GetTranscribeAudioStatus`,
  `GetAnalyzeForSlateStatus`, `GetSmartReframeStatus`, `GetDetectSceneCutsStatus`,
  `GetCreateSubtitlesFromAudioStatus` (each returns `{'JobStatus': 'Inactive'}` when idle). These are
  the release notes' "async APIs": start the job and poll, instead of one `run_script` call blocking
  past its 60 s cap. `Graph.ApplyGradeFromDRX(path, gradeMode, applyToAllLayers=False)` gained the
  all-layers flag.
- **Render job status, 21.1.1:** `GetRenderJobStatus` now returns `JobStatus: 'Rendering'` (the stub
  also lists Upload Pending / Uploading / Inactive / Unexpected) plus `EstimatedTimeRemainingInMs`.
  **The ETA is not usable for waiting:** on bottb-48's reel render it read 43 000 ms at 65 % and
  57 000 ms at 70 % several minutes later. Keep waiting on `IsRenderingInProgress()`.
- **Clip property reads are blank while ANY render runs (found 2026-10-02).** During bottb-48's reel
  render, `GetProperties()` returned `{}` and `GetProperty('ZoomX')` `None` on every item (MVI_0208
  included); the moment `IsRenderingInProgress()` went False the same calls returned 32 keys and
  ZoomX 0.5768. Because the tools treat `None` as "not zoomed", `state.py` and `mark_zoomed.py`
  would have reported **zero** zoomed cuts. Both now refuse to run during a render. Not known
  whether 21.1 did the same; treat it as true for any property read.
- **`hasattr()` lies on Resolve objects:** it is True for any name (the attribute is `None`), so
  `state.py`'s `hasattr(proj, "GetRenderSettings")` guard crashed. Use `callable(getattr(obj, name, None))`.
  Fixed; `state.py` then ran clean on 21.1.1 (reel 3099-4550: 15 multicam + 1 video item, 2 dynamic +
  2 static zoomed). `superscale.py` not yet re-run on 21.1.1 (it writes; run when a song needs it).
- **Still impossible (unchanged):** no OFX-parameter API (Halation / Film Look Creator stay UI-only),
  no Render in Place or Decompose call, no `Project.GetRenderSettings`.
- **Our calls are deprecated but still work:** `GetSetting(name)`, `TimelineItem.GetProperty(name)`,
  `SetSetting`, `SetProperty`. The canonical forms are `GetSettings()` / `GetProperties()` and index into the dict.
  `state.py`, `mark_zoomed.py` use the old forms; migrate when next touched. The 4-arg
  `SetSetting('superScale', 2, sharp, nr)` is not deprecated. `GetSetting('timelineResolutionWidth')`
  read 2160 live on 21.1.1.
- Release-note items that touch our UI steps: **"Addressed issue with Halation controls in Film Look
  Creator"** (the manual halation toggle; nothing in the runbook named a symptom, so just watch it);
  **"Multicam actions are now available in single viewer mode"** and **"Sync bin multi angle view now
  displays record timecode"** (may relax the 21.1 multicam-viewer gate above; not yet tried);
  Smart Reframe is now pollable from the API (`TimelineItem.SmartReframe` + status), a possible first
  pass for 9:16 reels next to `gigstills cut-pan`, not yet tried.

## Sydney 2025 full sets: Google / The Incident Commanders (2026-10-02, bottb-48)

- **Project `Incident Commanders`** = the full set: `Timeline 1`, 1920×1080 25p, 00:00:00:00–00:23:39:18,
  336 multicam cuts. Every multicam audio angle holds the same file, `Incident Commanders - Full Set.wav`
  (starts at multicam frame 551 = 22.04 s; camera audio before and after), so A1 does not change sound at
  angle cuts. **Timeline time = Full Set file time + 22.04 s** (cross-checked: the Don't Start Now WAV on A2
  lands at Full Set 528.18 s, i.e. +22.02 s).
- **What the audio files are.** `_TO_SORT_Audio/Sydney/DLIVE006.WAV` = the dLive 2-track desk recording of
  the set (96k/24, 1333.98 s, −27.6 LUFS). `Incident Commanders - Full Set.wav` = a Logic bounce of it
  (2025-10-31, BWF time_reference 359222450 @ 96k), **sample-aligned with DLIVE006** (lag 0), +5–6 dB,
  r 0.92 (processed), −22.0 LUFS. `02_Production/Google/Google - Don't Stop Now.wav` (2026-07-06 bounce,
  the song is Don't **Start** Now) is mastered: −11.2 LUFS, LRA 3.6.
- **Used to Be in Love has no bounce.** The delivered 2025 videos (`_TO_SORT_Video/Incident Commanders/`)
  were cut from the Full Set bounce (the per-song Resolve projects reference only that WAV). ~~The 2026-07-06
  Logic project `Google - Used to be in Love.logicx` (DLIVE006 + separated stems + room mics BotB-002_06–09)
  was never bounced~~ (corrected 2026-10-02 by the mixdown session: that `.logicx` is the **Don't Start Now
  session saved 10 min before a Save As**: identical settings, its only placed regions start at desk 528.1 s
  and run 186.8 s = DSN. **Used to Be in Love has never been mixed.** And **BotB-002_01–09 are not room
  mics**: they are copies of the desk L/R (r 0.99–1.00 below 1 kHz) on a recorder clock drifting −13.2 ppm,
  so this set has no independent crowd/room source. I had read a project's name and its file list as its
  content; open the project, or ask mixdown, before describing what a `.logicx` holds.)
- **The DB setlist order is wrong for the played order.** DB: Bohemian Like You, Song 2, Don't Start Now,
  Call Me Maybe, Dumb Things, Used to Be in Love. Measured: the delivered Used to Be in Love video's audio
  locks at Full Set 281.72 s (r 0.86 at both ends, runner-up 0.02), so it was played **second**. Slots by
  gaps (timeline TC, ±5 s): 1 **Dumb Things, first note 00:01:26:06 (Dean)**, 2 **Used to Be in Love first note 00:05:04:11 (Dean)** (2025 delivered cut starts 00:05:03:20), 3 **Don't Start Now first note 00:09:14:13 (Dean)** (mix on A2 from 00:09:11:00),
  4 **Call Me Maybe 00:12:47:24 (Dean; 22 s before my gap estimate, quiet intro)**, 5 **Bohemian Like You 00:16:30:04 (Dean)**, 6 **Song 2 00:20:18:09 (Dean)**; music ends ≈ 00:22:22. Played order (Dean, by ear): Dumb Things, Used to Be in Love, Don't Start Now, Call Me Maybe, Bohemian Like You, Song 2.
- **Fairlight plugin inserts (e.g. Ozone on a bus) are not readable**: not in the scripting API, and no
  plugin name appears in `Project.db` as plain text (Ozone 12 AU is installed). Ask Dean to look at the
  Fairlight mixer.
- **`strings` fails on this Mac** (Xcode licence not accepted); read binary DBs with `grep -a` / Python.
- **Song cards and chapters done (2026-10-02):** 6 Mint `CH Incident Commanders <n> <song>` markers at
  Dean's first notes; cards on V2 "Titles" at first note +32 frames. `generate-song-overlays.ts --event
"sydney 2025" --band "incident commanders"` numbers its PNGs in **DB setlist order**, which is not the
  played order here; renamed by played order into `02_Production/Google/Overlays/` (PNG + 5 s 4K ProRes
  4444 with alpha fades in 12f / out 22f). Place cards by title, never by the file's number.
- **Desk segments for Logic (2026-10-02):** `02_Production/Google/Segments/Google - NN-<song> - desk.wav`, cut
  sample-exact from DLIVE006 (96k/24), BWF `time_reference` = 359222450 + start sample (the Full Set
  bounce's basis, so they land where the full-set bounce does). Timeline ranges include ≥ 2 s overlap for
  crossfades: Dumb Things 00:00:22:01–00:04:52, Call Me Maybe 00:12:16–00:16:12, Bohemian Like You
  00:16:08–00:20:12, Song 2 00:20:08–end of recording (≈ 00:22:36). Verified: sample counts and BWF
  read back exact; Bohemian vs Full Set lag 0, r 0.921.
- **zsh trap:** in `"atrim=start_sample=$sa:end_sample=…"` zsh reads `$sa:e` as the `:e` (extension)
  modifier and ffmpeg gets garbage. Brace every variable followed by a colon: `${sa}:`.
- **Full-set titles: Dean's design decisions (2026-10-02).** Song cards stay as they are (the corner-logo
  song overlay). The full-set **opening** card is "filmic", on black: "BATTLE OF THE TECH BANDS PRESENTS"
  as **text** (not the logo), the band's own logo (keyed to white when it has a white background), "FROM" +
  the company logo(s) in colour, then "LIVE AT <venue> · <city> · <date>". The **credits** card: band
  name, members (role | name, two columns) **or a no-members variant**, "Recorded live at…", and a logo
  row (company, Bottb, Powered by <national partner>, Supporting Youngcare), over a darkened, blurred final
  wide, then the existing end card. No band in the DB has `info.members` (checked 2026-10-02). Dean: member names won't be available for every Sydney band, so **no-members is the default for Sydney 2025**; use the members variant only where names exist. Built as a
  "Filmic" style on `/admin/band-set` + `src/scripts/generate-set-titles.ts` (branch `feat/filmic-set-titles`).
- **Opening and credits placed (2026-10-02):** `00-opening-filmic.mov` (7 s: opaque black, content fades
  in 1.2 s, whole card alpha-fades out 5.5–7 s to reveal the picture) at 00:00:00:00, and
  `99-credits-filmic-nomembers.mov` (8 s, baked 0.66 scrim, 1 s alpha fades) at 00:22:50:00 over the last
  V1 shot (00:22:46:02–00:23:39:18), both on V2 "Titles", from `02_Production/Google/Overlays/`. Alpha
  verified by measurement (opening 255 → 20/255 at 6.9 s; credits peak 169/255 = the scrim). The blur
  under the credits is not scriptable (no OFX API); Dean adds it in the UI if wanted.
- **Master v2 swapped in (2026-10-02 ~22:10).** `03_Delivery/Google/Google_FullSet_Master_v2_at_00-00-22-01.wav`
  (mixdown session; 96k/24, 1334.000 s, bext 359222450, −13.3 LUFS, TP −1.0, LRA 9.6; sha256 85e3b831…; my
  re-measure matched). Placement checked before the swap: lag 0 against DLIVE006 and the Oct bounce at ten
  points from the opening talk to the tail.
  ~~**Swapping a mix inside a multicam: `MediaPoolItem.ReplaceClip(new_path)` on the pool item the multicam's
  audio angles use.**~~ (CORRECTED same evening. Dean: "We normally just add as a track on the edit, I don't
  see any good reason to put it in the multicam." He could not see the master anywhere on the timeline.
  **The master always goes on its own named audio track** (here A3 "Master v2", placed at its desk offset,
  frame 551), with the multicam audio disabled; the ReplaceClip was reverted. The track route also measured
  better: r 1.000 at 0.00 frames against v2, where the multicam route gave r 0.959 at −2 ms. Original text kept below.) All 5 uses followed and Start TC stayed 01:02:21:22 (same BWF), with no clip moved, so
  there were no straddling A1 cuts to split. (The API has no razor; 2 of the 342 A1 cuts straddled the
  mix's start and end, so disabling clips would have left a gap or a doubled mix.) The pool item keeps its
  old _name_, so read `File Path`, not the name. A2 (the July DSN mix and a multicam stub) disabled: v2
  already contains DSN.
  **Verified on a render:** 30 s at 00:10:00:00 (`measure_google_v2_swapcheck.mov`) correlates with v2 at
  −0.05 frames (−2 ms), r 0.959, against r 0.187 for the Oct bounce.
- **No WAV render through the API on 21.1.1:** `GetRenderCodecs("wav")` is `{}` and
  `SetCurrentRenderFormatAndCodec("wav", …)` fails for every codec name. For an audio check render use
  `mov` + `H264` at 1280×720 with `AudioCodec "lpcm"`, 48k/24 (30 s took 5.8 s). Afterwards: Edit page,
  `ClearMarkInOut("all")` if there were no marks before, delete the job, and reset width/height and the
  custom name. Format, codec, target dir and audio codec stay as the check left them: tell Dean.
- **End card (2026-10-02):** Dean moved the credits to 00:22:23:20–00:22:31:20. `TitleCards/EndCard_2x.mov`
  (1920×1080, 98 frames = 3.92 s, fades baked into RGB) placed on V2 directly after them, 00:22:31:20–
  00:22:35:18, ending 8 frames before the master (00:22:36:01). **Additive is scriptable:**
  `item.SetProperty("CompositeMode", resolve.COMPOSITE_ADD)` (= 1.0) read back 1. Compute frame numbers from
  `GetEnd()` of the neighbour, never from a TC converted by hand: I mis-converted 00:22:31:20 by 25 frames
  and first left a 1 s gap.
- **Grade handover (2026-10-02 ~23:00).** Dean ripple-edited the set and set In/Out 0–32852 (00:00:00:00–
  00:21:54:02); Cyan RELEASE marker added. Project colour state: unmanaged YRGB, **no timeline nodes, no
  groups, no clip grades**, so the measurement render needed no bypass. Cut list (327 V1 multicam items;
  Wide 148, Chase 151, Audience 28) at gigstills `runs/google-sydney-fullset/cut_list.json`. After a
  ripple edit record frame ≠ multicam frame: use `GetLeftOffset()` as the multicam frame and resolve the
  source file from the Project.db angle tracks (paths there are the old `/Volumes/Battle Of Band 2025/
Resolve/…` and need rewriting to the Extreme SSD paths). Render `/Volumes/BOTTB/Renders/
measure_Google_FullSet.mp4`: 1314.12 s, 32853 frames, **173 s to render** (look-free 1080p).
- **The Deliver page hides In = 0.** After the render, `GetMarkInOut()` read `{'out': 32852}` with no `in`,
  and the page read `deliver` even though I had opened Edit one call earlier: `SetRenderSettings` /
  `DeleteRenderJob` switch to Deliver again. On Edit the same marks read `in: 0`. Re-set the marks and read
  them on the Edit page; open Edit after **every** render-queue call, not once.
- **A measurement render must have V2 (titles, cards, end card) OFF.** I rendered the Google measurement
  with V2 on, so 15 of 327 cuts were measured with titles burned in (the opening card is opaque black over
  cut 1; the credits scrim darkens cuts 325–327; song cards put logos and text on 9 more). It showed up as a
  crowd cut with the credits on it in the review frame. The Canvanauts renders were "V2 off": that was the
  protocol, and I skipped it. Turn V2 off in its own call, render, then turn it back on in its own call
  from the Edit page, and read each step back.
- **Check a clip's node graph before `SetCDL`.** 7 of 132 target cuts already had a Primary Balance on
  clip node 1 (Dean's hand grades); `SetCDL` would have overwritten them silently. Read `GetNodeGraph()`
  and `GetToolsInNode` on every target first, and skip any that are graded.
- **The render cycle clears an In mark of 0, even on the Edit page.** After the verify render, delete job and
  `SetRenderSettings`, `GetMarkInOut()` on Edit read only `out`; re-reading in a separate call confirmed the In
  was gone. Restore it from the RELEASE marker after every render (`SetMarkInOut(0, out)`, read back).
- **Google k0 applied (2026-10-03 ~09:50):** 125 cuts via `SetCDL` in logged batches (index list in the
  scratchpad's `applied_k0.json`). I chose k0 over k06 because a look follows (Canvanauts ruling); Dean had
  asked for "all the color fixes". Verify render `/Volumes/BOTTB/Renders/verify_Google_FullSet_k0_V2off.mp4`
  (V2 off, 163 s) is also the clean re-measure for the 15 contaminated cuts. memcheck said COMFORT ask
  (retime's review server 2.9 GB, Resolve 5.3 GB, compressor 8.2 GB); Dean said run it.
- **Google colour fixes complete (2026-10-03 ~10:20): 128 cuts.** k0 on 125 (verify: all within 0.01, median
  +0.001; 187 untouched cuts unchanged), plus 165/166/278 from gigstills' clean-composite re-run (verify within
  0.003). Not applied: 327 (both caps, clip +0.07, Dean's call), the 7 Dean-graded cuts, crowd cut 118, and
  unverified 1/2/13/114/325. gigstills' method for contaminated cuts: swap their frames into the original
  render and re-run the WHOLE recipe, because thresholds and lighting states come from the full set. All
  applied under Dean's general "make all the color fixes"; he had not seen the sheets (gigstills told him).
- **Google look, FLC grain (Dean, 2026-10-03 10:22):** Aurora is a **Grain preset** (Grain > Preset) ~~not a
  Core Look~~ (corrected same day: Dean's screenshot shows **Core Look: Aurora** too, so it is both a Core Look and a
  grain preset); the 21.1 manual names neither. As set: Amount 0.350, Size 0.000, Softness 0.250, Saturation
  0.150, Image Defocus 0.900. Dean: "a bit too much grain". Note that Image Defocus softens the picture and
  not the grain (manual p.3563): at 0.9 it costs sharpness. Remember that the FLC needs manual Color Space
  Overrides on this unmanaged YRGB project.
- **Keeping titles out of the look: an Adjustment Clip below them (2026-10-03).** The timeline node grades the
  final composite, so the titles were getting the FLC (halation). Fix: FLC moved to an **Adjustment Clip on
  V2** spanning the range (Edit page > Effects > Toolbox > Effects > Adjustment Clip; graded on the Color
  page), titles moved to **V3**. Verified on a render over the Dumb Things card (frames 1190–1214): the footage
  takes the look and the title text and logos are unchanged, with no glow. **The API can't see an adjustment
  clip's grade:** `GetNodeGraph()` on it shows one node with `GetToolsInNode` → None, and the timeline graph
  shows 0 nodes, while the render shows the look. Check on pixels. Dean's first "everything is black" was
  the viewer: a render at 00:10:00 was normal (the playhead was on the opaque opening card at 0).
  Measurement renders now need **V2 (the adjustment clip) and V3 (titles) off**.
- **Google look, FLC as set by Dean (2026-10-03, screenshots), on the V2 Adjustment Clip:** Film Look Blend 1.000,
  **Core Look Aurora**, Skin Bias 0.200 | Exposure 0.00, Contrast 1.300, Highlights 0.650, Highlight Rolloff 0.250,
  **Fade 0.500**, Fade Rolloff 0.500, White Balance 7000, Tint 10.0, Subtractive Sat 1.200, **Richness 1.200**,
  Bleach Bypass 0 | Split Tone ON, Natural, Protect Neutrals ON, Amount 0.200, Hue Angle 30.0 (direction not
  verified), Pivot 0.400 | Vignette off | Halation ON, Highlights Only, Amount 0.100, Radius 4.00, Sat 1.000,
  Hue 0.500 | Bloom ON 0.050 / 10.0 | Grain ON, Custom, Amount 0.200, Size 0, Softness 0.250, Saturation 0,
  Image Defocus 1.000. (The reel had Fade 0.000 and Core Look Cinematic.)
  **Fade 0.500 → 0.000** (Dean, 2026-10-03, after I flagged it could lift the black floor the recipe set).
- **Google look measured (gigstills-17, 2026-10-03; `runs/google-sydney-fullset/look_measure.json`, CIELAB, look-on
  vs verify render).** (1) The purple stage wash rotates **295–299° → 267–281°** and loses ~40 % chroma (×0.57–0.66);
  (max−min)/max saturation misleads here (×1.07–1.11, because blacks deepen): use Lab chroma. (2) Driver: probably
  the **Aurora core look**, not WB (neutrals move only slightly green/yellow; the rotation is hue-selective and
  fits a per-channel gain badly). A/B on c040 + c185: Tint 0 / WB 6500 / Core Look Cinematic, one change each.
  (3) Contrast 1.3 + Fade 0 **crushes the crowd shots** (Audience c005 p50 0.040 → 0.000; c185 p50 0.110 → 0.049);
  lit-shot mids lift (Chase p50 0.468 → 0.545). (4) Clipping falls 0.091 → 0.003 (Highlights 0.65 / Rolloff 0.25).
  (5) Skin chroma +12–21 % but hue stays 80–94° (yellow-olive; typical skin 55–65°): **the skin was never
  magenta**, the "less magenta" is the purple surround turning blue. (6) Vests clean yellow on Chase, orange and
  −25 % chroma on Audience. (7) Amber practicals greyer (×0.64–0.80 chroma). (8) Split tone 30° does warm the
  0.7–0.98 band toward orange-yellow, so hue 30 = warm highlights (direction confirmed).
- **Set marks with `ClearMarkInOut("all")` first when queuing several ranges.** `SetMarkInOut(a, b)` with a
  new In beyond the old Out queued jobs with MarkOut = MarkIn (one frame) for 3 of 6 test ranges. Read each
  job's MarkIn/MarkOut back from `GetRenderJobList()`.
- **Dean on the Google look (2026-10-03):** "apart from the crowd shot issue, I am okay with the rest, maybe
  we could get a little bit back on the stage color." Plan: crowd cuts get a per-cut pre-look lift (gigstills
  computes composed CDLs from the look-on/off pairs; Power preferred over Offset); stage colour is pulled back in
  the FLC by Dean (Tint 10 → 0 first, then a post-FLC Hue-vs-Hue/Sat node on blue-violet if needed).
- **Tint 10 → 0 does not bring the purple back (2026-10-03, my measurement, Lab on the lit wash: look-off / Tint 10
  / Tint 0):** hue c040 295/268/269, c058 295/273/273, c014 301/287/288; chroma c040 61.7/38.3/38.7, c014 78.8/52.8/
  53.6. Neutrals went slightly MORE green at Tint 0 (a −1.9 → −2.9 on c040), so in the FLC **Tint +10 was the
  magenta side**, not green as gigstills guessed. The violet → blue rotation is the Aurora core look's
  (hue-selective); recover it after the FLC (Hue-vs-Hue/Sat on blue-violet) or with a lower Film Look Blend.
- **Crowd lift under the look (2026-10-03).** gigstills: the crowd shots are exactly the 28 Audience-camera cuts;
  19 are crushed by the FLC's shadow toe (everything below luma ~0.045 → black; fitted on c005/c185), 9 house-lit
  ones are not. Fix per cut: a small pre-look **Offset with white held (Slope 1 − o)**, o 0.025–0.05, plus Power
  0.83–0.98. Power alone overshoots the upper mids before p50 recovers, because the look already lifts the mids.
  Composed over k0 exactly (Slope s₁(1−o), Offset o₁(1−o)+o). Applied to 18; **118 skipped**: it carries a
  Primary Balance that is not mine (probably Dean's), and the proposal assumed identity. **Check every target's
  node graph against what the proposal assumed as the current CDL**, not just "graded or not". Verify clips
  `lookon_Google/crowdlift_*.mp4` (look on, titles off).
- **Crowd lift verify PASS (gigstills-17, 2026-10-03):** cuts 5/185/104/212 look-on p10/p50 within 0.008 of
  prediction and 0.007 of the look-off values; p0.1 stays ≤ 0.013; p90 +0.02–0.06 over look-off (the look's own mid
  lift). Control on cut 5: unlifted look-on 0.000/0.000/0.000/0.086 → lifted 0.010/0.016/0.039/0.164 (look-off
  0.006/0.015/0.041/0.148). The other 14 lifted cuts were checked only through the model; measure all 18 on the
  look-on delivery render instead of a separate full-set look-on render (the FLC makes that render slow).
- **Resolve's render cache fills the BOOT disk (2026-10-03 ~11:15).** `~/Movies/CacheClip` = 43 GB (9.4 GB written
  in 2 h, ~650 `.dvcc` files/min) once the FLC sat on an Adjustment Clip with Smart cache on; boot free fell to
  **3 GB** (memcheck SAFETY FAIL; swap 5/6 GB), then recovered to 44 GB from released swap or purgeable space,
  not the cache. Dean asked "is anything you are doing writing to disk?" (nothing of mine was running). Rule:
  before any look work, check the **Cache files location** (Project Settings > Master Settings > Working
  Folders) is on an external drive, and check `du -sh ~/Movies/CacheClip` and `df` when playback with a look starts.
- **Stage-colour node (Dean, 2026-10-03):** Adjustment Clip node 02 after the FLC, **Hue vs Hue** band Input Hue
  ~140–183 (middle on the wash peak), **Hue Rotate −10** (+15 turned the purple bluer: in Resolve's Hue vs Hue a
  negative rotate moved this band toward violet). Resolve's Input Hue values do NOT match a 0–360 reading of the
  strip (I estimated 224/267 from screenshots; Dean read 140–183): use the field values, not pixel positions.
  Hue vs Sat on the same band next (target ~1.25).
- **The hue node missed the stage (2026-10-03).** Rendered and measured: stage-wash hue/chroma unchanged (±0–3°),
  skin/vests unchanged, crowd 185 blue chroma 18.4 → 19.0. The node WAS on the adjustment clip (the API now listed
  `['OFX: Film Look Creator'], ['Hue vs Hue Curve', 'Hue vs Sat Curve']`, where earlier it listed None, so the
  adjustment-clip read is not reliable either way), but Dean had picked the band on crowd cut 185
  (playhead 00:13:31:15), whose blue differs from the stage wash. Pick a hue band on the shot it is meant to fix,
  and verify on a render of that kind of shot.
- **Second hue band, picked on a stage shot (Chase 00:02:42:00), works (2026-10-03; Lab, look-off / look / look +
  node):** wash hue c040 295/269/282, c058 295/273/285, c006 269/233/248, c014 301/288/291; chroma c040
  61.7/38.7/48.6, c058 68.6/44.1/57.3, c006 32.9/24.4/26.1, c014 78.7/53.7/60.3. So about half the hue rotation and
  27–54 % of the lost chroma came back. Skin/vests unchanged (hue ±3°, chroma ±0.4). Crowd 185 blue chroma 18.4 → 20.0,
  L unchanged. Both bands kept (Dean).
- **Google pre-render checklist + RiP (2026-10-03):** no colour groups, so no Deflicker/NR step. 53 cuts marked Orange
  (21 DZ + static ≥ 1.3); Super Scale 2 on 27 camera clips. **`superscale.py` filtered `.MP4` only and would have
  skipped every FX6 `.MXF` (Chase) clip; it now uses `CAMERA_EXT = (".MP4", ".MXF")`**, deliberately excluding
  `.mov` title cards. Dean RiP'd the 53 (Include Video Effects on, Color Grading off) into `/Volumes/BOTTB/Renders`;
  all 53 became Video items with their CDLs intact. Single-change check on cut 185 (pre-RiP with hue node vs post-RiP):
  colour/levels within 0.4/255, detail +5–8 % (Super Scale). Super Scale back to 1 on all 27.
- **4K delivery render started 12:01:** job 76fce595, In/Out 0–32852, H.264 3840×2160 with VideoQuality 45000 (codec set
  first), AAC 320 requested (`AudioBitRate` reads None in the job dict), A3 "Master v2" only, look on the V2
  adjustment clip, titles + end card on V3. memcheck COMFORT ask (swap 7.6/8 GB; retime review server 4.0 GB); Dean: "go".
  A Sonnet watcher polls `IsRenderingInProgress()`; the heavy.lock is held for the whole render and retime was told.
- **Google 4K v1 rendered (2026-10-03 12:01–12:36): 2026 s for 1314 s = 1.5× real time**, not the 75–85 min I quoted
  from Everlong (1306 s for 359 s = 3.6×). This project has no group Deflicker/NR nodes; budget from the node stack,
  not from another song. 7,428,902,867 bytes. render-qc PASS (32853 frames, audio Δ 0.08 s, tail decodes, 44.9 Mb/s);
  −13.3 LUFS (master −13.3), TP −0.4 dBTP (master −1.0; the AAC encode adds ~0.6), AAC 320 kb/s 48 kHz.
  **After the render, `GetMarkInOut()` was `{}`: both In and Out were cleared**, not only an In of 0. Restored from the
  RELEASE marker.
- **Watcher subagents: a foreground `sleep N` is blocked by the harness** ("Blocked: standalone sleep"). The watcher
  that worked used `sleep 230` with `run_in_background: true`, then `while pgrep -f "^sleep 230$"; do sleep 5; done`.
  Put that in any watcher brief.
- **1080p made from the 4K master with ffmpeg** (lanczos, x264 medium, 12 Mb/s, `-c:a copy`, so no second AAC
  generation), not a second Resolve render: ~0.95 GB RSS, 6 threads, ~10 min.
- **Google 1080p v1 (ffmpeg from the 4K master):** 910 s wall, **peak footprint 1.01 GB** (`/usr/bin/time -l`), 2,016,451,519
  bytes, 11.9 Mb/s; render-qc PASS; audio packets md5-identical to the 4K (`-c:a copy`), so nothing changed in the sound.
- **Google post-delivery (2026-10-03):** 53 Orange colours cleared (`ClearClipColor()`, read back, 0 left); Super Scale 1
  on all 27 camera clips (re-checked); render queue empty, name reset; final mix on the timeline = A3 "Master v2"
  (A1/A2 off). The look stays live on the V2 adjustment clip; for editing playback, disable that clip
  (`SetClipEnabled(False)`) or turn halation off in the FLC (UI only). No groups, so no Deflicker/NR to turn off.
  Extreme SSD went to 2 MB free (cache disabled by Resolve); Dean had `.gradle` (86 GB) and `ml-cache` (31 GB) deleted
  → 117 GB free. A ~74 GB drop after 11:58 is still unexplained (not visible new files, not deleted-but-open, not Trash).
  Archive upload `03-extreme-rest` failing since 2026-10-03 00:30 on "Drive storage quota exceeded".
- **Google test renders deleted (Dean, 2026-10-03: "Do you want to just delete the test renders?"):** measure, verify,
  verify_supp × 2, `lookon_Google/` (26 clips), 3.8 GB on BOTTB. Kept: 4K + 1080p deliverables and the 53
  `Timeline 1 - Video N Render N.mov` RiP files in the same folder (the timeline plays from them, so never glob-delete
  `*Render*` there). Destination: YouTube only (Dean); no IG cut.
- **Google full set handed to the Social agent (bottb-5b) 2026-10-03 14:3x**, in one message per the contract: paths, local
  byte counts, resolution, duration 1314.12 s, QC + Dean's approval ("Okay we are good to go", ~14:32), thumbnail NOT
  made (Dean making it), the played-order chapters (the DB order is wrong), and Dean's instruction verbatim: YouTube
  following the Melbourne full-set guidelines, then link posts on every platform that supports links, ASAP.
- **Drive "storageQuotaExceeded" was the photographer's quota, not ours (2026-10-03).** The archive had failed every 3 h
  since 2026-09-30 on `events/2026/Melbourne/01_media/photos`. Drive had 2.2 TiB free and a 50 MB probe uploaded fine,
  but the six subfolders there are **owned by `ellahasdel@gmail.com`** (shared in), and uploads into them count against
  her full personal quota (`rclone lsjson -M --dirs-only` shows the owner). Fix: upload into a folder we own
  (`photos-bottb`). Dean's archive rule: Drive keeps what is needed to RECREATE a set (raw footage, all audio, production
  projects, Resolve project library), no finished renders (YouTube 4K is the master). `bottb-archive.sh` job lines
  now take a third field of per-line rclone filters; job `doc/archive-jobs/04-recreate-sources.txt`.
- **Canvanauts full-set handoff** written to `canvanauts-sydney-2025-fullset-handoff.md`. Its desk recording
  `DLIVE003.WAV` covers only 11:12 of a 21:33 set; the rest is on `BotB-001` (verify what those channels are).

## Sydney 2025 full sets: Canvanauts (2026-10-03, bottb-b2)

- **What the Canvanauts audio is (measured; full table in `canvanauts-sydney-2025-fullset-mix-brief.md`).**
  `Canvanauts.wav` (the 2025 full-set bounce, BWF 01:00:00:00) is **sample-locked to the MixPre `BotB-001`**
  (t=0 = BotB-001 3784.000 s); `DLIVE003` (desk) covers only bounce 621.18 s → end and drifts −13.5 ppm
  against the MixPre. BotB-001's four tracks (MixL, MixR, Mkh417, Mkh50; Dean: "4 ambient mics") all lock to
  the desk at **0 ms**, and Mkh417 ≈ MixL, Mkh50 ≈ MixR (r 0.98, ~4.7 dB hotter). So a MixPre/desk join needs
  no acoustic-delay correction. **MixL = 0.58 × Mkh417, MixR = 0.55 × Mkh50** (least-squares, cross terms ≤ 0.01,
  residual −13 to −16 dB): the Mix tracks are the MixPre's mix bus of its two mics, so the four tracks are two
  signals. Dean thought all four were independent; the decisive test (music, 10 s) gave MixL–Mkh417 and
  MixR–Mkh50 **r 1.000 in 100–1000, 4–8 k and 8–16 kHz at a constant 1-sample lag**, which independent mics
  cannot do (they decorrelate at HF). For "are these separate mics?" test HF-band correlation and lag, not
  full-band r. Dean: "let's just take mixl and mixr then" (the desk replacement for the first half). The bounce halves are already −14.3 / −14.4 LUFS.
  **(Corrected 2026-10-03, mixdown: `Canvanauts.wav` contains no desk anywhere.** It is MixL/MixR through the
  2025 mastering chain (`Project.logicx`, Logic 11.2.2, unreadable by logic-cli; window shot shows Bus 1 Multipressor/
  EQ/Comp/Ozone, Stereo Out Ozone 12 "Mastering") for the whole set, Anti-Hero included. My scan had shown the
  bounce sample-locked to BotB-001 at 800/1100/1250 s while the desk drifted, and I still wrote "the desk covers
  the second half" as if the bounce used it. **Where a source exists in time is not what a bounce is made of:
  the lock (which clock the bounce follows) says which source it is.** QC by mixdown: −14.37 LUFS, LRA 9.66,
  true peak −0.06 dBTP (the one failure against −1.0).)
- **"A different version" meant a cover** (Dean: "anti-hero is an as covered by version"), not a different
  take. The 2025 Anti-Hero delivery's audio places in the full-set bounce at 239.241 s, gain −0.01 dB,
  residual −25.7 dB (`align-mix` reads `different_version`: AAC plus the delivery's fade-out). Ask what a
  phrase means before building a test plan around it.
- **A whole-recording NCC search at 4 kHz peaked at 1.97 GB** (`/usr/bin/time -l`, 2 h × 1 channel,
  `oaconvolve` + float64 cumsum), where I had guessed "well under 1 GB" and did not announce it. Search
  short windows at predicted positions instead (the same check on 16 s segments peaked at 0.11 GB), or
  use `align-mix` (0.35 GB on a 3.65 h reference), and measure before calling a job light.
- **Project `Canvanauts` as found (2026-10-03):** unmanaged DaVinci YRGB (like Google; the reel project is RCM v2),
  `Timeline 1` 1920×1080 25p, 0–54331 (36:13), **one uncut multicam item** (`Canvanauts - Video 1`, the Audience
  angle) on V1 and one on A1: the full set has never been angle-cut. Media was offline: cameras moved from
  `/Volumes/Extreme SSD/Battle of the Bands/Video/Sydney 2025/Pro Footage/Footage/…` to
  `/Volumes/Battle Of Band 2025/Footage/<Wide|Chase|Audience>/…`, audio to `bottb/_TO_SORT_Audio/Sydney/Canvanauts/`.
  `MediaPool.RelinkClips(items, folder)` per camera folder, one call each, File Path read back (27 + 1). Cache
  location moved to `/Volumes/BOTTB/DaVinci/CacheClip` (Dean) with `SetSetting("perfCacheClipsLocation", …)`, read
  back; not yet confirmed by a cache write.
- **Bringing a song's cut from another project into the full set (2026-10-03):** in the song project
  `Timeline.Export(path, resolve.EXPORT_DRT)`; in the full-set project `MediaPool.ImportTimelineFromFile(path,
{"timelineName": …, "importSourceClips": False})`. With `importSourceClips False` all 77 cuts linked to the
  project's **existing** `Canvanauts` multicam (`GetUniqueId()` equal), no duplicate pool items. Strip the scratch
  timeline to V1 (`DeleteClips` on end card and audio), Dean Cmd+A / Cmd+C there, I `SetCurrentTimeline` + park the
  playhead at the song's multicam frame (record = multicam frame here, base item left offset 0), Dean Cmd+V. Read back:
  77/77 same multicam frame, angle, zoom, dynamic zoom; neighbours untouched. Anti-Hero = Timeline 1 frames 6511–12676
  (00:04:20:11–00:08:27:01). DRT kept at `events/2025/Sydney/02_Production/Canvanauts/`.
- **`GetProperty("Pan")` is not a stable read across timelines of different resolution.** The same 8 pasted items read
  +710.4 … (the 4K source values) in one call and +355.2 … (the same framing in 1920 px) a few calls later with no
  edit in between; the 4K scratch timeline's items did the same. Pan looks stored resolution-independent and reported
  in pixels of some current resolution. Don't "fix" pans from a read after a cross-resolution paste: compare framing
  on pixels (here, Dean's eye against the 2025 delivery frame). **Dean confirmed by eye (2026-10-03): the pasted pans frame the same as the 2025 delivery; no fix needed.**
- **Canvanauts master v2 (mixdown, 2026-10-03):** `03_Delivery/Canvanauts/Canvanauts_FullSet_Master_v2_at_01-00-00-00.wav`,
  the 2025 master with only the true peak fixed (0.32 % of samples, ≤ 1.02 dB). My QC: sha256 c5d19e7c… matches,
  62,051,666 samples = Canvanauts.wav, bext 172800000, −14.4 LUFS, LRA 9.7, TP −1.1 dBTP; null vs Canvanauts.wav RMS
  −65 dB, peak −19 dB. Not listened to by Dean. Expected position: wav sample 0 at multicam frame ≈ 530 (Anti-Hero 2025
  cut: multicam 6511 = wav 239.241 s); verify with a short render.
- **I answered Dean's choice for him (2026-10-03).** Mixdown had put "2025 master with the true peak fixed, or a new
  desk/MixPre mix?" to Dean. When he said "Get audio ready" I told mixdown to take the peak-fix path "if he hasn't
  picked", and it built Master v2. Dean: "Wait I wanted the mixdown first and then I'd apply ozone to master, what have
  you done?" **Dean masters himself (Ozone) after the mixdown; what mixdown hands back is an unmastered mix with
  headroom.** A go-ahead like "get audio ready" does not pick an option; when a peer has put a choice to Dean, relay
  his words without a default, or ask him which option he means.
- **`MediaPool.AppendToTimeline` moves the playhead to the end of what it appended** (2026-10-03: Master v2 TEMP on A2
  at 530–32849 left the playhead at 00:21:53:24 = frame 32849, while Dean was cutting and I had said it would not move).
  Before an append while Dean works, read `GetCurrentTimecode()`, and restore it in its own call straight after.
  Master v2 is on A2 "Master v2 TEMP" for cutting only (Dean: "We can put this on temporarily to cut"); the
  delivery audio will be Dean's own Ozone master of an unmastered mixdown.
- **Mixdown source (Dean, 2026-10-03): "combine Mix L and Mix R into a single stereo track we'll start from that. The desk
  only covers 2.5 songs so we'll just use this."** Made `02_Production/Canvanauts/Canvanauts - MixLR - full set_at_01-00-00-00.wav`
  with ffmpeg (`pan=stereo|c0=c0|c1=c1,atrim=start_sample=181632000:end_sample=+62051666`, `-write_bext 1 -metadata
time_reference=172800000`), 10 s, 9 MB peak. Bit-exact against BotB-001 ch1/2 at three points; 0-sample lag against
  Canvanauts.wav at five. Same span and clock as the 2025 bounce, so it drops in at 01:00:00:00.
- **Fade handles are scriptable on 21.1.1: `TimelineItem.GetFades()` / `SetFades({"FadeIn": n, "FadeOut": n})`** (frames;
  in the 21.1.1 stub and CHANGELOG, not in the MCP's stale 21.1 stub, and not in `GetProperty()`). The pasted Anti-Hero
  cut brought the 2025 ending with it: its last cut (12584–12676) had **FadeOut 91** (it faded into the old end card).
  Found by unzipping the exported `.drt` (`SeqContainer/*.xml`; `ElementTree` fails on `ListMgt::` tags, use regex):
  only that clip had an `EffectFiltersBA` holding 91.0. `SetFades` to 0/0, read back 0/0, playhead unchanged. When
  pasting a song's cut into a full set, check `GetFades()` on its first and last cuts.
- **Canvanauts measurement render (2026-10-03):** Dean cut the set (260 V1 items) and set In/Out 758–31183
  (00:00:30:08–00:20:47:08; Cyan RELEASE marker). Cut list 259 rows → gigstills `runs/canvanauts-sydney-fullset/`
  (angle → source from Project.db: each angle is ONE file in this multicam, Audience luca_1_9973 and Wide luca_2_9974 at
  multicam frame 3, Chase LUK-fx6-0004 at 0; the exported song `.drt` only carries the clips its range uses). Render
  `/Volumes/BOTTB/Renders/measure_Canvanauts_FullSet.mp4`, 1080p video only, 30,426 frames = In/Out exactly, **384 s**
  (Google's 1314 s set took 173 s: here memcheck said COMFORT ask, compressor 9.1 GB, and MultiPassEncode ran the
  percentage 0→100 twice; Dean said run it). In/Out survived the render, DeleteRenderJob and SetRenderSettings this time
  (read on Edit after each); still read it every time.
- **Song cards and set titles generated (2026-10-03):** `generate-song-overlays.ts --out` APPENDS `<Band>/Overlays` to the
  path you give (pass the event's `02_Production`, not the band folder). In a worktree whose `node_modules` pnpm wants to
  purge, call `./node_modules/.bin/tsx` directly instead of `pnpm tsx` (no TTY → ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY).
  Outputs in `02_Production/Canvanauts/Overlays/` (5 cards in DB order, `title-filmic.png`, `credits-filmic-nomembers.png`).
- **Canvanauts grade approved (Dean, 2026-10-03, after opening the sheet): "These look good. We'll do the FLC based on the
  google settings on the adjustment clip."** gigstills k0 recipe `runs/canvanauts-sydney-fullset/k0/` (136 moves, needs the
  Chase FX6 0.03 camera-match LUT on a group Pre-Clip first). Plan when Resolve reopens: Chase group + LUT → SetCDL (node
  graphs read first, esp. the 77 pasted Anti-Hero cuts) → V2-off verify render → Dean: Adjustment Clip on V2 with the
  Google FLC (titles on V3) → look-on render of the 28 Audience cuts → crowd lift re-fitted to the real look → titles.
- **Apply list (Dean, 2026-10-03: "drop them" for the tiny exposure tweaks):** `gigstills/runs/canvanauts-sydney-fullset/apply_final.json`,
  113 cuts = 136 moved − 17 exposure-only gains < 1.03 (none were composed into another move) − 6 unverified with moves
  (2, 50, 187, 193, 222, 224; the recipe says "measure, do not apply"). CDLs are the recipe's own `set_cdl`.
- **Canvanauts look (Dean, 2026-10-03):** Adjustment Clip on V2, 0–31183, FLC from the Google settings with "a few
  adjustments to FLC, pushed up richness and contrast back at 1.5" (Google: Contrast 1.3, Richness 1.2; exact new Richness
  not yet recorded). Contrast 1.5 is above Google's 1.3, whose toe already crushed 19 crowd cuts: the crowd lift must be
  fitted on a look-on render of THIS FLC, after the Chase LUT and the k0 CDLs are in. Timeline node graph: 0 nodes.
- **Dean switched the full set to colour management and 4K (2026-10-03), after the measurement render:** now DaVinci YRGB
  Color Managed v2, Rec.709 (Scene) in/timeline/out, SDR 100, DaVinci DRTs, colour-space-aware tools on, timeline
  3840×2160 (output 3840×2160). The k0 recipe was measured on the unmanaged render, so a Stage 0 check (short V2-off render
  vs the measurement render) is owed before SetCDL. Pan on cut 6859 now reads +710.4 at 3840 (355.2 at 1920 before): same
  framing, consistent with Pan stored resolution-independent and read in current-timeline pixels.
- ~~**"Overlit" here = lifted blacks (Dean, 2026-10-03):**~~ — CORRECTED 2026-10-03 (gigstills look report, below): with the k0
  CDLs in, the look crushes every floor and the "overlit" is the MID/HIGHLIGHT lift; my inference from "lowering contrast made
  it worse" was wrong. Original: after enabling RCM he said "It's looking a bit overlit", "Lowering
  contrast made it worst", and "the reason I lifted contrast was it _darkened_ blacks". With no clip corrections applied yet,
  the Chase pedestal (~0.03) and haze floors (~0.10) were being fought with global FLC contrast (1.5), which also crushes the
  already-black Wide and the crowd. Same complaint as Everlong's "hazy and overlit". The per-cut k0 offsets are the targeted
  fix; revisit FLC contrast after they are in.
- **In/Out found EMPTY with no render in between (2026-10-03).** Read 758–31183 after the Stage 0 restore; then (Dean in the
  UI, then away) AddTrack/SetTrackName/ImportMedia/AppendToTimeline (Master v3 on A3), SetTrackEnable(A2 off),
  SetCurrentTimecode, 113 × SetCDL, SetTrackEnable(V2 off) → `GetMarkInOut()` = `{}`. Cause not isolated. Restored from the
  RELEASE marker. Rule: read In/Out before every render setup, not only after renders.
- **Retime lock race:** I wrote heavy.lock in the same second retime's next `wd.py` started (its previous one had just
  exited). Check `ps` for their jobs immediately after writing the lock, and wait on any that slipped in.
- **Canvanauts titles built (2026-10-03):** Whisper (`openai/whisper-small.en` from `/Volumes/Supp1Tb/ai-models/hf`, gigstills
  venv, 60–70 s per slot, 40 s total, **1.11 GB peak**) named all five slots: played order = DB order this time (Are You
  Gonna Be My Girl, Anti-Hero, Valerie, I'm Still Standing, Don't Stop Me Now). Movies: `ffmpeg -loop 1 … -c:v prores_ks
-profile:v 4444 -pix_fmt yuva444p10le`, **1.7 GB peak at -threads 4, 1.27 GB at -threads 2** (4K 4444 frame threads).
  **Trap: `fade=t=in` without `alpha=1` on an rgba stream fades the ALPHA too**, so the opening started transparent. For an
  opaque card fading in from black use `format=rgb24,fade=t=in:…,format=rgba,fade=t=out:…:alpha=1`, and read alpha on frames.
- **AddTrack / ImportMedia / AppendToTimeline clear In/Out (seen twice, 2026-10-03).** Second time: In/Out read 758–31183
  after the verify-render restore; then DeleteRenderJob, AddTrack(video), SetTrackName, ImportMedia (8 title movs),
  AppendToTimeline (V3), SetProperty(CompositeMode) → `GetMarkInOut()` = `{}`, playhead at the end of the last append.
  Both incidents share AddTrack + ImportMedia + AppendToTimeline; not isolated further. Rule: after any of these, restore
  In/Out from the RELEASE marker in its own call and read it back.
- **Titles placed (2026-10-03), V3 "Titles":** opening 758–933; cards on Dean's song-start cuts: Are You Gonna Be My Girl 1307,
  Anti-Hero 7044, Valerie 13105, I'm Still Standing 18833, Don't Stop Me Now 25326 (125 f each); credits 30886–31086;
  `EndCard_2x.mov` 31086–31184 (ends on Out 31183), CompositeMode ADD read back 1. First notes (drum entries, 0.2 s):
  1250, 7035, 13050, ~18830, 25395; slot 5's card is on a cut 2.8 s before the first note (the next is 8.6 s late).
- **Measurement/look-on renders: set `MultiPassEncode: False` in `SetRenderSettings`** (the project has it on; the job dict reads
  it back as `MultiPassEncode`). With the FLC on, the 1080p full-set look-on render was at 15 % after 5 min, pass 1 of 2,
  ~55 min projected. `StopRendering()` took ~8 s to reach `Cancelled`; then DeleteRenderJob and re-queue single-pass.
  Put MultiPassEncode back to True afterwards for Dean's delivery render.
- **Canvanauts look-on render (2026-10-03):** `lookon_Canvanauts_FullSet_k0_V3off.mp4`, 1080p, V2 look on, V3 titles off,
  single pass: **1918 s for 1217 s of programme (1.6× real time)**, so the FLC on an adjustment clip is the cost, not the
  CDLs (the look-off verify render of the same range took 397 s). Deliver settings restored and checked via a throwaway
  job: 3840×2160, MultiPassEncode True, audio on, `Canvanauts_FullSet`, In/Out 758–31183.
- **Pre-render checklist, Canvanauts (2026-10-03):** colour group "Chase FX6" carries only the camera-match LUT (no
  Deflicker/NR nodes to toggle); 79 zoomed cuts Orange (read back); `superscale.py` VALUE=2 → 27 camera clips (MP4+MXF);
  timeline already 3840×2160 (RiP bakes at timeline res). Waiting on Dean: RiP of the 79 Orange cuts (Video Effects ON,
  Color Grading OFF) into /Volumes/BOTTB/Renders, then Super Scale 1, halation.
- **Canvanauts look measured (gigstills, 2026-10-03; `gigstills/runs/canvanauts-sydney-fullset/look/`):** per-angle transfer
  from the look-off verify / look-on pair (offset 0, 563 cut boundaries aligned). Contrast 1.5 toe: everything below ~0.08 →
  black (0.06 → 0.0016; Google's 1.3 mapped 0.098 → 0.038); p10 = 0 on 190 of 259 cuts. Mids lift: lit subject Wide
  0.563 → 0.693, Chase 0.502 → 0.554, Audience 0.576 → 0.702. Clipping 0.0135 → 0.0079. **"Overlit" = the mids/highlights
  lift**: the Wide's lit stage wash rises ~10 L\* while Lab chroma falls ×0.25 (near-white); highlights 0.7–0.98 go yellow
  (chroma ×1.7–2.1); blue-violet rotates 15–23° toward blue; Chase neutral mids pick up a yellow-green tint (chroma 0.8 → 5.6
  at 117°). Use per-angle curves: the pooled curve hides the Wide +0.13 vs Chase +0.05 difference.
- **Crowd lift under Contrast 1.5:** 25 of 28 Audience cuts crushed (p50 0.131 → 0.037). Lift A (Offset o 0.065–0.085, white
  held, Power 0.94–1.00) restores p10/p50 within 0.016 of look-off but raises p90 a median +0.06 (max +0.12); lift B (p90
  capped +0.03, Power ≤ 1.3) holds highlights, p50 a median 0.027 under. Both in `crowd_lift_final.json`; Dean's pick, and it
  should be re-solved if he changes the FLC. Not applied.
- **Dean picked crowd lift B (2026-10-03): "Actually looking again B is the best"** (p90 capped +0.03), after the A/B montage.
  Held, not applied: Dean is adjusting the FLC next (suggested Contrast 1.5 → 1.3, Highlights 0.65 → ~0.50, Exposure −0.2 to
  −0.3 stops last, optional Fade ~0.1; manual p.3562: Exposure is in stops, Highlights/Fade shape the S-curve's top/bottom).
  Re-solve B on a fresh look-on render of the 28 Audience cuts once the look is set, then apply.
- **"The FLC seems to have gone from the adjustment clip?" (Dean, 2026-10-03): it hadn't.** The playhead was at the In
  (00:00:30:08), under the opening title on V3, and the Color page shows the top clip's graph (`GetCurrentVideoItem()` =
  `00-opening-filmic.mov`, V3). The V2 Adjustment Clip read 2 nodes, node 2 `OFX: Film Look Creator`. Same family as Google's
  "everything is black" (playhead on the opaque opening card). With titles on V3, park the playhead outside the cards
  (or select the V2 clip in the Color page strip) before look work.
- **Canvanauts FLC as set by Dean (screenshot, 2026-10-03, after the look suggestions), V2 Adjustment Clip node 2:** Film Look
  Blend 1.000, Core Look Aurora, Skin Bias 0.200 | **Exposure −0.25**, **Contrast 1.300**, **Highlights 0.500**, Highlight
  Rolloff 0.250, **Fade 0.100**, Fade Rolloff 0.500, White Balance 7000, Tint 10.0, Subtractive Sat 1.200, **Richness 1.300**,
  Bleach Bypass 0.000 | Split Tone on, Natural (rest below the screenshot). Output White Point D65 (the default; manual
  p.3561: only matters under Color Space Overrides, i.e. display-referred use). The crowd lift B must be re-solved on this look.
- **FLC Tint +10 was not a choice (Dean, 2026-10-03: "i think it was the default").** Consistent with the reel's FLC on Core Look
  Cinematic reading Tint 0.0: +10 likely comes with Aurora/its preset. It is the magenta side (Google measurement) and small;
  on Canvanauts it leans against the look's yellow-green on Chase neutral mids, so it was left at +10. The house default
  (Brisbane grading structure) is Tint 0. Check FLC defaults per Core Look before attributing a value to anyone.
- **RiP vs a colour group (Canvanauts, 2026-10-03) — corrects "RiP bakes … the group pre-clip".** Dean RiP'd the 79 Orange cuts
  (Video Effects on, Color Grading off) → `/Volumes/BOTTB/Renders/Canvanauts - Video N Render M.mov` (ProRes 422 10-bit 4K).
  All 79 became Video items; clip CDLs intact (113/113 read back). The one Chase cut among them (245, 28906–29186) **left the
  "Chase FX6" group (114 → 113 members) and its RiP file has NO pedestal fix** (luma p0.1 0.0398 = the model's raw 0.0401,
  not matched 0.0104): the group Pre-Clip LUT was not baked. Fixed by `AssignToColorGroup` on the RiP'd item (back to 114,
  LUT live on top). Rule: after a RiP, re-assign group membership and verify on pixels. Also: **while the RiP dialog runs,
  `GetCurrentPage()` is None and `GetToolsInNode(1)` read empty on all 113 graded cuts** — a modal makes reads lie; ask Dean
  whether a dialog is open before believing a "lost grades" read. Super Scale back to 1 on 27 camera clips after the RiP.
- **Canvanauts crowd lift B applied (2026-10-03):** 24 cuts (`crowd_lift_B_final.json`, log `applied_crowdB.json`), composed on k0
  for 40/51/56/127/167; some targets are RiP'd Video items (SetCDL works on them). Verify on the delivery render.
- **Canvanauts 4K delivery v1 started (2026-10-03 ~22:3x), Dean: "Yep halation is on. Let's render. Remember we need 4k only as
  this is just going to YT."** Job a6dda951: `/Volumes/BOTTB/Renders/Canvanauts_FullSet_Sydney2025_4K_v1.mp4`, 758–31183, H.264
  3840×2160, VideoQuality 45000 (job dict reads None, as on Google), MultiPass on, AAC 320 / 48 k (AudioBitRate reads None), A3
  "Master v3 FINAL" only, look on the V2 adjustment clip, titles + end card on V3. No 1080p copy for this set (YouTube only).
  memcheck COMFORT ask (cheap 3.2 GB, compressor 10.4 GB, swap 9.1/10 GB); Dean said render. heavy.lock held, retime told.
- **Dean (2026-10-03, during the Canvanauts 4K render): "In future let's not bother with the multipass option."** Rule: every
  render, delivery included, goes with `MultiPassEncode: False` (set it in `SetRenderSettings`, read it back from the job).
  The project default had it on; turn it off in the Deliver settings after any render that used it.
- **Canvanauts 4K v1 rendered (2026-10-03 22:2x–23:24): 3808 s for 1217 s (3.1× real time) WITH multipass** (pass 1 ≈ 33 min, pass 2 ≈ 30 min;
  the pass-2 ETA first read 12 h). 6,896,812,068 bytes; render-qc PASS (30426 frames, audio Δ 0.05 s, 45.0 Mb/s); AAC LC 320/48 k,
  −13.9 LUFS, TP −0.8 dBTP; audio = Master v3 at 228.0 frames (same_mix, r 0.9997). Crowd B on pixels: median Δ ≈ 0, 22/24 within 0.03;
  cuts 40 and 160 (both dynamic-zoom, RiP'd) brighter than predicted at p90 (+0.13/+0.10). After the render, two trivial run_script calls
  (DeleteRenderJob; SetRenderSettings MultiPassEncode False) timed out, and so did a one-line read: playback or a dialog. State of those
  two calls unknown until Resolve answers.
- **Dean on v1 (2026-10-04): "the Canva logo looks a bit pixelated, and the guitars sound a bit muted, maybe compressed, but that may have
  been there before."** Logo cause: Canva's `logo.svg` (Blob) declares `width="80" height="30"`; @napi-rs/canvas `loadImage` rasterises an
  SVG at its declared size, so both title scripts drew an 80×30 bitmap scaled up to 4K. Fix (uncommitted, worktrees): `loadSharp()` in
  `generate-song-overlays.ts` (canvanauts-reel-notes) and `generate-set-titles.ts` (filmic-set-titles) rewrites the root svg width/height so
  the long side is 2400 px (viewBox kept) before loading. Regenerated into `02_Production/Canvanauts/Overlays-v2/` (`*_v2.mov`); A/B crop
  confirms sharp edges. Any band whose logo is an SVG with a small declared size had the same problem. Guitars: render = master to −32 dB,
  so it is in the mix; passed to mixdown with Dean's words.
- **Chapter markers go JUST BEFORE the first transient (Dean, 2026-10-04: "make sure all these are just before the transient so the
  note does not get cut off").** Method: 10 ms RMS on the master around the song start, first block ≥ 9 dB over the median of the
  preceding 300 ms and ≥ 6 dB for 60 ms; marker = floor(transient frame) − 5 (0.2 s). Canvanauts: 1245, 7007 (Dean said 7011,
  transient 7012), 13043, 25387 (soft piano, +12 dB); ~~I'm Still Standing open: transient 18833 (00:12:33:08, where Dean's cut is)
  vs Dean's 00:12:34:22~~ (corrected same day: 18833 is a short hit that decays to −50 dB silence; the song enters at 18874.5,
  so Dean was right, marker 18869). Don't Stop Me Now: Dean 00:16:53:01, onset 25327.5 after −46 dB silence, marker 25322 (my
  window started after that onset and found a louder entry 2.6 s later). **Detector rule: the transient must be followed by
  sustained level (≥ 1 s), and the search window must start ≥ 3 s before the candidate.** Dean confirmed song 1 and gave Anti-Hero 00:04:40:11.
- **Canvanauts v2 (2026-10-04):** Resolve crashed after v1 (the timeouts); everything saved survived (113 + 24 CDLs, group 114 + LUT,
  Super Scale 1, titles, markers, In/Out). 79 Orange cleared (`ClearClipColor()`, read back). Titles swapped to the sharp-logo v2 files with
  `MediaPoolItem.ReplaceClip()` on the 7 Titles-bin items (positions, lengths, end-card ADD unchanged). Chapter markers moved to just before
  the transients (1245, 7007, 13043, 18869, 25322). **Dean's audio fade:** he cut A3 at the Out (31183) and put a 287-frame FadeOut on
  the first piece (over credits + end card), "I trimmed the clip". The cut left a second piece starting AT the Out frame, which the
  inclusive Out would have rendered as 1 frame at full level: disabled it (`SetClipEnabled(False)`). After any razor at the Out, check
  the next piece. Render v2 job b94eaa8d single pass (`MultiPassEncode` False read back), Dean: "Let's make sure we don't double render" /
  "double pass I mean".
- **Canvanauts 4K v2 rendered (2026-10-04): 1821 s single pass (1.5× real time; v1 multipass 3808 s).** 6,887,837,009 bytes;
  render-qc PASS (30426 frames, audio Δ 0.07 s, 45.0 Mb/s), AAC LC 320/48 k, −13.9 LUFS, TP −0.8 dBTP; Master v3 at 228.0 frames
  (same_mix, r 0.9997); tail fades −39 → −64 dB over the last 5 s and the last frame reads −105.7 dB (no blip from the disabled tail
  piece); Canva logo sharp on a rendered card frame. Queue emptied, project saved, In/Out intact. v1 superseded.
- **Canvanauts 4K v3 = v2 video + Master v4 (2026-10-04).** Dean via mixdown: "replace the old master with this one if it passes qc and
  remake the splice and fade so we can recreate." v4: sha 41900f57…, same length/bext as v3, −14.0 LUFS, TP −1.6, 0 samples vs v3
  (different_version: +1 dB 500 Hz–1 kHz for guitars, −0.6 dB trim). `splice-mix.sh v2.mp4 v4.wav 9.12 v3.mp4 11.52` (fade = Dean's
  287-frame Resolve fade + the silent Out frame): 118 s, 1.6 MB peak; video md5 identical; render-qc PASS; −14.0 LUFS, TP −0.9;
  align-mix vs v4 228.0 frames same_mix r 0.9997. ffmpeg's linear `afade` tracked Resolve's fade-handle curve within ~1 dB (0.5 s
  blocks over the last 13 s), so splice-mix's fade is an adequate stand-in for a Resolve fade handle. **Timeline not yet updated:**
  Resolve was closed when I went to add A4 "Master v4 FINAL" (530 → 31183, FadeOut 287, A3 disabled); do that next session so the
  project recreates v3.
- **Canvanauts handover state (2026-10-04 ~09:50):** Dean: "all the starts are okay" (chapters 0:19 / 4:09 / 8:11 / 12:04 / 16:22, credits
  20:05, from the render start). Thumbnail: Dean's first export read "…Tech Bands 2026" for a 2025 show; flagged, re-exported as
  `03_Delivery/Canvanauts/canvanauts-sydney-battle-of-the-tech-bands-2025-youtube.jpg` (the 2026 one in `_superseded/`). **Read the text
  on a thumbnail before handing it over.** Social agent (bottb-5b) asked for the facts for a draft and got them; Dean has not yet
  approved v3 to me, v1/v2 not yet moved, and v4 is not yet on the Resolve timeline (Resolve closed).
- **Canvanauts closed out (2026-10-04, Dean: "1. Yes. 2. Delete 3. Yes").** v3 approved for YouTube and handed to the Social agent
  (bottb-5b) with Dean's words; v1/v2 deleted at his word (only `…_4K_v3.mp4` remains). Resolve relaunched: new A4 "Master v4 FINAL",
  v4 appended 530 → 31183 (`endFrame` = 31183 − 530, so no tail piece), `SetFades({"FadeOut": 287})` = A3's fade read back, A3 disabled
  (A1/A2 already off), In/Out restored (the append cleared it again), saved. The timeline now matches v3's audio; not re-verified by a
  render. Placing a mix straight to the Out with `endFrame` avoids Dean's razor-and-leftover-piece trap.

## Sydney 2025 full sets: Jamazon (Amazon) (2026-10-04, bottb-b2)

- **Project `Jamazon` as found:** unmanaged DaVinci YRGB, 1920×1080 25p, cache already external (`/Volumes/Extreme SSD/DaVinci/CacheClip`).
  `Timeline 1` held ONE multicam item, record 0–4451 = multicam 19410–23861: the uncut base of the APT song project, not
  the full set. Multicam `Jamazon` is 39,984 frames (26:39:09). Same camera layout and the same offline paths as Canvanauts:
  `RelinkClips` per folder (6 folders × 9, cameras + THMBNL), plus `Jamazon - Remix.wav` → `_TO_SORT_Audio/Sydney/Jamazon/`.
  55/55 read back.
- **The multicam's audio angle is `Jamazon - Remix.wav`, wav frame 9690 (In) at multicam frame 0** (Project.db `Sm2TiItem`:
  Start 90000 = 01:00:00:00, Duration 39984, In 9690, MediaStartTime 3600.0). The mixdown master shares the Remix's clock (bext
  01:00:00:00, lag 0), so it goes on at record 0 from master frame 9690. Read Project.db first instead of correlating.
- **Song cuts brought across by DRT, as on Canvanauts** (`02_Production/Jamazon/Jamazon {APT,Umbrella} 2025 cut.drt`, both 2025
  projects RCM v2 at 3840). APT: 43 V1 cuts, multicam 19410–23861, last cut FadeOut 82. Umbrella: 47 V1 cuts, multicam
  14404–19421, last cut FadeOut 17, **plus 7 phone inserts on V2** (Scott Warren's phone `20251023_212521.mp4`, Dean iPhone
  `IMG_1139/1140.mov`, 30 fps, now under `events/2025/Sydney/01_Media/Video/`) and a zoomed multicam overlay on V3 (1979–2127).
  The inserts are not in the full-set pool: import them first, then `ImportTimelineFromFile(importSourceClips False)` links
  everything (multicam UniqueId equal, nothing offline). Umbrella's tail overlaps APT's head by 11 multicam frames; paste
  Umbrella first, then APT.
- **`Timeline.DeleteClips` returns False and deletes nothing on a timeline that is not current** (the APT scratch, current
  after its import, worked; the Umbrella scratch failed until `SetCurrentTimeline`). Make the timeline current first.
- **Full-set timeline built new:** `MediaPool.CreateTimelineFromClips("Jamazon - Full Set", [multicam])` puts the whole
  multicam at record 0 = multicam frame 0 (start TC 00:00:00:00), so a pasted song lands at its own multicam frame.
- **Audio-only verify render:** `SetCurrentRenderFormatAndCodec("wav", …)` has no codec to name (`GetRenderCodecs("wav")`
  is `{}`) and fails, leaving MP4/H.264 with AAC and MultiPassEncode on. Use `mov` + `ProRes422P` (video codec names are
  the dict VALUES: `ProRes422P`, not `ProRes422Proxy`) with `ExportVideo False, AudioCodec "lpcm"`. `StartRendering` returned
  None with the job Ready and `GetCurrentPage()` None: a modal dialog was open (see "Settings calls return None").
- **Both cuts pasted by Dean (2026-10-04), read back:** Umbrella 47 + 7 + 1 and APT 43 items match their source cuts exactly at
  record = multicam frame (angle, start/end, left offset, ZoomX, DynamicZoom, fades); Umbrella's last cut now ends at 19410
  (APT's head), the multicam neighbours are untouched (0–14404, 23861–39984). V1 = 92 items.
- **A queued render job went stale:** queued while Dean was playing (StartRendering None), it still returned False after
  playback stopped, with the job Ready and the timeline's In/Out found EMPTY (the pastes, or the playback, cleared it). Delete,
  `SetMarkInOut`, re-queue, start: it ran (3 s). Re-queue rather than retry a job that refuses to start.
- **Master v2 placement verified bit-exact:** 120 s audio-only render of record 18000–20999 vs the master at
  (18000 + 9690)/25 s: lag 0 samples, r 1.0, gain 1.0, residual −224 dB. `align-mix --bounce <render> --ref <master>` REFUSED
  it ("no unique placement", onset ratio 1.02 between +548.68 and +498.04 s): on a 120 s excerpt of a repetitive song the
  onset lane is ambiguous. For a render cut from a known file at a known position, null-test at the expected offset instead.
- **Alexa reel → full set (2026-10-04):** the 9:16 reel (`Jamazon - Alexa - Short`, 2160×3840) was reusable for cut points and
  angles only: its V1 is continuous real time (record + 1258 = multicam frame) up to the looped teaser shot at the end
  (multicam 1195, from BEFORE the reel's start). Stripped before Dean copied: 2 subtitle tracks (`Timeline.DeleteTrack("subtitle", k)`;
  Dean: "we don't want the subtitles"), the vertical split screen (V2 multicam cropped/tilted over V1), the teaser + Cross
  Dissolve, the vertical phone inserts IMG_1122 (1080×1920; Dean: "Drop the vertical phone"), audio; framing reset on all 13 cuts
  (Zoom 1, Pan/Tilt/Crop 0, DynamicZoom off). **`ImportTimelineFromFile(importSourceClips False)` linked one IMG_1122 item to
  IMG_1139** (another phone clip already in the pool) and created offline pool items for the reel's audio: read every
  imported item's media name, not just "nothing offline". Dean then re-cut the section himself.
- **Whisper names slots AND finds where banter ends; the transient detector does not** (2026-10-04). Five of the seven quiet
  gaps in the master were talk ("technical difficulties", "turn to your workmates", the "love" sing-along), and the runbook
  detector (≥ 9 dB over the preceding 300 ms, sustained 1 s) fired on speech before every song. Method that worked: Whisper with
  `return_timestamps=True` on 40 s windows → the last spoken line → then per-frame (40 ms) level and the 40–180 Hz band for the
  band's entry. Whisper small.en peaked at **1.57 GB** on 7 × 40 s windows (1.18 GB on 4), not the 1.11 GB measured on
  Canvanauts: gate it as ≥ 1.5 GB. `/usr/bin/time -l bash script.sh` reports the shell's own footprint (2 MB), not ffmpeg's.
- **Dean's A2 fade (FadeOut 199) left a second A2 piece starting AT the Out (38753)**, as on Canvanauts: disabled it
  (`SetClipEnabled(False)`, read back). Track layout here: V1 cut, V2/V3 Umbrella inserts, **V4 "Adjustment"** (empty, for Dean's
  FLC clip, above all picture), **V5 "Titles"**. Titles: opening 1062, cards on Dean's cuts (Jump 1919, Tainted Love 9137, Umbrella
  14404, APT 19410, Stand By Me 26393, Somebody to Love 33379), credits 38456–38656, EndCard_2x 38656–38754 ADD. Jump card title
  "Jump Medley" (Dean) via a one-off run that appends "Medley" for `song_type = 'medley'`; the medley credits line comes from the DB.
  Chapters (Mint): 1946, 9143, 14399, 19416, 26388 (Dean: Stand By Me from 00:17:35:18), 33278.
- **A render job that will not start, even from the UI (2026-10-04).** `StartRendering` returned False for a queued
  measurement job (Ready, right timeline and In/Out, single pass); Dean's Render All did nothing; no dialog; ResolveDebug.txt
  logged nothing. A Resolve restart did NOT fix it: the stale job survived the restart. **Delete the job and AddRenderJob a new
  one, then StartRendering in the same call** → rendered (37,692 frames = In..Out, 3 min 52 s at 1080p, V2/V3/V5 off).
- **`SetTrackEnable(True)` returned True and read back False on the Deliver page** right after the render; the same calls
  after `OpenPage("edit")` stuck. Read the track state back after every enable/disable, and do track changes on Edit.
- **Pasted song cuts brought their 2025 grades, and the API under-reports them (2026-10-04).** gigstills' render-vs-camera-
  original check found every checkable APT cut graded (gain ×1.07–1.20, sat ×1.03–1.15), yet `GetToolsInNode(1)` listed NO tools
  on any APT cut; it listed Primary Balance/Offset/Sat on 16 Jump/Umbrella cuts. Dean chose to re-grade evenly ("2"):
  `TimelineItem.GetNodeGraph().ResetAllGrades()` (21.1.1) on all 101 V1 cuts in the pasted ranges, each read back 1 node / no tools;
  re-measured (`measure_Jamazon_FullSet_v2.mp4`, 4 min 11 s) so the pixels confirm it. Before applying a recipe to pasted cuts,
  check them on pixels, not with GetToolsInNode.
- After that render, `OpenPage("edit")` + SetTrackEnable + DeleteRenderJob + SaveProject in one call timed out at 30 s with the page
  still Deliver and the tracks still off; the same steps one per call went through. One state change per call, as the skill says.
- **Adjustment Clip by script: insertable, not sizeable (2026-10-04).** `Timeline.InsertGeneratorIntoTimeline("Adjustment Clip")`
  works (21.1.1, tested on an empty scratch timeline) but places the 125-frame default at the playhead, and the API has no
  SetStart/SetEnd/SetDuration on items. A full-set look clip still needs Dean to stretch it in the UI; the FLC itself is UI-only.
- **`memreg … critical --ttl 30m` on Resolve outlives the render** (the pid is Resolve itself, so it never exits). mix-assist-b8
  held a 3.8 GB job waiting on my stale entry ~20 min after the render finished. `memreg rm <pid>` as soon as
  `IsRenderingInProgress()` is False, in the same step as releasing heavy.lock.
- **The APT grade was a COLOUR GROUP, imported with the DRT (2026-10-04).** After `ResetAllGrades` gigstills still measured all
  checkable APT cuts graded (identical numbers). All 43 APT items were members of **"Concert - Base"**, a group brought in by
  `ImportTimelineFromFile` from the 2025 APT project, whose Group Pre-Clip held Primary Balance, Sat/Hue/Lum, Log, Custom Curves and an
  HSL qualifier. Clip-level reads (GetToolsInNode) and ResetAllGrades never see a group grade. Fix (Dean's "re-grade evenly"):
  `item.RemoveFromColorGroup()` on the 43, read back `GetColorGroup()` None. **After importing any song DRT, list
  `project.GetColorGroupsList()` and each pasted item's `GetColorGroup()`**; a pasted cut can also not join the Chase FX6 group
  while it sits in another. Phone inserts (V2) and the V3 split overlay: no group; reset to ungraded on gigstills' advice.
- **Jamazon grade applied (2026-10-04, Dean away: "I will take your and gigstills recommendations").** gigstills v3 (measured on
  `measure_Jamazon_FullSet_v3.mp4` after the APT group removal): "Chase FX6" group + `canvanauts_chase_fx6_pedestal_cdl.cube` on its
  Pre-Clip (FX6 0006 has the same ~0.03 pedestal as 0004), 112 Chase cuts assigned; 109 SetCDL (Chase 87, Wide 20, Audience 2; 11
  "measure, do not apply" skipped; 4 exposure gains < 1.03 dropped), all targets read 1 node / no tools / no group first; phone
  inserts re-solved from ungraded (4 CDLs; split phone half and V3 overlay no move). Verify renders (look off):
  `verify_Jamazon_FullSet_k0_lookoff.mp4` (V2/V3 off) and `verify_Jamazon_inserts_k0.mp4` (16300–18599, V2/V3 on).
  Ungraded iPhone HLG through RCM v2 Rec.709 (Scene) reads lifted blacks (p0.1 0.075–0.17): the 2025 grades had hidden it.
- **Verify (gigstills, 2026-10-04):** 109 CDL cuts within 0.010 of the k0 model (median +0.001), 25 LUT-only Chase within 0.003, 120
  untouched within 0.001; inserts on prediction except V2@16798 (p10 +0.020: per-channel offsets + Power 0.9 + Sat 1.05 runs ~0.01–0.02
  brighter than numpy in deep shadows). **Split screen at 16383 is THREE panels**: phone (V2) left, V1 Wide cut 103 in the middle
  (x < 1306 at 1920), V3 Wide overlay right, the same Wide image continuous across the edge. Grading cut 103 alone made a seam;
  fix = the same CDL on the V3 overlay (Slope 1.0098, Power 0.85), checked on a 6 s render: row step across x=1306 0.124 ungraded →
  0.145 → 0.130. Give continuous panels from one camera identical CDLs; read a split's layout on pixels before measuring it.
- **Jamazon look (Dean, 2026-10-04):** Adjustment Clip on V4 0–39984, node 2 `OFX: Film Look Creator` (read back), carried from
  Canvanauts via a PowerGrade still (Color page → Gallery → Album button → PowerGrade album at the bottom; manual pp. 3341–3342).
  Change: **Film Look → Skin Bias 1.0** (Dean: skin tones "really grey/green and bad - it's partly the lighting but it did help").
  Skin Bias −1 warmer/darker/more saturated … +1 rosier/brighter/less saturated (manual p. 3561; there is a second Skin Bias under
  Color Settings). Context: gigstills measured the Canvanauts FLC adding a yellow-green tint to Chase neutral mids (chroma 0.8 → 5.6
  at 117°), which is where skin sits; under green stage wash the two stack. Remaining green faces: per-shot skin qualifier.
  Halation Radius 4 → 3 (Dean: halation "a bit much" when a spotlight is on the crowd; FLC halation has no threshold — the standalone
  Halation ResolveFX after the FLC has Threshold/Normalization/View Isolated Regions, manual p. 3565).
- **Jamazon look-on render** (`lookon_Jamazon_FullSet_review.mp4`, 1080p + AAC, titles off): **42.5 min single-pass** with the FLC on
  (look-off renders took ~4 min). Waited on it with a background python using `DaVinciResolveScript` (RESOLVE_SCRIPT_LIB =
  fusionscript.so) polling `IsRenderingInProgress()` every 30 s, instead of 40 MCP polls. Crowd lift B (gigstills, Dean's pick)
  applied: 21 Audience cuts, all onto identity (pre-checked: 1 node, no tools, no group), 21/21 True, log
  `gigstills/runs/jamazon-sydney-fullset/applied_crowdB.json`; cut 106 unmeasured (fully under the V2 insert at 16798).
- **"Grey/green skin" on this set is the stage wash, not the look** (gigstills: lead singer's skin hue 300–320° already with the look
  off vs the ~45° skin line; the look moves it +1°, chroma ×0.93). Fix = per-shot skin qualifier (Dean's UI move), not the FLC.
  Face clipping under the look tracks the big k0 gains (cut 40, Slope 1.6). Ranked list: `look/skin_rank.html`.
- **Harsh-face fixes applied (Dean: "Yes, these are good", 2026-10-04):** gigstills `look/harsh_fix.json`, node-1 CDL replaced on
  cut 40 (k0 Slope 1.6 → 1.2, Power 0.85; face clip predicted 0.126 → 0.013, frame p50 0.060 → 0.032, i.e. darker), 203 (haze CDL
  composed with soften Slope 0.92 / Power 0.95; face clip 0.417 → 0.018), 247 (soften; 0.040 → 0.0004). 191 left: only 0.6 % face
  clip, fix optional. Each target read 1 node first; playhead untouched while Dean worked shot 1. Face needs its own look model:
  a whole-frame transfer predicted 1 % face clip on cut 40 against 13 % actual (Skin Bias 1.0 treats skin separately).
- **Skin-qualifier walk-through (Dean in the UI):** the V4 adjustment clip is the top item at every playhead, so on the Color page
  Dean must click the V1 thumbnail to grade the cut itself; skin fix = serial node after node 1 (CDL), HSL qualifier on the face,
  gamma toward red/orange, sat +10–20. Shots (lead singer, Chase): 00:10:33:17, 00:11:32:22, 00:11:41:07, 00:12:30:22, 00:12:39:07,
  00:12:47:17, 00:14:00:12, 00:18:56:12 (worst), 00:20:06:02, 00:20:19:17.
- **Same-angle jump at 00:09:36:04 (Dean spotted it, 2026-10-05):** Umbrella's pasted first cut (Wide, dynamic zoom) followed Dean's
  own static Wide cut on continuous footage, so the cut read as a zoom jump. Finder: adjacent V1 items with the same multicam
  angle name and continuous left offsets (4 found; only 14404 differed, in DynamicZoomEnabled). Dean merged them into one Wide cut
  with a bigger dynamic zoom; the survivor carries the first piece's k0 gain 1.224 across the whole shot (second piece had none).
- **Jamazon RiP set and Face Refinement (2026-10-05):** Dean used Face Refinement (OFX on a serial clip node) on 57 cuts. A face
  track is stored data in source space, so a zoomed cut RiP'd with Color Grading OFF would put the live track on the reframed
  picture: the 2 zoomed+face cuts (7825, 34714) were left OUT of the RiP (live zoom, standard scaler). Unlike a Depth Map/AI key,
  which recomputes on the RiP'd picture, a track does not. RiP set = 61 zoomed V1 + 5 phone inserts on V2 (1080p sources; Super
  Scale 2 set by hand on the iPhone `.mov`s, which `superscale.py` skips). The V3 split overlay stays out: baking its crop into an
  alpha-less ProRes would black out the phone panel under it. Result: 66 RiP'd (`/Volumes/BOTTB/Renders/<clip> Render N.mov`),
  transforms baked, 33/33 graded clips kept node 1, no Chase cut in the set (group intact), Super Scale back to 1 on 30 sources.
- **A Cancelled render was Dean, not a fault (2026-10-05).** The 4K v1 job read `Cancelled` at 2 % and ResolveDebug.txt showed
  "Failed to Encode Frame, codec avc1" then "Recording cancelled after 1025 frames"; I read that as an encoder failure and re-queued.
  Dean had pressed Stop to fix a shot. The encode errors are Resolve's own side effect of a user cancel. A `Cancelled` status means
  ask Dean before re-queuing; only `Failed` is a fault.
- **A pan outside the zoom, invisible to the API (2026-10-05).** Audience cut 1848–1919 (00:01:13:23, just before Jump) had a keyframed
  right-to-left pan from the 9:16 Alexa reel, leaving up to 30 % of the frame black on the left; `GetProperty("Pan")` read 0 (the
  keyframes / Color-page Input Sizing are not exposed, and `ResetAllGrades` does not reset Input Sizing). Found on pixels: one frame
  per cut from the look-off measurement render, full-height or full-width exact-black bands (≤ 2/255) ≥ 10 px of 480 on a side.
  Wide shots' dark stage floor trips the bottom edge; ignore bottom-only hits on the Wide. Dean removed the keyframes; a 3 s render
  confirmed 0 px. Run this scan after pasting any cut from a reel or another aspect ratio.
- **I overrode Dean's instruction to a peer (2026-10-05).** retime told me Dean had said "render it" (run alongside my render); I
  asked retime to hold its 2.9 GB parity job until my render finished anyway. Dean: "No I told it not to wait … paging is okay."
  When a peer reports Dean's go-ahead, don't add my own conditions on top; only the SAFETY gate is mine to insist on.
- **Jamazon 4K v1 delivered to QC (2026-10-05 15:27):** `/Volumes/BOTTB/Renders/Jamazon_FullSet_Sydney2025_4K_v1.mp4`, 8,528,635,251
  bytes, 3840×2160 H.264 44.9 Mb/s + AAC 320, 1507.68 s, **2743 s render for 1508 s (1.8× real time) single pass, with the FLC
  and 57 Face Refinement nodes**, retime's NOK jobs running alongside. render-qc PASS (37,692 frames = 1062..38753); audio vs
  Master v2 lag 0–1 samples, r ≥ 0.9995; −13.8 LUFS, LRA 7.7, **true peak −0.4 dBTP** (master −1.0; AAC overshoot, as mix
  assist predicted −0.6). Handed to the Social agent (bottb-5b) marked not approved, thumbnail not made, chapters 3 and 6
  unconfirmed. Post-delivery: queue cleared, custom name reset to the timeline name, 66 Orange marks cleared, saved. Not done:
  halation off (UI; only matters for playback).
- ~~**Read the DB `song_type` before placing a chapter (2026-10-05).**~~ — CORRECTED same day (Dean: "Chapter 3 start where the card is is good. I already checked that"): the chapter stays at the Umbrella card (marker 14399, card 14404). Still read `song_type` for the chapter TITLE (transition → both songs); the start is Dean's ear. Original: Jamazon slot 3 is a `transition`: "If You Were the Rain"
  (Stephen Day) into Umbrella (`transition_to_title`), and the card says "opening with …". I had pinned chapter 3 to the Umbrella
  cut (00:09:35:24) and flagged "music from ~00:09:18" as a puzzle; Whisper then showed banter ("Yes, we've got keys!" 00:09:06,
  "…I can't do this next week without him" 00:09:20) with keys sustained under it, so the slot starts between ~00:09:23 and the
  Umbrella cut. For medley/transition/mashup slots the chapter starts at the FIRST song of the slot. Dean to pick by ear.
- **Jamazon closed out on my side (2026-10-05):** Dean uploaded v1 to YouTube himself (`S6eEJRm5Lp8`, BotTB channel) and added the
  thumbnail; chapters all confirmed (Dean: "SOmbody to love is correct"; chapter 3 at the Umbrella card). Social agent (bottb-5b)
  posts the LinkedIn/Facebook links "ASAP" (Dean) with a photo it picks. The Chrome extension was not connected, so Studio fields
  went in by clipboard (`pbcopy`). Opening a URL with `open -a "Google Chrome"` gives no control of the page.
- **Wrong-year thumbnail again (2026-10-05).** Jamazon's live YouTube thumbnail read "Sydney Battle of the Tech Bands 2026" on a
  2025 set (caught by the Social agent after the video went public; I confirmed by downloading `maxresdefault.jpg`). Same as
  Canvanauts two days earlier. Two in a row is a generator default, not a slip: the admin thumbnail page should take the year from
  the selected event. Until it does, check the year on every thumbnail before publish (rule added to the skill's handover list).
- **New tools (built after doing each by hand twice, proven on Jamazon):** `scripts/resolve/wait_render.py` (background render
  waiter outside the MCP bridge) and `scripts/edge_scan.py` (black pan-edge scan per cut; flagged cut 8 at 142 px on the old render,
  nothing after Dean's fix).

## Brisbane: Epsonics "No One Knows" (2026-10-05, bottb-a7)

- **Scope (Dean):** the full song, delivered as 4K + 1080p + an IG cut (< 300 MB). The Resolve project **"No One Knows Clip"** is a
  23 Aug pre-show promo (Grok and stock clips over the QOTSA studio track, 1080p), not live footage. The edit is on
  `BOTTB Brisbane 2026` in "Battle of the Bands Brisbane Full Show".
- **As found:** the cut is done, not graded. In 00:51:04:11–00:56:03:11 V1 holds 74 items: 54 live multicam and **20 already RiP'd**
  (`… Render N.mov`, created 5–6 Sep, before the RiP rules of 13–14 Sep, so whatever Deflicker/NR/Super Scale/group state they had then
  is baked in). 17 live zoomed cuts (14 Dynamic Zoom, 3 static 1.5–2.0×). Title card `epsonics_02-no-one-knows` on V2. No In/Out, no
  RELEASE marker, empty queue.
- **Mix v2 placed (Dean approved it as final, via mix-assist-b8):** `03_Delivery/Epsonics/Epsonics_S1_No_One_Knows_v2_at_00-51-04-11.wav`,
  bext 147,093,108 = 00:51:04:10.99; `align-mix --band 300 3000 --ref-tc 0` placed it at 3064.440 s = :11 (coarse ratio 7.34, 5/5 windows
  within a frame). Measured −14.5 LUFS, −1.0 dBTP, LRA 5.7, 258.000 s. Imported into the "Epsonics mixes" bin; the pool shows Start TC
  :10 (floored stamp), so place by record frame 76611, not by the pool TC. New track **A12 "Epsonics S1 NOK MIX"**, 76611–83061 (00:51:04:11–00:55:22:11). I first set a check In/Out to 82060 by hand arithmetic (40 s short): derive frames with the `tc()` helper, never in your head.
  The mix ends inside crowd sound at 00:55:22:11 while picture runs on: fade to picture at Dean's Out.
- **A5 "REFERENCE (Zoom+CAM B)" is enabled and audible across the whole show.** Dean had to mute it to preview NOK. Nothing in this runbook
  said how earlier masters kept it out; check every delivery's audio against its mix WAV (null test) rather than trusting the track flag.
- **A one-frame range (In = Out) cannot be rendered (2026-10-05).** `SetMarkInOut(77100, 77100)` returned **False** but read back
  as set, and every job queued on it stayed `Ready`: `StartRendering(jid)` False from the MCP sandbox and from the plain Python bridge,
  for PNG and H.264 alike, with no dialog on screen and nothing in ResolveDebug.txt. `SetMarkInOut(77100, 77101)` returned True and
  the same job settings rendered in 1.2 s. For a single-frame pixel check use a two-frame range. A False from `SetMarkInOut` is real
  even when the read-back looks right.
- **Audio-only (`ExportVideo False`) mov/ProRes422P + lpcm would not start on this 4K project** (5450-frame range, so not the In = Out
  trap; it worked on Jamazon's 1080p project). A normal H.264 job started right after. On ProRes, `SetRenderSettings` rejects
  `MultiPassEncode` (H.264/H.265 only) and `SelectAllFrames: False`, and one rejected key makes the whole dict call return False
  while the other keys still apply: set keys one at a time when a False needs explaining.
  Retested on the full mix range 76611–83060 with every key accepted: still refused. `SetCurrentRenderFormatAndCodec("wav", c)` is False
  for every codec name tried (`GetRenderCodecs("wav")` is `{}`). Lesson: **put audio in the look-off measurement render** (it costs
  nothing there) and null it against the mix, instead of planning a separate audio-only render.
- **Grade measurement (2026-10-05, Dean away):** look nodes bypassed and restored one call each, verified on a 2-frame PNG pair (bypass
  99 % pixels changed, mean |Δ| 18; restore mean/max |Δ| 0, md5 differs only in PNG metadata). `measure_NOK.mp4` 75768–83433, 7666
  frames, 52 s (comfort: idle-ok, idle 10 min; peers held). Node 1 now holds FLC + Primary Balance + **Custom Curves**. All 68 cuts had
  no clip grade; 33 camera sources at Super Scale 1; cache on `/Volumes/BOTTB/CacheClip`; 19 zoomed cuts marked Orange.
- **The 20 old RiPs (gigstills, camera-original fit):** CAM A/B/C match live within one 8-bit code. **The 8 CAM D RiPs are uncorrected
  source**: CAM D's group correction (R ×0.98, G shadow +0.013) was added after 6 Sep, so they missed it (2–5 codes on near-black wides).
  Re-RiP is Dean's call; Deflicker/NR state baked into them is not measurable this way.
- **Look moved toward an Adjustment Clip (Dean, 2026-10-05), so the FLC stops grading the song cards and each song can get its own look.**
  `AddTrack` only adds at the top (no index in 21.1.1), so the 30 cards moved V2 → V3 by script: backup of every item
  (`v2_cards_backup.json`: all 125-frame full movs, default transforms, no grade), `AppendToTimeline` to V3 at the same record frame,
  read-back of name/start/end/left offset/source end/path against V2 (30/30, no stray audio), then `DeleteClips(v2, False)`.
  **`AppendToTimeline`'s `endFrame` is EXCLUSIVE**: `startFrame 0, endFrame 124` gave a 124-frame item; `endFrame 125` gave 125
  (`GetSourceEndFrame()` then reads 124). Tracks now: V1 picture, **V2 "Adjustment"**, **V3 "Titles"**. Before any re-render of a
  published Brisbane song: its picture must match the timeline-node look (pixel check), and its cards will now be ungraded.
- **Look switch verified (2026-10-05):** Dean pasted timeline nodes 1–2 into an Adjustment Clip on V2 (00:00:12:10–end; nodes: empty,
  FLC + Primary Balance + Custom Curves, black anchor) and disabled the timeline nodes. Frame pair 77100–77101 timeline-look-only (X: nodes
  on, V2 off) vs adjustment-clip-only (Y): mean |Δ| 1.3/255, max 20, 89 % of pixels, **but zero signed mean in every channel and gone
  under a 16 px blur (0.07, max 2)**: the FLC grain pattern differs per instance, the tone/halation does not. A re-render of Y (Z)
  matched Y exactly, so grain is deterministic per instance. **Compare a look moved between instances blurred, never per-pixel.**
- **`StartRendering` refused (5 ways, no message) while Dean was working in the Color page copying nodes**; the first try after he
  finished started at once. Observed, not proven. If a start is refused and Dean is in the UI, ask him to step out before debugging.
- Render settings fell back to timeline resolution (4K PNGs) when a later job only set `CustomName`: set `FormatWidth/Height` on every job.
- **v8 applied (Dean: "I like the 3rd one"):** `gigstills/runs/epsonics-nok/apply_lift_satclip.json`, 38 SetCDL True (32 per-channel
  lift-to-touch + 0.95× gamma + clip-capped sat, 6 v4), every target read 1 node / no tools first, log `applied_v8.json`; node 1 then reads
  Primary Balance + Sat/Hue/Lum on targets, empty on an identity control. Pixel verification pending.
- **Audio verified on the verify render (AAC) vs the v2 WAV:** lag 0 samples, r 0.99965, gain 0.998, residual −31.5 dB, flat
  (−30.6…−32.5 per 15 s block, no drift). Before the mix −124 dBFS, after it −113 dBFS: Dean's A5 mute holds and nothing else
  plays, so no reference bleed. My check loaded both files whole as float32 and peaked at **1.45 GB** unannounced (3 s): read mono or in
  slices (`sf.read(..., frames=, start=)`) for these nulls.
- **v8 verified on pixels (gigstills, `verify_v8.json`):** 30 identity controls unchanged (max 0.008); 38 applied cuts on prediction
  (medians ≤ 0.003, Y p50 max 0.004). Systematic miss: the biggest red lifts land at R p0.1 ≈ 0.012–0.014 (1013: 0.023, under v4's Power
  0.87) instead of 0, i.e. 3–6 codes of red still above "touching". Cause unproven (Resolve's CDL clamp/Power order vs numpy, or the
  H.264 render). The super-white clip model was pessimistic on 8 cuts (measured clipping lower by 0.012–0.040).
- **Release range (Dean, 2026-10-05: "The out point is where the audio ends"):** In 76611 (00:51:04:11, first note = mix start, the mix
  starts in sound at −19 dB) → Out 83060 (00:55:22:10, last frame of the v2 mix; crowd ≈ −30 dB there, guitar noodling and talk follow).
  6450 frames = 258.0 s. **`AddMarker` returns False on a frame that already has a marker:** the Mint chapter marker sits on 76611, so
  the Cyan RELEASE marker is at 76612 (dur 6449) with In/Out in its name; `state.py`'s "implies" line reads one frame late for this song.
- **Red-floor nudge (Dean: "Do the nudge"):** 8 cuts re-SetCDL from `apply_nudge8.json` (extra red lift = measured floor^(1/Power),
  pre-checked that each still held exactly the logged v8 CDL); verify render `verify_NOK_nudge.mp4` (76611–83060, look/titles off, 78 s):
  red p0.1 now 0–0.008 (four exactly 0), G/B unchanged, Y p50 −0.0005…−0.0025, controls within 1 code. H.264 renders differ by ≤ 1 code
  with no grade change: that is the noise floor for any render-vs-render check.
- **Phone review package (Dean reviewing remotely, 2026-10-05):** look-on 720p render of the release range (6450 frames), then a contact
  sheet (one mid-cut frame per cut, timecode + cut + angle + RiP, two pages) and a timecoded MP4. Homebrew ffmpeg here has **no drawtext**
  (no freetype): draw one PIL label per second and `overlay` it as a 1 fps image sequence. **SendUserFile caps at 30 MiB**: 258 s at
  640×360, 780k video + 96k AAC = 26 MiB. Script: session scratchpad `phone_review.py` (move into `scripts/` if used twice).
- **Orange shift fixed with G/B Power, not G/B Slope (Dean: "shots got more towards orange", seen on his phone).** gigstills sized both on
  measured frames: a G/B Slope trim capped (0.80) on 10 of 14 cuts and pushed skin up to −19.5° toward magenta (it hits near-neutral
  pixels as hard as red-lit ones); multiplying the G/B Power (1.01–1.28) restored G/R exactly with skin within ±5.7° at up to −0.020 Y p50.
  Applied to 14 cuts (`applied_huehold_power.json`, each pre-checked against the logged live CDL). Look-off check
  `verify_NOK_huehold.mp4`: red-lit G/R on those 14 0.085 → 0.068 (before 0.072); all 32: 0.049 → 0.041 (before 0.037); G/B floors 0.
  **Strobing cuts keep a red floor on their hottest frames** (1014 0.29, 1026 0.15, 1004 0.09 at p0.1, unchanged from the nudge): one
  static lift per cut cannot follow the strobe; touching on every frame would need keyframed lifts (Dean, UI).
- **The remaining "orange" is the Film Look, not the grade (2026-10-05).** Red-lit pixels' G/R, same frames: source 0.037, graded look-off
  0.028, graded **look-on 0.228** (`review_NOK_huehold.mp4`): the FLC adds ≈ +0.19 on every red-wash cut, an order of magnitude more than
  any CDL move tonight. Same FLC as the published Brisbane songs; NOK's all-red lighting makes it show. Fix it per song on its own
  adjustment-clip segment (blade at the RELEASE In/Out), e.g. Hue vs Hue orange → red after the FLC. Measure hue look-ON before blaming the grade.
- **Red-only gamma replaces the neutral compensation (Dean, 2026-10-06, cut 1004 at 00:51:19:05):** lift-to-touch on R + R Power 0.635
  (R mids back to source), G/B Power 1. Applied to 1004 alone for Dean to judge with the look on (`try_1004_redgamma.json`).
  Color page Mini Timeline zoom = scroll wheel / two-finger vertical swipe over it (manual p. 3106).
- **Look trimmed by Dean (2026-10-06):** the V2 adjustment clip (whole show, not bladed) now holds node 1 empty + node 2 FLC with
  "Custom Curves" only: the FLC node's Primary Balance and the black-anchor node 3 are gone. The "Custom Curves" tool is a single
  control point ON the Y diagonal (inert; Soft Clip and intensities default), so the API lists a tool that does nothing. FLC settings on
  screen: Cinematic, Skin Bias 0.2, Contrast 1.0, Highlights 0.65, H. Rolloff 0.7, Fade 0.1, Fade Rolloff 0.65, WB 6500, Tint 5.0,
  Subtractive Sat 1.2. **The pre-change look survives in the disabled timeline nodes 1–2** (FLC + Primary Balance + curve; black anchor):
  any re-render of a published Brisbane song needs that look restored or the songs will not match their releases.
- Color page Mini-Timeline "zoom does nothing": Dean's mouse showed "Mouse Battery Very Low"; scroll over the V1–V3 lanes, trackpad otherwise.
- **Full-show adjustment clip vs Color page navigation (2026-10-06):** clicking in the Mini-Timeline selects the V2 adjustment clip, and
  `SetTrackLock("video", 2, True)` does not change that (`GetCurrentVideoItem()` still returns the Adjustment Clip; lock undone). Use the
  Thumbnail timeline ("Clips" button, top-left of the Color page) and click the V1 cut's thumbnail, with the editor moving the playhead
  by timecode (`SetCurrentTimecode`).
- **What works for grading under a full-show adjustment clip:** `SetTrackEnable("video", 2, False)` (on the Color page, read back) +
  `SetCurrentTimecode(tc)` → `GetCurrentVideoItem()` returns the V1 cut and the Color page grades it (verified 00:51:19:05 → cut 1004).
  The look is off while V2 is off: toggle V2 on for Dean to judge, off to grade. Dean could not zoom the Mini-Timeline (low mouse
  battery) and could not reach V1 thumbnails; drive the playhead for him instead of sending UI directions (2026-10-06).
- **1004 red gamma: 0.635 lifted the red toe (Dean: "no black anymore … in the reds"), now 0.80** (red p10 0.06, mids 88 % of source).
  Note the removed black-anchor node: the FLC has Fade 0.10, which lifts blacks with the look on; node 3 used to pull them back.
- **Brisbane FLC as of 2026-10-06 (adjustment clip, screenshots):** Cinematic, Skin Bias 0.2, Exposure 0, Highlights 0.65,
  H. Rolloff 0.70, **Fade 0.10**, Fade Rolloff 0.65, WB 6500, **Tint 5.0**, Subtractive Sat 1.2, **Richness 2.0**, Bleach 0,
  **Split Tone ON (Natural, Protect Neutrals off, Amount 0.10, Hue 56.6°, Pivot 0.70)**, Vignette off, Halation ON (Highlights Only,
  0.25, R 4). Dean then raised Contrast (from 1.0; new value to record). Split Tone at 56.6° and Richness 2.0 are the likely sources of
  the look-on orange on red (G/R 0.028 look-off → 0.228 look-on). Sydney: Contrast 1.3, Fade 0, Tint 0, Richness 1.0–1.2.
- **Dean's FLC changes (2026-10-06, his screenshot): Contrast 1.0 → 1.300, Tint 5.0 → 0.0** (both = Sydney). Still different from
  Canvanauts: Fade 0.10 (Syd 0; suggested 0.03 because Contrast 1.3 + Fade 0 crushed Google's crowd), Richness 2.0 (Syd 1.0–1.2),
  Split Tone 56.6° on (Syd none), Highlight Rolloff 0.70 (Canvanauts 0.25), Skin Bias 0.2 (Canvanauts 0.40). Whole-show clip.
- **I left V2 (the look) disabled after navigating Dean to a V1 cut; he then edited the FLC and saw "it doesn't seem to change the
  preview"** (2026-10-06). Whenever the look track is switched off for navigation, say so every time and switch it back the moment the
  work moves to the look.
- **Decomposing a RiP'd cut drops its clip grade, not just its colour (2026-10-06).** Dean decomposed RiP'd cut 1033 (00:53:22:02)
  to re-zoom it; the live multicam item came back with node 1 EMPTY (its v8 CDL had been on the RiP'd item). Re-applied from
  `applied_v8.json`, read back, re-marked Orange. Rescan after any decompose: 67 cuts, 19 zoomed (all live, all Orange), 0 Face Refinement.
- **NEW RULE (Dean, 2026-10-06): end card and fades go ON THE TIMELINE before the render, not via `endcard-treat.sh` after**
  ("I'd like to add closing title and fade in the video pre-render, it seems to cause issues post render"). Same treatment as the
  script: last 98 frames (3.92 s) ending on the Out — `EndCard_2x.mov` on the Titles track (`AppendToTimeline` startFrame 0,
  endFrame 98 EXCLUSIVE, recordFrame = Out − 97), `SetProperty("CompositeMode", resolve.COMPOSITE_ADD)` read back 1; mix item
  `SetFades({"FadeOut": 98})` when it ends on the Out; last V1 cut `SetFades({"FadeOut": its end − (Out − 97)})`. NOK: card
  82963–83061, A12 FadeOut 98, CAM B cut 82929–83073 FadeOut 110 (the cut runs 12 frames past the Out, so ~11 % picture remains on
  the last frame unless Dean trims it to the Out). The append cleared In/Out again; restored from the RELEASE marker.
- **4K v1 (2026-10-06 08:51) superseded before handover:** `BOTTB_Epsonics_NoOneKnows_4K_v1.mp4`, 1,452,477,488 bytes, render-qc PASS
  (6450 frames, 44.7 Mb/s), −14.5 LUFS, TP −0.8 dBTP, audio vs WAV lag 0 / r 0.99977, 21 min 9 s (4.9× real time with FLC + Deflicker/NR).
  Dean: **halation was off** and the finish is too late. I had reported halation ON from a screenshot taken earlier in the session;
  there is no API read, so **ask Dean to confirm Enable Halation immediately before pressing render**, never from an older screenshot.
  End card on the timeline worked (Add blend, logo over a fading picture), but the last V1 cut ran 12 frames past the Out, so the
  final frames kept ~12–14 % picture: blade the last cut AND the mix at the Out before setting the 98-frame fades.
- **Release range v2 (Dean, 2026-10-06: "end before we go to the last cut which is 0:55:17:03"):** In 76611 → Out **82928**
  (00:55:17:03, last frame of the CAM D RiP before the CAM B cut), 6318 frames = 252.72 s. No V1 blade needed (that cut ends at
  82929). **The mix was trimmed by script, no UI:** `DeleteClips` the A12 item, re-`AppendToTimeline` the same pool item with
  startFrame 0, endFrame 6318 (exclusive), recordFrame 76611, mediaType 2 → 76611–82929, left offset 0; `SetFades({"FadeOut": 98})`.
  End card deleted and re-appended at 82831–82929 (Add, read back 1); last cut FadeOut 98; old 110 fade on the CAM B cut set to 0;
  RELEASE marker re-added (`DeleteMarkerAtFrame` + `AddMarker`); In/Out set and read back. Dean confirmed halation ON, "good to
  re-render" → `BOTTB_Epsonics_NoOneKnows_4K_v2.mp4`.
- **NOK delivered to Social (2026-10-06 ~09:45; Dean 09:33: "Okay this is good to go. Give it to the social agent to go out ASAP"):**
  4K v2 1,416,194,700 B (3840×2160, 44.5 Mb/s, 21 min 55 s render); 1080p v2 385,058,763 B (ffmpeg Lanczos from the 4K, 11.9 Mb/s, AAC
  copied, 4 min 53 s, 1.03 GB peak); IG v2 259,904,881 B (8 Mb/s, 247.9 MiB). render-qc PASS on all three (6318 frames), −14.5 LUFS,
  TP −0.8 dBTP, audio lag 0 vs the mix, last frames black. Deriving the 1080p/IG from the 4K with ffmpeg replaced a second ~22-min
  Resolve render (same picture, one less heavy job). Thumbnails filed under `Renders/Thumbnails/NoOneKnows/` (no year on the art).
- **Post-delivery done:** Deflicker/NR off (6 group nodes, one call each; proven by a 38 s re-render matching the off reference), 21
  completed jobs cleared, render name reset to the timeline name, 19 Orange marks cleared, Super Scale 1 on 33 sources, In/Out =
  RELEASE, saved. The final mix stays on A12 (trimmed v2, FadeOut 98). **Left for Dean (UI): halation off for playback.** The 19 new
  RiPs are back in their camera groups (needed for the colour correction; see above).
- **Published (bottb-5b, 2026-10-06 ~11:00):** YouTube https://youtu.be/E2yeRiHRUlw (4K v2), FB + IG reels from Blob
  `release/brisbane-2026/Epsonics_NoOneKnows_1080p_IG_v2.mp4` (259,904,881 B verified), LinkedIn + TikTok from 1080p_v2 (Dean dragged).
  Live YouTube thumbnail checked from `maxresdefault.jpg`: Dean's custom art, no year on it. Copy: `doc/production/epsonics-noone-knows-copy.md`.

## Sydney 2026 (2026-10-08 show): cameras are LOG (2026-10-13, bottb-68)

First show shot in Log. Everything above is Rec.709 footage (Brisbane 2026, Sydney 2025), so none of the
grade numbers or "not Log" findings carry over. Media: volume **`BOTTB SYD26`** (exFAT, USB, 1.8 TB, 456 GB used),
one folder per angle, 24 clips, all 3840×2160 25p. Checked per clip with `ffprobe` + `exiftool` (Canon) and the embedded
Sony XML (`strings` on the last 4 MB), not from the folder names.

| Folder (angle)               | Body / lens                    | Codec                                           | Log / gamut            | Clips                                        |
| ---------------------------- | ------------------------------ | ----------------------------------------------- | ---------------------- | -------------------------------------------- |
| `STAGE RIGHT CAM` (`1O0A*`)  | Canon EOS R6 Mark II, RF 15-35 | HEVC Rext 4:2:2 10-bit, 80 Mb/s                 | C-Log3 / Cinema Gamut  | 2 (0068 42.6 min, 0069 2 h 24 min)           |
| `STATIC DESKCAM` (`3O1A*`)   | R6 II, RF 28-70 F2             | same                                            | C-Log3 / Cinema Gamut  | 2 (7144 2 h 42 min, 7145 17.8 min; 18 s gap) |
| `SOUNDESK_TRACKED` (`IMG_*`) | R6 II, RF 70-200               | same                                            | C-Log3 / Cinema Gamut  | 6 (2329 is 2 h 9 min)                        |
| `PHOTOPIT_ROAMING` (`0V6A*`) | R6 II, RF 24-70                | same                                            | C-Log3 / Cinema Gamut  | 10                                           |
| `DRUM CAM` (`C136*`)         | **Sony FX30**, Sigma 18-50     | **H.264 High 4:2:0 8-bit**, 57 Mb/s, full range | S-Log3 / S-Gamut3.Cine | 4                                            |

- **`IMG_*` is a Canon, not a phone**: the sound-desk tracking R6 II writes `IMG_` names (same trap as Sydney 2025's
  `MVI_*`). Canon's Log settings live in the Canon maker notes: `exiftool -a -G1` → `Canon Log Version: CLogV3`,
  `Color Space 2: CinemaGamut`. `ColorSpace: sRGB` in the same dump is the stills setting; ignore it.
- **The drum cam is 8-bit S-Log3.** Expect banding and noise in its shadows if pushed; it needs the gentlest correction.
- Container colour tags are empty (`unknown`) on every clip, so nothing auto-detects the Log: input colour spaces
  must be set per clip.
- **Clocks:** `creation_time` is UTC; the show was AEDT (UTC+11). Canon timecodes are per-body free-run
  (08:15 … 18:47) and agree with nothing. Use creation_time for a rough layout and audio for the sync.
- **The multitrack** (Logic, `/Volumes/BOTTB/Sydney - 2026/`, take `#02`, 19:18:34–22:05:46) is the desk feed. Its
  set times are in `prep/SYDNEY-2026-PREP.md`, which says picture TC has not been measured yet. This multicam is the
  first Sydney 2026 picture reference: hand its offsets to the mixdown session once measured.

### Setting Log input colour spaces through the API (21.1.1, 2026-10-13)

Project `BOTTB Sydney 2026 Full Show`: DaVinci YRGB Color Managed v2, separate colour space and gamma, timeline
**`DaVinci WG` / `DaVinci Intermediate`** (the string "DaVinci Wide Gamut" is refused; "DaVinci WG" takes), output
Rec.709 / Gamma 2.4, input and output DRT `DaVinci`, colour-space-aware tools on, 3840×2160 25p. Cache on
`/Volumes/BOTTB/Sydney - 2026/video/CacheClip`, Optimized Media off. `timelinePlaybackFrameRate` refuses "25" (reads 24).

- **Per-clip `SetClipProperty("Input Color Space", …)` prefix-matches and can pick the wrong preset.** "Canon Cinema
  Gamut" returned True and set **"Canon Cinema Gamut/Canon Log 2"**. Every spelling of the Log 3 preset was refused, as was
  "Project" to undo it, and `Input Gamma` refuses every value. The stuck clip was fixed by `DeleteClips` + re-import
  (before it was in any timeline).
- **What works:** the project default `colorSpaceInput = "Canon Cinema Gamut"` + `colorSpaceInputGamma = "Canon Log 3"`
  (both take) for the four Canons, and per clip `"Sony S-Gamut3.Cine"`, which matches the only preset with that gamut and
  reads back **"S-Gamut3.Cine/S-Log3"** (no "Sony" prefix in Resolve's list). ~~That sets the Sony up~~ — CORRECTED
  2026-10-13 by a 10-frame render (one frame per camera on a temp timeline, measured against the raw source): the four
  Canons on the project default decode (Log p0.1 0.125-0.141 → 0.003-0.042), but **the FX30 came out still Log**
  (p0.1 0.098 → 0.104, p99 0.420 → 0.399). With separate colour space and gamma on, the clip's own `Input Gamma` stays
  `Rec.709` and wins: the gamut converts, the curve is never decoded. `SetClipProperty("Input Gamma", …)` refuses every
  S-Log3 spelling, so **a Log clip that differs from the project default needs its Input Gamma set in the UI**
  (Media Pool → select → right-click → Input Gamma). Check every camera on rendered pixels; the readback lies.
- **Fixed (Dean, UI, 2026-10-13):** Media Pool → DRUM CAM, all four → right-click → Input Gamma → Sony S-Log3. Reads back
  `Input Gamma: S-Log3` (the string the API refused). Re-render: FX30 p0.1 0.104 → 0.006, Canons byte-identical to before.
- `MultiPassEncode` in `SetRenderSettings` makes the whole call fail on ProRes (H.264/H.265 only). **`AddRenderJob`
  returns "" when it is in the same `run_script` call as `SetRenderSettings`; in a call of its own it returns the job id**
  (twice on 2026-10-13; also needed `MarkIn`/`MarkOut` on a fresh timeline, safe only where Dean has no In/Out to lose).

### Sync: audio for the lock, picture for the frame (2026-10-13)

Reference = the Logic take `#02` (desk feed), summed to 16 kHz mono (`/Volumes/BOTTB/Sydney - 2026/video/sync_audio/`,
`_DESKREF_02_16k.wav`: OH, bass, guitars, keys, RX1-4; `_DRUMREF_02_16k.wav`: kit only). REF seconds = take file seconds;
**timeline TC 01:00:00:00 = REF 2.8025625 s** (the Logic project TC of alternatives 1-6), so BWF-stamped bounces from the
mix sessions land in place. Tools: `scripts/multicam_sync.py` (audio) and `scripts/picture_sync.py` (light changes).

- **Camera clocks vs the Logic clock (creation_time is UTC, show AEDT):** Photo Pit +20.7 s, Stage Right +29.2 s,
  Drum (FX30) +26.4 s, Static Desk +83.1 s, Desk Tracking **−3515.5 s** (clock ~an hour out). Each held ±0.6 s over
  every clip of that camera (1 s creation_time resolution), so clock + offset ± 30 s is a safe search window.
- **A whole-clip envelope correlation fails on stage-side cameras.** In changeovers the drum cam hears stage noise while
  the desk is silent; those windows anti-correlate (median r −0.3) and cancel the music (C1364: z −92 at the true lag).
  Windowed voting (best lag per 60 s window, keep r ≥ 0.3, majority cluster) found it in 9 of 15 windows at +0.2 s.
- **Single 20 s sample-level probes jitter ±20–40 ms** (a room mic hears the PA and the acoustic kit at different
  delays). Trust fits over many probes. With ≥ 12 good probes the drift fit matched per-set medians to 2 ms: Static
  Desk **+8.07 ppm** (78 ms over 2 h 42 m), Desk Tracking +6.84 ppm. Fits from 3–5 probes were noise (same camera
  −8.8…+23 ppm). Long clips that drift > 1 frame are placed per set, split in the changeovers.
- **Audio alignment is not picture alignment.** Frame-mean brightness changes (stage lights reach every lens at
  once) on Killing in the Name, 5 cameras: pairwise lags closed within 2 ms, r 0.47–0.85. Against the drum cam (mic
  beside the kit, ≈ picture-true) the audio-aligned FOH cameras sat 32 ms early, Stage Right 16 ms, the roaming Photo
  Pit 54 ms (it moves, so per clip). That is 0.4–1.4 frames, visible on drum hits: every clip gets a picture check.

### Cameras step a frame against their own audio: sync is piecewise (2026-10-13)

The grid pass (`picture_sync.py --grid 240 --win-s 60`, every clip against Static Desk 7144, ~150 decodes, two
workers ~1.3 GB) showed **one-frame steps that every other camera sees at the same moment**: C1364, 0069, 0922 and 2330
all moved ~+40 ms against 7144 between 8516 and 8756 s, and C1364, 0069 and 2329 all moved ~−40 ms between 5504 and
6168 s. So 7144's picture stepped against its own audio (the drift-fitted placement) twice. Stage Right stepped once
on its own (~4450 s) and Desk Tracking once (~7000 s). Checked and ruled out:
the file (7144 has exactly 243,136 packets = 9725.44 s × 25), and ffmpeg seeking (direct `-ss` vs a 10 s pre-roll gave
identical frames at all four step points). Per-window lags also alias by one frame about 1 time in 8 (IMG_2329: 13
windows at −2 ms, 4 at −42, 1 at +38), so trust runs of agreeing windows, never one.

`scripts/multicam_solve.py` turns that into a plan: drum cam = picture truth (its mic is beside the kit, so audio
placement ≈ picture), anchor error G(T) = drum's lag vs the anchor per run (78.5 / 28 / 68.5 ms), each clip's net
correction N = lag − G per run of agreeing windows, clips split at run boundaries (and at the set changeovers for
drifting clips). Clips with no trusted window take the same camera's nearest measured run; single windows on clips
< 120 s are not trusted (a changeover clip's lone window gave −152 ms). Result: timeline **`Sydney 2026 - Multicam
source`**, 43 pieces on V1–V5 + desk scratch on A6, every piece in its camera colour group. The provisional
audio-only timeline `Sydney 2026 - Sync (pre-multicam)` is kept for comparison.

### Exposure reference: not the projection screen (Dean, 2026-10-13)

I proposed metering the drum cam against the Canons on the projection screen, calling it "one emissive source
seen by every camera". Dean: **"Projection screen is reflective not emissive."** It is a front-projection surface, so
its luminance depends on viewing angle (the drum cam sees it steeply from beside it, the Static Desk head-on from the
back) and it also catches stage-light spill: a camera-to-camera ratio on it carries the angle bias into the exposure
number. Meter exposure on the subject instead (the drummer's face, scene-linear via the camera's log decoder, pushed to
a skin target), per set, and keep the screen for sync only (picture_sync uses its changes, not its level).
(Corrected same day, Dean: "the projector screen even though it's reflective would be a common reference", and my
"emissive" was Brisbane's LED-wall backdrop carried over. Every camera sees the same projected image at the same
instant; the angle term is a fixed bias per camera position, not time-varying. So meter BOTH: screen ratio
camera-to-camera and drummer's face vs the Canons' faces, and read their disagreement as that bias + lighting.)

### Timeline → multicam in 21.1.1: the menu item is a submenu (2026-10-13)

The manual (21.1, ch. 49 p. 1038) says right-click the timeline → "Convert Compound Clips (Timelines) to Multicam Clips".
**21.1.1 has no such item** (Dean, screenshot): Media Pool right-click on a timeline shows **"Convert Timeline to Multicam
Clip ›"** (a submenu), next to "Create New Multicam Clip Using Selected Clips…". The manual's warning still stands: the
conversion is one-way, so convert a DuplicateTimeline copy (`Sydney 2026 - MULTICAM (convert me)`) and keep the measured
source timeline as the record.

- **Converted (Dean, 2026-10-13) with "Use Reference Audio/Angle 1":** Project.db shows the multicam container
  (`Sm2TiTrack.Sm2SequenceContainer_id` 3c79f417…) holds the 43 video pieces and **the desk scratch v2 once per angle (5×)**
  as its only audio: the first audio-only track became the reference, as the manual says. Multicam clip renamed
  "Sydney 2026 Multicam" (`SetClipProperty("Clip Name")` returned False but the name changed: read back), Start TC
  00:53:00:00. Edit timeline **`BOTTB Sydney 2026`** (start 00:53:00:00, multicam on V1 at 79500) keeps show TC = Logic TC.
- **Colour-group membership is not in `Sm2TiItem.Group` or `.ClipGroup`**: both are NULL on all 43 pieces of the source
  timeline, where `GetColorGroup()` read every group back correctly. It lives elsewhere (a blob). Check survival on
  pixels: put a grade in the group, render a frame with that angle active.
- **Desk scratch v1 was −38.7 LUFS** (Dean: "way too quiet"): the 0.35 scale on a raw 16-input sum. v2 =
  `loudnorm=I=-16:TP=-1.5:LRA=11`, −19.4 LUFS in-set, peaks −1.5 dBFS, sample-aligned with v1 at three points (loudnorm's
  look-ahead adds no offset), same BWF stamp. Measure any scratch's loudness before handing it over.

### Drum cam base exposure: +1.25 stops on the CAM 5 group (measured 2026-10-13)

Two independent meters, scene-linear via the official decoders (`colour` 0.4.7: `log_decoding_SLog3` /
`log_decoding_CanonLog3`, luminance in each camera's own gamut). Scripts: gigstills `runs/sydney26_drum_exposure/`.

- **Projection screen, matched instants every 30 s through each set** (`screen_expo.py`, 0.16 GB, 6 min): drum vs
  Stage Right **+1.34 / +1.23 / +1.33 / +1.25 / +1.20 st** (ShipReX → V2), IQR ±0.15: a camera-level constant. Drum vs
  Static Desk +1.5…+1.9 (beams through haze sit in front of the screen from the FOH angle: the expected bias).
- **Faces** (`face_expo.py`, YuNet on keyframes, 34 min): drum face vs Photo Pit faces +0.0 / +0.7 / +1.8 / +1.1 / +0.7,
  vs Desk Tracking +0.6 / +1.6 / +2.5 / +1.8 / +1.1: median ≈ +1.1, spread by set = the drummer's own lighting (upstage,
  less front light). All cameras' faces sit 0.3–2.6 st under 18% grey: the room is dark, that is the look's job.
- So: **group base +1.25 st** (DaVinci Intermediate: 1 st = 0.0733 Offset → +0.092), per-cut trims after the cut for
  the sets the drummer is lit differently (Canvanauts darkest, ShipReX brightest). The API cannot write it: `Graph` has
  no `SetCDL` (only `TimelineItem` does) → Dean sets it in the UI; verify on a render.

### Drum cam +1.25 st applied and verified (2026-10-13, 21:03)

- Dean set it by hand in the UI: Color page, node editor dropdown **Group Pre-Clip** (CAM 5), node 01, HDR palette,
  **Global Exp 1.25**. Check render `video/checks/colourcheck_CAM5exp_v3.mov` (job a9119cce; separate
  SetRenderSettings / AddRenderJob calls; MarkIn 0 / MarkOut 9 on the temp timeline only).
- Result: the four Canon frames are **bit-identical** to the v2 check (max |diff| 0); the drum frames gained **+1.24 st
  scene-linear** (IQR +1.18..+1.29, same in every brightness band).
- **Trap: do not read exposure off the display-referred render.** The same frames read **+2.26 "stops"** taking
  code^2.4 as linear: the DaVinci DRT's toe (HDR 1000 working → Rec.709 2.4) stretches deep shadows, and the drum
  frame sits there (mean code 0.09). Measure it scene-linear instead: decode the source frame (S-Log3 → linear Y, frame
  = the item's left offset + n, with ±3 frames NCC to confirm alignment), build the render's tone curve from the
  BEFORE render (binned median code against source log2 Y), invert both renders through it, and difference.
- **A page change inside a `run_script` call returns `{"error": ""}` but the change happens** (2026-10-13, twice):
  `SetCurrentRenderFormatAndCodec` from the Color page jumped Resolve to Deliver, and `OpenPage("color")` switched
  the page; both reported the empty error. Read the state in the next call before retrying. Not playback.
- ~~Still open: that the group grade reaches the drum angle inside the converted multicam.~~ **It does not** (measured
  2026-10-13 ~21:40): the multicam pool clip appended to a temp timeline (`zz multicam check (temp)`, Static Desk angle,
  multicam frame 115500 = 02:10:00:00) rendered with **rotation 0.000°, scale 1.0000** against the raw source, while the
  same CAM 1 group sizing measured −0.68°/×1.06 on the colour-check timeline. Dean saw it first ("It doesn't look very
  level"; "Don't you have to go back to the multicam for that?"). The 43 pieces inside the multicam are separate
  timeline items: assign them to the groups inside it (Media Pool → right-click the multicam → Open in Timeline →
  Color page; runbook "Multicam group grades are only reachable via…"). No API: an opened multicam hijacks the API.
  **Then verified on a render through the multicam** (2026-10-13 ~22:10): Dean switched the edit timeline's multicam
  clip to the Drum angle; 2 frames at 02:10:00:00 (`checks/multicamcheck_drum_021000.mov`, C1364 frame 12380) read
  **+1.29 st** scene-linear vs the raw source (IQR +1.25..+1.32), through the DRT curve built from the no-exposure check
  render. So the drum pieces inside the multicam were already in CAM 5 and group _grades_ render through the multicam;
  it was only the per-clip Node Sizing that did not travel.
  Dean: "The deflicker and tnr done in brisbane were done that way." Group work on a multicam show always goes
  through Open in Timeline: assign the groups there, after the conversion, not only on the pre-multicam timeline.

### Wide (CAM 1) roll and keystone fix in the group Pre-Clip (2026-10-13)

- Dean: "in the wide angle the screen is crooked". Done as **Node Sizing on a "Roll" node in the CAM 1 group's Pre-Clip
  graph**: Rotate **−0.70**, Yaw **−0.038**, Zoom **1.06**, Pan/Tilt 0. Input/Edit sizing (Dean's dynamic zooms) runs
  _before_ the node graph (manual p.3497, "Sizing Order of Processing"), and zoom/pan preserve angles, so the fix stays
  right under any later zoom and on a RiP'd clip once it is re-assigned to the group.
- **Resolve sign conventions (measured by registering renders):** Rotate −0.70 = 0.68° _counter-clockwise_ on screen;
  Yaw negative raises the right-hand side of a horizontal line above centre. **Yaw is not degrees:** −0.075 changed the
  screen's top edge (y ≈ 60 of 1080) by 2.1°, so ≈ 0.028 per degree there, roughly linear. Yaw opens a gap on one
  side: −0.038 needs about ×1.035 more zoom (1.022 → 1.06). Calibrate with one test value + render + homography
  (ORB + RANSAC against the uncorrected render), not by eye: Dean's eyeballed −0.075 was double the right value.
- Verified on `checks/colourcheck_CAM1yaw_v5.mov`: top edge −0.02°, screen sides −0.06°, no border (edge rows match
  the uncorrected render's crowd blacks), other four cameras bit-identical.
- **CORRECTED the same evening: Node Sizing in a group graph is per clip.** The Roll node appeared on every CAM 1 clip
  (inside the multicam too) but with **no values set**: only the colour-check clip it was keyed on was rotated
  (manual: Node Sizing "is specific to a particular clip"). A group node carries grade settings (the drum's HDR
  exposure is shared), not sizing. Dean then put the fix on the Static Desk clips **inside the multicam**, Edit page
  Inspector → Transform: **Zoom 1.050, Rotation Angle +0.700, Yaw −0.030** (his taste values). **The Edit Inspector's
  rotation sign is the opposite of the Color page Sizing palette's**: Inspector +0.70 = Sizing −0.70.
- Verified on `checks/multicamcheck_wide_allsets_v2.mov` (13 Static Desk frames through the multicam, every set +
  3O1A7145): every frame rotated CCW against its source, long verticals within ±0.4° in 9 of 13 framings (the outliers
  are mic stands and lights, checked by eye), no black corners. A stacked Roll-node rotation on one piece (−0.70 node +
  Inspector +0.70 = 1.4°) showed black corners until reset: **one place for geometry, the Inspector on the multicam's
  inner clips.**
- **The "static" wide was reframed during the night** (several framings within sets; V2 Voyagers wider). Roll
  measured from long verticals is −0.3° to −1.0° in every set, so the rotation is right all night. The keystone
  depends on the pan: where the screen's top edge was measurable (6 of 15 samples, ShipReX to Amakazaam) the
  residual after the fix is +0.1° to +0.9°. ShipReX's opening framing and V2 Voyagers were not measurable.
- **Measuring trap:** the check frame and my clean reference frame were different framings of the same clip. Measure
  the fix on the same frame you render, and sample the whole night before calling a camera "static".

### Drum cam TNR in the CAM 5 group Pre-Clip (2026-10-13 ~22:30)

- Node 02 after the HDR exposure node (`GetToolsInNode`: `["HDR"]`, `["OFX: Noise Reduction"]`), ResolveFX Noise
  Reduction, Dean's settings: Temporal **Frames Either Side 3, Better, Motion Range Small, Threshold 25 (luma/chroma
  linked), Motion 50, Blend 0**; Spatial off (Spatial NR has no switch: thresholds 0 = off, manual "enable Spatial NR
  by raising either the Luma or Chroma Threshold").
- Measured on 5 s of C1364 at 02:10:00:00 (temp timeline `zz drum TNR check (temp)`, clip assigned to CAM 5; renders
  `checks/drumTNR_on_v1.mov` / `_off_v1.mov`): temporal noise (frame minus the mean of its neighbours, motionless
  pixels only, which cancels the stage-light changes) down **5.6 dB in shadows, 8.4 dB mids, 9.1 dB highlights**. No
  ghosting on the drummer's fastest stick frame at full res. Cost: **12.9 s to render 5 s with it on, 2.3 s off**.
- Bypassed for editing (Dean, Ctrl+D). It must be ON before any RiP and every delivery render (checklist step 1).
- A whole-frame motion mask fails on stage footage: the lights move every pixel. Mask per instant on local motion.

### First-pass auto cut: Dean's review of the Canvanauts pilot (2026-10-13)

- gigstills `first-pass` (Dean's angle priority: pit, then desk tracking, then by the audio: crowd → stage right,
  drums → drum cam, otherwise wide) gave 142 cuts over the 26-min set at Brisbane pace. Dean: "a pretty good starting
  point"; he did not object to the tracking-heavy balance (64% tracking, 7% wide).
- **Never cut between two angles framed on the same subject.** Dean flagged #3→#4 (tracking → pit, same guitarist) and
  #60→#61 (pit → tracking, same keyboardist): "it would have been better if #3 chose another shot e.g. the stage
  right shot or drum cam". The pit and the tracked long lens both face the stage, so the same performer from two
  distances reads as a jump cut. The DP needs a same-subject term between angles (gigstills `docs/first-pass-cut.md`).
- **Laying the cut into Resolve (Dean's method, 2026-10-13):** the API has no split/blade and no set-angle call, so
  build and colour, and Dean switches by colour. On a `DuplicateTimeline` copy ("BOTTB Sydney 2026 - first pass"):
  `DeleteClips` the one V1 multicam item (its linked audio stays, continuous), then one `AppendToTimeline` call with a
  piece per shot: `{mediaPoolItem: <multicam>, startFrame: rec_in − 79500, endFrame: rec_out − 79500 (exclusive),
recordFrame: rec_in (absolute), trackIndex 1, mediaType 1}`. Every piece lands on the default angle (Static Desk).
  `SetClipColor` by angle (1 Blue, 2 Purple, 3 Green, 4 Yellow, 5 Pink; never Orange, which marks zoomed cuts), read
  back. Canvanauts v2: 140 pieces + head/tail, contiguous, offsets = record − 79500, colour frame shares = v2's angle
  shares. Dean: Timeline > Select Clips By Clip Color > <colour>, right-click → Switch Multicam Clip Angle.
- **Dean, watching the laid-in Canvanauts cut (2026-10-13):** "it includes abrupt zooms and pans on the tracked camera, it
  should cut if there any largish moves." The pilot's tracking thresholds (move 0.45 fw/s, drift 0.28) let medium pans
  through, and zooms are invisible to its translation metric (REPORT weak spot 2). A tracking shot must end, or be
  cut around, at any largish pan or any zoom.
- Dean, same review: "Also probably should go to the wide more instead of the tracked camera." So the accepted 64%
  tracking / 6% wide balance is withdrawn; Brisbane's rough cut was 52% wide. Then: "can we make it a random choice
  maybe?": where tracking would beat the wide, pick one at random (p(wide) 0.5, fixed seed, re-rollable).
- Dean, same review: "It seems you could probably use the photo pit a bit more often too, we can stabilise a bit or
  dehaze." Pit usability is loosened for stabilisable shake and haze with a performer still visible; those shots carry
  `needs: stabilise / dehaze` flags in the cut list, to be marked in Resolve for Dean.
- Dean, same review: "maybe we should have shorter cuts, and we could just go to some different angles", then "can we
  use retime to analyse tempo and bars". Pace moves from seconds (Brisbane median 7.9 s) to bars: ~2 bars per shot,
  floor 1 bar, longer on ballads; no return to an angle used in the last two shots. The beat grid should come from
  mix-assist's groove analysis (part of retime: the drummer's own tempo, beats and downbeats from the close mics,
  `mix-analyser groove <session>`; needs an `analyse` session over the drum stems). gigstills accepts an optional
  per-song `{tempo_bpm, beats_s, downbeats_s, sections}` JSON in REF seconds.
- **Overnight 2026-10-13 → 14, Dean's brief:** "map out each song and then use this hint to drive cuts, use more variety
  of angles … clearer what's going on, like a guitar solo, singing chorus … get gigstills to label whats in frame … arrive
  at a rough cut for the whole show"; "approach it … band by band, then song by song within each band." Split: beat/bar
  grids by mix-assist-12 (`song_maps/<set>/<song>.grid.json`), sections + featured performer from the desk multitrack
  by a song-map agent (`.events.json`, code in `scripts/songmap/`), in-frame labels + the cut by gigstills
  (`runs/sydney26_firstpass/cut_full/`). Resolve and the mix-assist servers were shut for memory.
  Dean, ~23:05: "you are okay to page and generally run less conservatively, your job is to get everything done without
  crashing the computer, not to keep it responsive and interactive." Comfort gate waived for the night's jobs; the safety
  gate, the 6 GB/12 GB process limits and memreg still held; concurrent heavy jobs kept under ~14 GB in total.
- **Song maps done overnight (all 28 songs).** Grids: mix-assist `scripts/show_song_maps.py` (Beat This on kit and
  instrument downmixes + band_grid bar decoder; ~30 s and ≤ 1.14 GB per song; all 4/4, median downbeat confidence
  0.98–1.00; Black Parade = Dean's reviewed grid at REF = session time + 5293.0). Events: `scripts/songmap/` (vocal mic
  level vs overheads, per-instrument lead score with chroma flux for solos, Whisper small.en hook words for choruses,
  phrase timestamps only: word timestamps took 9.9 GB). `song_maps/songs.json` = songs + talk/changeover spans with
  timeline TC, for the song markers. allin1 needs NATTEN patched on arm64; MSAF is broken on current scipy.
- **Input map corrections found from picture/audio:** ShipReX's erhu is on **ACC 2** (the prep doc says ACC 1, which
  sits at −75 dB all set); Amakazaam's Tyler sings on **RX4**, not RX3 as the stage plot says; Keira sings on the kit
  mic RX5. Canvanauts: RX2 = blond singer in sunglasses, RX3 = singer in the hat; GTR Q1 house-left curly guitarist,
  Q2 bandana guitarist, BASS Q far house right.

### Whole-show rough cut laid into Resolve (2026-10-14, ~02:00–02:40, Dean asleep)

- **The combined show list carried the wrong Canvanauts cut.** gigstills' `cut_full/tools/combine.py` read
  `cut_v2/cutlist_canvanauts.json` (140 shots, 65% tracking) while its tables used `cut_v3` (280 shots, 36% wide), so
  its hand-back said 1137 shots. Caught by recomputing angle shares per set from `cutlist_show.json` and comparing
  them with the per-set table; fixed the path, re-ran it: **1277 shots**, 4 changeover gaps, contiguous
  101705 → 330230. **Check a combined list per set against the per-set reports before laying it in.**
- **`launch_resolve` said "running" with no Resolve process** (only leftover `ResolvePython` helpers were alive). A
  `run_script` call then said Resolve was not running. A second `launch_resolve` started it (`pgrep -f MacOS/Resolve`
  shows the real process). It came up on "Untitled Project": `LoadProject("BOTTB Sydney 2026 Full Show")`.
- **Dean's angle switches on "… - first pass" survived the close** (he was asked to Cmd+S). **A multicam timeline
  item's `GetName()` is "<multicam> - <active angle>"**, so angle switches can be verified by name through the API.
- **Laying in 1283 pieces** (head + 1277 shots + 4 gaps on the wide + tail) on "BOTTB Sydney 2026 - rough cut v3"
  (a `DuplicateTimeline` of "BOTTB Sydney 2026"): `AppendToTimeline` of 321 pieces took < 60 s; **641 pieces timed out
  at 60 s but completed**. Keep chunks ≤ ~320 and read back start/end/left offset for every item (all 1283 matched).
  `SetClipColor` ≤ ~450 items per call. Read the piece list from a JSON file with `run_script_unsafe` rather than
  pasting it into the script.
- **Markers:** timeline markers from `song_maps/songs.json`: Yellow `SET: <band>` at each set intro, Green song marker
  with duration = the song, Red `END: <song>` at the song end. At a segue, the end and the next start share a frame;
  the end marker moved back 1 frame. Pit shots flagged `needs` get a Sand timeline marker `PIT: stabilise|dehaze` at
  the shot start (207, all Photo Pit). **`TimelineItem.AddMarker` accepts any frameId, even past the clip's end, so
  where it lands can't be checked through the API:** use timeline markers.
- **Dean's real edit starts from the rough cut (2026-10-14 ~08:20):** "I'm pretty happy with this." Colours were cleared
  on "rough cut v3" only after every item's active angle was read back. The baseline for comparing his edits is the
  frozen copy "rough cut v3 (auto baseline, don't edit)" plus
  `gigstills/runs/sydney26_firstpass/cut_full/resolve_baseline_roughcut_v3.json`. When he is done: diff his
  timeline against the baseline and look for patterns (shot lengths, angle swaps, where he moved cuts).
- **The multicam's "reference audio" is the unmixed desk sum** (`video/DESK_SCRATCH_unmixed_sum_48k.wav`): **mono** on
  a stereo track, so it plays in the left ear only, at −36.2 LUFS. A dual-mono copy +16 dB with a −1 dB limiter
  (`DESK_SCRATCH_sum_stereo_plus16dB_48k.wav`, −17.4 LUFS, starts where the original does) is for a named audio track.
  The proper fix is a measured per-song starting mix from mix-assist (briefed 2026-10-14; it belongs to **mix-assist-21**, which wrote the Sydney prep, the kit-mix-rock plans and the Sydney26 presets and mixes with Dean: mix-assist-12 forwarded it. Brief Sydney mixing there, not to -12, which does the song grids: gain,
  HPF/LPF, compressor, pan and fader per input per song, plus an offline render). Dean: "it has given me these numbers
  before so the approach exists."
- **Placing REF-time audio on the Sydney timeline (2026-10-14):** a timeline frame F starts at REF sample
  134523 + (F − 90000)·1920 (2.8025625 s × 48000 = 134523 exactly). A render starting off a frame boundary lands
  late by the remainder: pad a copy with that many samples of silence (`adelay=delays=<n>S:all=1`) and check that it
  is otherwise identical. mix-assist renders should start on a boundary. The +16 dB stereo scratch is on A2
  "Desk scratch +16 dB stereo"; A1 (the multicam's mono scratch) is disabled. mix-assist-21's Beggin' pilot is on A3
  at 210131. Against the unmixed scratch it reads 7.6 ms early (r 0.42). mix-assist-21 explained it: against the raw mics the render is at lag 0 for OH L/R and RX2. The open mics it muted (RX4, GTR SR 8.9 ms later, SM58 3.4 ms) dominate the unmixed sum. **Place mixes at their stamp; do not chase a lag against the unmixed scratch.** Renders now start on a frame boundary.
- **The "blub" on the scratch and the Beggin' pilot (2026-10-14):** Dean: "phone interference type low blub blub but
  constant", "not in my logic project", then by ear on mix-assist-21's solo clips: "I think its the kick clipping".
  Measured: not TRAX (digital silence), no recorder/MADI glitch (no zero-runs, no simultaneous discontinuities), no
  GSM 217 Hz signature, no block seams. Kick #02 never reaches full scale (peak −2.96 dBFS, no flat tops), and the +16 dB
  scratch's limiter takes ~0 dB off kick hits. So, if it is the kick, it is overload before the converter or the raw kick
  through an open chain. With mix-assist-21 to settle against Dean's Logic kick chain.
- **Then: the blub is in Resolve's playback, not the audio (2026-10-14).** Dean heard nothing on any of the 16 raw solos or
  the scratch played in VLC: "It's not on any of those so it maybe is something about playback in davinci?" Project
  settings showed **`timelinePlaybackFrameRate` "24" on a 25 fps timeline** (timeline and project `timelineFrameRate`
  25.0). The manual (Master Settings) says Resolve then drops or repeats frames to match, so a 24-against-25
  mismatch is a ~1 Hz periodic disturbance. `SetSetting("timelinePlaybackFrameRate", "25")` returns False and changes
  nothing; it is a UI change: Project Settings > Master Settings > Timeline Format > Playback frame rate = 25 (and Video
  Monitoring > Video format at a 25p/50Hz format if it is locked to it). **Check playback frame rate = timeline
  frame rate on any new project before judging audio in Resolve.**
  **Confirmed:** Dean set it to 25 in the UI ("That seems to have fixed it"). Read back: project and timeline
  `timelinePlaybackFrameRate` = "25". The scratch, the pilot and every input were clean all along.
- **Starting mix v1 on the timeline (2026-10-14):** Dean chose the pilot's loudness ("Probably the heavily limited one is
  best": −16 LUFS-I, up to 9 dB of limiting). mix-assist-21 renders one continuous file per set, frame-aligned and
  REF-stamped. Each set goes on A3 "Starting mix v1" at its start frame (Canvanauts: frame 191404, 39326 frames).
  A2 (the scratch) still runs under the whole show, so Dean mutes it per set until every set is in.
  **Re-renders must get a new filename:** Canvanauts was overwritten in place. `ReplaceClip` on the same path returns True,
  but Resolve's API can't show whether playback picked up the new audio.
  Fixed by `ReplaceClip` to `CANVANAUTS_full_r2.wav`. It returned an empty error but took effect (read back: path,
  name, A3 item 191404–230730, offset 0). It's the same empty-error trap as the page-changing calls.

### Paused for shutdown (2026-10-14, Dean off to work): where to pick up

- **Resolve** project "BOTTB Sydney 2026 Full Show", timeline **"BOTTB Sydney 2026 - rough cut v3"**, which Dean is
  editing. Last API save came after ShipReX was placed; Dean quit Resolve himself. Audio: A1 multicam mono scratch (off),
  A2 "Desk scratch +16 dB stereo" (on, whole show), A3 "Starting mix v1" = SHIPREX_full.wav 101704–143555 and
  CANVANAUTS_full_r2.wav 191404–230730. Playback frame rate is now 25 (Dean fixed it).
- **Still to place on A3** as mix-assist-21 delivers: Bandlassian, Amakazaam, V2 Voyagers (each `<SET>_full[_rN].wav`,
  a frame-aligned REF stamp, frame = 90000 + (stamp − 134523)/1920; check the stamp and frames with ffprobe, then
  ImportMedia → AppendToTimeline trackIndex 3 mediaType 2 → read back → SaveProject). Ask whether Dean is playing
  first. When all five are in: disable A2, or ask Dean.
  - **Delivered, waiting for Resolve:** Bandlassian `starting_v1/Bandlassian/BANDLASSIAN_full.wav` (336,972,174 B; BWF
    116830203, i.e. frame 150779; 56,161,920 samples = 29251 frames, so 150779–180030; checked with ffprobe 2026-10-14). Not
    listened to. good 4 u (−17.01) and Still into You (−18.07) sit below −16 by design, as Beggin' does.
    Amakazaam `starting_v1/Amakazaam/AMAKAZAAM_full.wav` (461,676,174 B; BWF 295822203, i.e. frame 244004; 76,945,920 samples =
    40076 frames, so 244004–284080; ffprobe 2026-10-14). Not listened to. Are You Gonna Go My Way −19.42, You Oughta Know
    −20.02, Killing in the Name −18.88: the 9 dB limiter cap left them 3–4 dB under the show. Dean to choose between more
    limiting on those songs (mix-assist) or a clip-gain lift on the timeline.
    V2 Voyagers `starting_v1/V2-Voyagers/V2-VOYAGERS_full.wav` (hyphenated folder; 386,220,174 B; BWF 397006203, i.e. frame
    296704; 64,369,920 samples = 33526 frames, so 296704–330230, the show's end; ffprobe 2026-10-14). Not listened to. Every
    song hit the 9 dB cap: −17.05 to −19.14. RX1 is muted throughout because the events list only SM58 as live; check
    by ear that no backing vocal is lost.
  - **Whole show:** `starting_v1/SYDNEY26_full.wav`, an RF64 file (2,632,620,210 B, 24-bit stereo; BWF 22606203, i.e. frame 101704;
    438,769,920 samples = 228526 frames, so 101704–330230, the whole cut; ffprobe 2026-10-14). It holds the five sets plus
    rendered changeovers (vocal and talk mics only, gated, 6 dB under the songs, 0.5 s crossfades). Plan: put this one file on
    its own new track, "Starting mix v1 (whole show)", instead of three more set files on A3, then disable A2 and A3, or ask Dean. If the
    import refuses RF64, fall back to the set files on A3.
  - **Placed 2026-10-14 (Dean: "Do clip gain"):** RF64 imported fine (25 fps, Start TC 00:07:50:24). New A4 "Starting mix v1
    whole show (clip gain)" holds 52 pieces cut at the song-file boundaries (at a segue, the cut falls where the next song's file
    begins), appended with startFrame = rec − 101704 and mediaType 2. Read back: no gaps, every left offset = start − 101704.
    Measured each song in the whole-show file (ffmpeg ebur128; matches mix-assist's numbers) and lifted every song at
    −16.5 LUFS or below to −16 with `SetProperty("AudioVolume", dB)`, which works in 21.1.1 and reads back. 19 songs got
    +0.6 to +4.0 dB. A2 and A3 are off. Table: scratchpad `wholeshow_segs.json`. **About 11 songs now peak over 0 dBTP (up to +2.2,
    You Oughta Know):** Fairlight is floating-point, so playback is fine, but a render clips without a limiter on the Main bus.
- **mix-assist-21** was asked to stop cleanly, write `/Volumes/BOTTB/Sydney - 2026/mix/starting_v1/RESUME.md`, and resume
  by itself when the BOTTB drive is back.
- **When Dean says his edit is done:** diff "rough cut v3" against "rough cut v3 (auto baseline, don't edit)" and
  `gigstills/runs/sydney26_firstpass/cut_full/resolve_baseline_roughcut_v3.json` (item start/end/offset/angle name),
  and report patterns: shot lengths, angle swaps, cut moves, and his choices against the song-map features.
- **Open offers:** reset the colour-check clip's Roll node values; BNE-named stills masters. Per-set drum exposure trims,
  camera matching and the look (FLC) come later. TNR must be on before any RiP or delivery. Commits wait for Dean:
  bottb `docs/sydney26-multicam` (runbook, scripts, songmap) and gigstills `feat/log-source-input`.

### Look and Dean's Canvanauts edit against the auto cut (2026-10-14, evening)

- **Look:** Film Look Creator on the **timeline node** of "rough cut v3" (one node, the whole show), preset **Aurora**, defaults
  except a small Richness bump and **Skin bias 0.7** (Dean). **Halation is OFF for playback performance and must be ON for
  any render**: ask Dean to switch it on right before pressing render (the standing NOK rule).
- **Diff method:** dump V1 (start/end/left offset/angle name) via `run_script_unsafe` to scratchpad
  `roughv3_dean_20261014.json`, compare with `gigstills/runs/sydney26_firstpass/cut_full/resolve_baseline_roughcut_v3.json`
  (scripts `canv_diff.py`, `canv_diff2.py` in the session scratchpad). No item was slipped (left offset = start − 79500
  everywhere). Outside Canvanauts, the only change is one blade on the wide at 02:33:52:18.
- **What Dean changed, Canvanauts (02:07:36:05–02:33:49:05):** 281 → 355 shots, median 4.0 → 3.5 s, under 2 s 9 → 28.
  Angle time: pit 20.6 → 30.3 %, wide 35.5 → 24.9 %, tracking 28.6 → 25.6 %, Stage Right 8.0 → 12.4 %, drum 7.3 → 6.9 %.
  232 of 280 auto cuts kept to the frame; 48 removed, 122 added; he barely nudged cuts (4 within 12 frames). 26.9 % of the set
  shows a different angle.
- **Patterns:** (1) **Long holds get split:** 22 of 26 auto shots ≥ 12 s, 12/27 at 8–12 s, 23/53 at 5–8 s, 2/74 under 3 s,
  so the effective hold ceiling is ~5–8 s. So Easy (the ballad) went from 11 shots at a 13.4 s median to 26 at 4.8 s: no slow
  pace for ballads. (2) **Pit up, wide down:** the main swaps are wide→pit (94 s) and tracking→pit (86 s), mostly in choruses;
  wide→Stage Right in outros. (3) **Drum as a short insert:** 12 of his 21 new sub-2 s shots are drum. (4) Removed cuts are
  mostly short tracking pieces folded into the pit shot beside them (tracking|pit → pit ×7).
- **For the next auto pass (gigstills knobs, not done yet):** soft max hold ~6 s with no ballad exception, pit weight up
  ~1.5× relative to wide, Stage Right up in outros, drum allowed as 1–2 s inserts on fills.
- **`SetMarkInOut` / `GetMarkInOut` count from the timeline start; render jobs report absolute frames (2026-10-14).** On
  "rough cut v3" (start 79500, i.e. 00:53:00:00) `SetMarkInOut(200000, 200001)` read back 200000 but queued a job with
  MarkIn 279500, an hour into the wrong set. Subtract `GetStartFrame()` before marking, and read the job's MarkIn back
  before `StartRendering`. Every earlier Sydney 2025 timeline started at 0, which hid this.
- **Canvanauts grade, step 1 (2026-10-14):** look-on control frame `video/checks/canv_lookon_F200000_v1.mp4` (absolute
  frame 200000). Timeline node 1 (FLC) then disabled; measurement render `Renders/measure_Canvanauts_Syd26_lookoff_v1.mp4`,
  191405–230729, 1080p H.264, no audio, under the project's RCM v2 (output Rec.709 G2.4). Group Pre-Clips (camera
  match, drum +1.25 st, TNR, wide roll) stay on. Restore FLC and prove it byte-identical against the control.
- **Stage 0 on this project FAILS for `SetCDL` (2026-10-14).** The project is RCM v2 with timeline DaVinci WG /
  DaVinci Intermediate, output Rec.709 G2.4, output tone mapping None, gamut mapping None, **colour-space-aware grading
  tools ON**, and working luminance HDR 1000. Test item: Desk Tracking at 204995 (frames 205000–205245, look off), rendered
  at identity, then with S 1.1/1.0/0.9, O −0.02, P 0.85, then each parameter alone (`video/checks/stage0_DWG_*.mp4`,
  scripts `stage0_dwg.py`, `stage0_fit.py` and `stage0_single.py` in the session scratchpad). The recipe's model
  `clip(x·s+o)^p` on the Rec.709 output misses by up to 0.12 (tolerance 0.013). Mapped into DWG/DI, the response is a clean
  per-channel curve (fit mae 0.004), but not the commanded CDL:
  - **Offset −0.02 →** a near-constant ≈ −0.024 shift in DI, i.e. an exposure change, not a black-floor shift.
  - **Slope →** ratios that vary with level in DI (R 1.27→1.14, G 1.22→1.02, B 1.11→0.94).
  - **Power 0.85 →** an exponent of ≈ 0.76–0.84.

  **Do not apply recipe CDLs on this project as they are.** Candidate fix: per-clip LUTs that encode the exact recipe maths
  (DI → Rec.709 G2.4 → CDL → back), applied with `SetLUT`, since LUTs are not colour-space aware. That needs its own Stage 0.
  The test item's CDL is reset to identity, but not verified on pixels.

- **Look restore verified:** the FLC node is re-enabled, and `canv_lookon_F200000_restored_v1.mp4` matches the control
  frame for frame (framemd5). The look-off measurement frame at that time differs, so the bypass was real.
- **LUT route, first test (2026-10-14 ~23:25):** `dicdl_lut.py` (session scratchpad) builds a 65-point .cube: DI → DWG lin →
  709 → G2.4 → CDL → back. Installed in `/Library/Application Support/Blackmagic Design/DaVinci Resolve/LUT/BOTTB_Syd26/`,
  applied with `RefreshLUTList` and `SetLUT(1, "BOTTB_Syd26/x.cube")`. The identity LUT against no LUT gave mean |d| 0.005,
  p99 0.024 and max 0.14. The test CDL against the Rec.709 model is within 0.01 at 0.30–0.50, but **+0.018 to +0.034 in the
  shadows (0.02–0.10)** and −0.02 to −0.05 above 0.5. Cause: a uniform grid in DI is far too coarse near black, where one
  step of 0.0156 DI spans about 0.066 of Rec.709 code. Next: a 1D shaper ahead of the 3D grid, or a denser grid; repeat
  Stage 0.
- **`NodeGraph.ResetAllGrades()` does NOT remove a node LUT** (the tools still listed "LUT: stage0_test"). `SetLUT(1, "")`
  removes it. Test item verified back to its original state: the look-off render of 205000–205245 matches the pre-test
  identity render (framemd5). A `SetNodeEnabled(1, True)` call returned `{"error": ""}` but took effect: the look-on
  control frame matched (v1 = restored v2 = restored v3).
- **Auto cut v4 (2026-10-14, subagent; gigstills `cut_full/V4_REPORT.md`):** tuned to Dean's Canvanauts edit. Settings:
  - soft max hold 24 → 6 s, plus `aba_max_s` 6;
  - no ballad half-time pace, except the wide/tracking roll (`roll_bar_mult`);
  - pit reward 1.0 → 1.25, plus 0.2 in big sections;
  - Stage Right `outro_bonus` 0.5;
  - drum inserts allowed from 1 s on fills;
  - drum reward 0.58 → 0.45.

  On Canvanauts it matches his pace and shares (368 shots, median 3.8 s, pit 29 %), but only 12.6 % of the frames he changed
  land on his angle. `cutlist_show_v4.json` holds the four other sets (1323 shots), with the same spans as v3.

- **Dean's pit picks against the usability rules (2026-10-14; `cut_full/V4B_PIT_RULES.md`, contact sheets in
  `v4b_pit_review/`):** 25 % of his pit time sits on rejected frames.
  - **What rejected them:** the settle rules (3 s run, 12-frame entry, drift) and the pan/zoom rule, not haze. Pan max is
    what separates his picks (median 0.27 fw/s) from the bad windows (whips over 0.6).
  - **Relaxed rules** (no settle requirement, block sustained pans over 0.35, whips over 0.6 and zooms over 0.25) admit his
    picks, but every variant, including one gated to the featured performer or choruses, lowered overall agreement (45–53 %
    against v4's 55 %) and pit precision. So v4 stands; the relaxed rules sit in the code behind spec keys, off by default.
  - **Lesson:** his pit choices are editorial (which moment), not a usability threshold.
- **Resolve's Rec.709 Gamma 2.4 output on this project is not a 2.4 gamma (measured 2026-10-15).** The look-off Canvanauts
  set was rendered twice in ProRes 422 LT: once with output DWG/DI (`Renders/measure_Canvanauts_Syd26_lookoff_DWGDI_v1.mov`,
  output switched for the render only) and once with output Rec.709 G2.4 (`..._709PR_v1.mov`). Paired pixels show the
  output follows the **Rec.709 camera curve (4.5·L toe) up to about lin 0.2, then a highlight shoulder** (lin 1.0 → about
  0.74–0.78), and it is not per-channel. It's probably the RCM v2 working luminance HDR 1000 into SDR. A model per channel misses by up to 0.03. Settings
  restored to Rec.709 / Gamma 2.4 and read back.
- **Grade by data-driven LUT, method (2026-10-15).** A delta-form 65³ LUT in DI: node v = v + mean over measured pixel
  pairs near v of [Ti(CDL(a)) − Ti(a)], where a is the measured Rec.709 display value and Ti is a fitted Rec.709 → DI map
  (per-channel curve plus a 33³ residual grid, held-out error 0.0024). Empty nodes fall back to the model. Scripts in
  the session scratchpad: `xform_pairs2.py`, `xform_fit3.py`, `lutbuild3.py`, `lutdata.py`, `make_grade_luts.py`,
  `verify_luts.py`. **Stage 0 with the strong test CDL:** bias ≤ 0.011 in every band, mean |e| 0.008. **Pitfall:** a script that
  `exec`s the DI constants (`A`, `B_`, …) and then names an array `A` silently breaks `di_dec`.
- **Canvanauts graded (2026-10-15, Dean away: "don't stop till you've got a final result").** Recipe and Dean option by
  subagent (`gigstills/runs/sydney26_canvanauts_grade/`, `apply_final.json`: 179 cuts). **163 LUTs applied** with
  `SetLUT(1, "BOTTB_Syd26/canv26/canv26_cNNN.cube")` (`/Library/Application Support/Blackmagic Design/DaVinci
Resolve/LUT/BOTTB_Syd26/canv26/`, 1.2 GB), all read back. **16 held for Dean's review** (shadow wash stripped: 18, 77, 91,
  131, 164, 166, 171, 190, 191, 193, 233, 240, 281, 289, 354; and 44); their LUTs are built but not applied. **Verify render**
  `Renders/verify_Canvanauts_Syd26_lut_lookoff_v1.mp4` (look off): the 163 graded cuts land on the recipe's prediction
  (median Y error ≤ 0.0012 at p0.1/p5/p10/p50; worst cut 0.023 at p10; median pixel |e| 0.007), and 31 ungraded
  controls are unchanged. Undo one cut: `SetLUT(1, "")`. Look re-enabled and confirmed on pixels.
- **v4 laid into "rough cut v3" (2026-10-15 ~01:00, Dean away).**
  - **Backup:** "BOTTB Sydney 2026 - rough cut v3 (backup before v4 recut, 2026-10-15)", made with `DuplicateTimeline`
    (1358 items, with LUTs). **`DuplicateTimeline` makes the copy the current timeline:** switch back with
    `SetCurrentTimeline` before editing.
  - **Checked first:** all four sets matched the auto baseline item for item (Dean hadn't touched them).
  - **Per set:** `DeleteClips(items, False)`, then `AppendToTimeline`, then read back. ShipReX 378, Bandlassian 291,
    Amakazaam 349, V2 Voyagers 305. V1 is 1684 items, contiguous 79500–360347. Canvanauts is untouched (354 items, 163 LUTs).
  - **Coloured by angle** (1 Blue, 2 Purple, 3 Green, 4 Yellow, 5 Pink; read back). Every piece lands on the default angle,
    Static Desk, until Dean switches by colour.
  - **Markers:** 162 old Sand PIT markers in those spans replaced by 240 new ones. One failed at frame 297469 (V2), probably
    because a marker already sits on that frame.
  - **Trap:** I fired the delete and append calls in parallel. They ran out of order, and the permission check refused
    two of them (one Bandlassian append, one V2 delete). An append onto occupied frames returned 305 "items" but placed
    nothing. **Run timeline edits strictly one call at a time, and assert the span is empty before appending.**

### Recipe power-window suggestions land on the light, not the subject (Canvanauts Sydney 2026, 2026-10-15)

Dean asked whether the recipe's `segment` windows were worth applying (he never had). Every cut has one
(`cut_recipe.json` → `segment.ellipse`, `inside_cdl`); 61 of 354 pass gain ≥ ×1.10 over the applied grade,
stability ≥ 0.6 and subject 4–45 % of frame. **Drawn on the frames, the top ones sit on haze, the projection
screen or the lights, not on the performer** (cut 129 and 141: keyboardist's face on the left, window on the red
haze to the right; wides: window on the screen above the band). The mask is the exposure metering's "lit" region,
so on this show it finds light, not people, on close shots as well as wides. Do not hand these to Dean as window
positions; a subject window needs a face/person detector (YuNet is already in `face_expo.py`). Sheet:
`gigstills/runs/sydney26_canvanauts_grade/window-candidates-sheet.html` (left: window, right: rough gain preview).

- **Face metering (research, 2026-10-15):** on Canvanauts, YuNet face luma has no rank correlation with the recipe's
  `lit_median` (ρ −0.05, 172 cuts) and jumps a median 0.92 stop between adjacent face cuts (recipe metric 0.26): the
  recipe's subject is the light. Also 159/354 cuts have a bright wash with one channel at 0 (gamut clip, which fakes a
  "zero floor"), and coloured veils make the white Haze Color in the Dehaze hand-over wrong. Ranked plan and API facts
  (clip/timeline mattes are API-addable): `gigstills/runs/sydney26_canvanauts_grade/grade_research/REPORT.md`.
- **The applied Canvanauts grade is nearly invisible (Dean: "I can tell barely any difference between the before and after
  clips", 2026-10-15).** Measured from `apply_final.json` (179 non-identity cuts): median luma change −0.005 at p0.1/p5/p10/p50
  (≈ 1 code value), 90 % of cuts within −0.03, max 0.09. 144 of them are the lift-to-touch on floors the camera match had
  already put near 0, plus gamma 0.97. It is a black-level tidy, not a grade. Visible gains are in face exposure (0.9 stop
  neighbour jumps), gamut clipping and coloured-haze Dehaze (see the research entry above). The window-sheet preview also
  looks unchanged because its gain lands on haze, not people.
- **Face metering, first run (Canvanauts, 2026-10-15; gigstills `runs/sydney26_canvanauts_grade/face_meter/`).** YuNet on the
  4,059 look-off measurement frames (480×270 `.npy`, 2× upscale, gamma-lifted view for detection): 66 s, 163 MB. Close angles
  (Pit, Tracking, Drum) give a face on ≥ 4 frames in 200 cuts; wides' faces are 9 px and Stage Right is mostly backs, so
  leave those out. A cut's face level repeats within 0.42 stop median (split-half), and neighbours jump 1.5–1.8 stop median.
  **Take the brightest face in the frame, not the largest**: the largest was often a dim side player while the lit singer went
  undetected or smaller. **A 1-stop lift (×1.33 display) is barely visible at preview size**; cap 2 stops at 70 % of the way to
  the set median face (0.193 look-off) lifts 77 cuts (median +1.0 stop) and cuts the neighbour jump median 1.46 → 0.97 stop.
  Lift only, per-channel `y(1+k)/(1+ky)` (black fixed, highlights roll off). Unverified: FX30 drum noise at +2 stops.
- **Plan the face lift on the GRADED face, not the measurement render's (2026-10-15).** The first face LUTs, sized on the
  ungraded faces, overshot where the recipe's exposure gain was already in the base CDL (cut 132: Slope 1.6, mid 0.055 →
  0.115), e.g. face 0.17 → 0.33 for a 0.185 target. v2 (`face_plan_v2_postgrade.json`) applies the base CDL to the face
  pixels first and solves k by bisection on the median face luma: 83 cuts, median +1.05 stop, neighbour jump 1.45 → 0.87
  stop. LUTs `BOTTB_Syd26/canv26f/canv26f_cNNN.cube` = base CDL then lift (44 replace a canv26 LUT, 34 on ungraded cuts,
  5 face-only on cuts whose base is held); canv26 files kept for rollback. LUT vs exact model on face frames: p50 0.002,
  p99 up to 0.22 (the old, render-verified LUTs show 0.05–0.07 tails on the same check). Not applied, not render-verified.
  A model check through `T(Ti(x))` is lossy on saturated face pixels (0.159 → 0.122 round trip), so verify on a render.
- **Face-lift noise clip spec (Dean, 2026-10-15: "make sure this is full res, will be needed to see noise").** Render at the
  timeline's native resolution (read it from the timeline at render time; no downscale), ProRes 422 HQ so the codec neither
  hides nor adds noise, look ON, halation ON (ask Dean first). Range: 02:18:07:14–02:18:33:xx (record 207189–207844 + the
  rest of cut 143), which holds drum cuts 140 (+2.0 stop) and 143 (+1.9). Render it twice, with the old canv26 LUTs and with
  the canv26f face LUTs, so Dean can A/B the noise. Other +2 stop drum cuts: 279 02:29:22:09, 245 02:26:32:17, 106 02:14:57:06.
- **Face-lift LUTs applied and verified (Canvanauts, 2026-10-15 afternoon; Dean: "It looks good").** 83 cuts `SetLUT(1,
canv26f/canv26f_cNNN.cube)`, read back; rollback map `face_meter/rollback_before_canv26f.json` (44 had canv26, 39 none).
  Look-off verify v1 (`Renders/verify_Canvanauts_Syd26_facelut_lookoff_v1.mp4`, 268 s): faces landed +0.11 stop median over
  target, overshooting on 27 cuts by 0.15–0.57 stop (the data-driven LUT lifts a little more than the display model;
  cut 140 drum +2.5 against a 2-stop cap). **One closed-loop pass fixed it:** re-aim those 27 at target²/measured, rebuild as
  `canv26f_cNNN_r1.cube` (new names so Resolve can't serve a cached table), re-apply, re-render (v2, 265 s): face error
  median 0.03 stop, p90 0.13, max 0.21; max lift 2.18 stop; 271 untouched cuts unchanged (frame median ≤ 0.0017);
  measured neighbour face jump 1.48 → 0.78 stop. Face measurement on renders: `scratchpad/verify_face_render.py` (same
  sample frames and face boxes as the plan, 48 s, 0.15 GB). Plan of record `face_meter/face_plan_v3_closedloop.json`.
  FLC re-enabled (read back), In/Out cleared (Dean had none), project saved.
- **Drum noise after the face lift (Dean, 2026-10-15: "they looked pretty noisy to me since the correction").** Measured
  look-off on the 1080p verify renders (base `verify_..._lut_lookoff_v1` vs `facelut_lookoff_v2`), 4 frames per drum cut,
  Immerkaer σ on flat shadow pixels (Y 0.01–0.15): **lifted drum cuts ×1.73 median (p90 ×2.22, cut 106 ×2.5, 143 ×2.3);
  12 unlifted drum controls ×1.00.** Dean is right; the cap of 2 stops is too much for the 8-bit FX30. Script
  `scratchpad/drum_noise.py` (per-frame `-ss` seek, checked frame-exact against `select=eq(n,…)`; a long `eq()` chain
  makes ffmpeg fail with "Cannot allocate memory"). **Slip:** the first version held all 352 1080p float frames at once,
  8.9 GB peak with no memcheck; stream frame pairs (0.28 GB).
- **Look change (Dean, 2026-10-15): FLC halation ON, vignette OFF** on the rough cut v3 timeline node.
- **4K noise A/B (2026-10-15 ~16:55), `video/checks/noise_drum_021807_{A_oldgrade,B_facelift}_{lookoff,lookon}_4K_v1.mov`**
  (207189–207843, ProRes 422 HQ, 655 frames each; A = canv26 LUTs on cuts 140/143, B = face LUTs; look on/off differ 0.028).
  Shadow σ B/A: cut 140 ×1.66 off / ×1.75 on; cut 143 ×2.11 off / ×2.32 on. Look on doesn't change the ratio. ProRes
  `SetRenderSettings` returns False when `MultiPassEncode` is passed (the rest of the settings still apply; read the job back).
- **Dean's Spatial NR (threshold 100) is not on cuts 140/143:** their clip graphs hold one node (the LUT) and a
  20-frame look-on render of cut 143 after he added it matches clip B (σ 0.0139 vs 0.0139; mean |d| 0.0008). It must be on
  another cut, or in the drum source's group inside the multicam, which the API can't read through the multicam item.
- **Drum cap +1.5 stop + Dean's Spatial NR at 100 in the CAM 5 group (2026-10-15 ~17:30).** 10 drum cuts re-aimed at +1.5
  (`face_plan_v4_drumcap.json`, LUTs `canv26f_cNNN_r2.cube`, closed-loop factor kept), applied, read back. 4K look-on
  render `checks/noise_drum_021807_C_cap15_NR_lookon_4K_v1.mov` (655 frames): **383 s against 42 s without NR (×9)**.
  Shadow σ: cut 140 A 0.0059 / B 0.0103 / C 0.0021; cut 143 0.0063 / 0.0146 / 0.0024; unlifted 141/142 0.0038 → 0.0021.
  **Edge detail (Laplacian on the top 5 % gradients, relative) A 0.59–0.62 → C 0.11–0.12: threshold 100 removes ~80 % of
  fine texture** (1:1 crop: beard texture smoothed, waxy). Noise is now well under the original grade, so there is room
  to lower the threshold.
- **Render range trap (2026-10-15):** after Dean opened the multicam in a timeline and came back, `AddRenderJob` took the
  whole timeline (79500–360346) although `GetMarkInOut` showed my range, twice. Guarded by reading the job back before
  `StartRendering`; fixed by passing `MarkIn`/`MarkOut` (absolute frames) in `SetRenderSettings`, allowed here only
  because the In/Out was mine, not Dean's. Delete the wrong job (`DeleteRenderJob`) and re-add.
- **Correction to the entry above (Dean's screenshot, 2026-10-15):** clip C's NR is **AI UltraNR** (Spatial NR mode) in the
  CAM 5 group's Noise Reduction node, profile from **Analyze: Luma 0.041, Chroma 0.016**, not a threshold of 100. (Analyze
  first "didn't seem to do anything" for Dean; it worked once the drum clip was the one being viewed.) The UltraNR sliders
  are the analysed noise level, so lowering Luma below 0.041 weakens it. **My "~80 % of fine texture" figure overstates the
  loss:** Laplacian energy on edges also counts the noise on those edges, so removing noise reads as lost detail. By eye at
  1:1 the beard texture is smoothed but still readable. A fair detail check needs a noise-free reference (e.g. a temporal
  mean of a static stretch).
- **Decision (Dean, 2026-10-15): "Yep it looks fine, I'll bypass it and continue to edit."** UltraNR (Luma 0.041 /
  Chroma 0.016) stays in the CAM 5 group's NR node with the TNR, bypassed while editing. **Delivery checklist step 1 now
  covers both: un-bypass the CAM 5 NR node (TNR + UltraNR) before any RiP or delivery render**, and budget about 9×
  render time on drum shots. Face lift final: 83 cuts, drum cuts capped at +1.5 stop.
- **v4 angles switched by Dean and verified (2026-10-15 evening):** all 1,323 coloured V1 pieces read the right angle by
  `GetName()` (Purple 193 Stage Right, Green 276 Desk Tracking, Yellow 325 Photo Pit, Pink 185 Drum, Blue 344 Static Desk),
  0 wrong. Colours cleared (0 left), saved. `ClearClipColor` over all of V1 timed out at 60 s on the first call (108 done)
  while Resolve was busy, then cleared the remaining 1,215 in 22 s: loop with a time budget and re-read.
- **"Hidden-dark" cuts are lighting cues, not exposure (2026-10-15 evening).** The recipe's hidden-dark flag fires on a dark
  run inside a cut ("rules fire on the state, not the cut"), so a per-cut LUT can't fix it and the API can't keyframe.
  Frame by frame on the graded look-off render (top-20 % luma per frame, run = < 0.8× the cut median for ≥ 10 frames;
  `face_meter/hidden_dark_dips.json`): 266 head 2.8 s −1.1 stop on the lights but frame median unchanged; 231 two
  flickers of 0.4–0.7 s; 353 none; **268 opens on a 2.5 s blackout (−4.7 stop, to 02:28:26:09)**; **153 ends on a 1.6 s
  dip (−2.2, from 02:19:39:22)**; **269 ends on a 1.6 s dip (−1.3, from 02:28:32:19)**. No grade; offered Dean editorial
  trims for 268/153/269. My earlier "lift them with a LUT" offer was wrong, because I hadn't read what the flag measures.
- **Dehaze haze colours (2026-10-15):** `face_meter/haze-colour-picks.html` + `haze_colours.json`, 18 veiled cuts. Veil
  colour = median RGB of smooth, unclipped pixels at the 75–95th luma percentile of the stage region (4–55 % down, 5 % side
  margins) over 5 frames of the graded look-off render. The 40–80th percentile first try landed on dark walls and corners.
  Picks: all coloured except cut 85 (#CDCED9) and 2 (#A08DA8). On 87, 173 and 341 the ring lands on the projection screen,
  so sample the smoke beside it. A colour-normalised dark-channel transmission was meaningless here (negative, or 1.0)
  because the veils have a channel at 0; rank strength by the recipe's score instead. Dehaze remains a UI move.
- **Haze colour must be measured at the frame Dean is looking at (Dean, 2026-10-15: "There isn't magenta smoke only white
  smoke at 2:14:00:14").** Cut 91 opens on a red/magenta wash for about a second, then white smoke; my 5-frame median gave
  #E02CCD. At the parked frame it is #D2D2E4–#DCDDEE. 13 of the 18 veiled cuts change lighting inside the cut (hue spread
  > 0.25). Use `face_meter/haze_colours_v2_atpark.json` (measured at the cut middle where I park the playhead) and tell
  > Dean when the lighting changes. Dehaze settings log: `face_meter/dehaze_log.json` (85: #CDCED9 at 0.3, "doesn't really
  > improve after that").
- **Dean's Dehaze method (2026-10-15): "I think I get the best results from that adjustment plus white haze, at least on
  these few cuts."** The adjustment is shaping the depth map with Shadow/Highlight (Display Depth on: stage and band
  dark/mid = far = more dehaze; crowd light = near = protected), plus Haze Color white. So my measured-colour advice lost to
  white on the first cuts he tried (85, 91, 87). Default to white + depth shaping; offer the measured colour only if white
  leaves a cast.
- **Dehaze pass done (Dean, 2026-10-15 evening):** all 18 recipe-ranked veiled cuts read back with `OFX: Dehaze` on clip node 2
  (node-1 LUTs intact), white haze + Shadow/Highlight depth shaping, values set by eye and not reported (cut 85 started at
  Strength 0.3). Driven one cut at a time by parking the playhead mid-cut (`SetCurrentTimecode`, then
  `GetCurrentVideoItem().GetStart()` to confirm the cut). Dynamic-zoom cuts 170, 226, 109 and 139 carry an AI depth estimate,
  so they belong in the RiP set and need their edges checked after it. Log: `face_meter/dehaze_log.json`.
- **Output gamut mapping can't be set by API on this project (2026-10-15).** `SetSetting("colorSpaceOutputGamutMapping",
"Saturation Mapping")` returns False and reads back "None". The 21.1.1 stub lists 'None', 'Saturation Mapping', 'RED IPP2
  Gamut Mapping'; the manual's "Saturation Compression" is not a valid value. It is also refused with output tone mapping
  set to DaVinci (tested, then restored to None, read back). The knee is refused while mapping is None. So it's a UI move:
  Project Settings → Color Management → Output → Gamut Mapping Method. Control render for A/B:
  `checks/gamut_A_none_lookon_021325_v1.mov` (200129–201128, look on, 1080p ProRes HQ, 58 s).
- **Correction (Dean, 2026-10-15: "These are the options in color management, did you check the manual?").** In 21.1 RCM
  the panel has **Input DRT / Output DRT** (this project: both **DaVinci**) and "Limit output gamut to" (Output color
  space). There is no Gamut Mapping Method in the panel. The live API keys are **`inputDRT` / `outputDRT`**;
  `colorSpaceOutputToneMapping` and `colorSpaceOutputGamutMapping` are legacy keys that read "None" and change nothing.
  My earlier notes saying "output tone mapping None" were wrong: the output DRT is DaVinci, which is the highlight shoulder
  measured in "Resolve's Rec.709 output is not a 2.4 gamma". (My Set "DaVinci"/"None" on the legacy key had no visible
  effect; Dean's screenshot after it shows the DRTs as they were.) Read manual ch. 9 pp. 239–240 for colour management,
  not the Fusion or Resolve FX copies of the same words. Gamut compression on 21 = a node: a CST pair on the timeline
  graph before the FLC (DWG/DI → Rec.709 with Gamut Mapping: Saturation Mapping, then Rec.709 → DWG/DI).
- **Look change (Dean, 2026-10-15 ~19:00), FLC on the rough cut v3 timeline node:** Exposure raised to **0.1**; **Split Tone
  ON, Mode Strong, Amount 0.300, Hue Angle 35.0, Pivot 0.450** (amber highlights, teal shadows). Dean: "barely any
  difference" in Natural even at Amount 1. On this footage the tint shows only on near-neutrals (white smoke, skin), so
  judge it on the vectorscope or on smoke. The hue slider runs 0 red / ~90 yellow / ~180 blue-green on Dean's screen, so
  amber is 35–45.
- **Drum "clipping" Dean saw (2026-10-15 ~19:30) is gamut, made in Resolve, not in the camera.** Ungraded look-off render
  (with group pre-clips), one mid-frame per cut: **white clipping (all channels ≥ 250) is 0 % on every drum cut**; single-channel
  clipping (max ≥ 250, min < 200) is p90 **22 %** on Drum, 16 % Stage Right, 9 % Pit, 7 % Static Desk, 0.1 % Desk Tracking.
  The old grade and the face lift barely move it (cut 29 25.9 → 27.5 %; `face_meter/drum_clip_lookoff.json`). **Source C1364
  (`/Volumes/BOTTB SYD26/DRUM CAM/`, frame = record − 182620) never nears the S-Log3 ceiling:** p99.9 max-channel code 102–225
  of 255, 0 % of pixels ≥ 235, on the cuts that clip 16–29 % in the render. Cause: saturated blue/magenta pushed out of
  Rec.709 by the CAM 5 +1.25 st and clipped at output. Fix: the CST gamut-compression pair (or a drum-only CST in the CAM 5
  group), not less exposure.
- **Look-on check after Dean's split tone (2026-10-15 ~19:40; `Renders/lookon_Canvanauts_Syd26_splittone_check_v1.mov`, full set
  1080p ProRes LT, 33 min, 39,325 frames; `face_meter/lookon_check_v1.json`).**
  - **Split tone works as intended but is small:** on near-neutral pixels against the pre-change control
    `gamut_A_none_lookon_021325_v1.mov`, highlights moved toward hue 150° (Cb/Cr atan2; amber), +0.014 chroma, +0.007 Y;
    shadows toward 330° (teal-blue), +0.010 chroma.
  - **Faces look-on still sit at hue 78–85° against the ~123° skin line** (≤ 2 % within ±20°), red-magenta. The split tone
    doesn't move them meaningfully.
  - **Clipping with the look on is rare on mid-frames** (single-channel p90 ≤ 0.5 % every angle, 0 white). The FLC/DRT tames
    most of what the look-off render showed. **But 7 drum cuts under red floods pin the red channel at their worst moments,
    21–32 % of the frame:** 202 (02:23:14:13), 304, 172, 72, 245, 340, 315. Scan bug to avoid: with `select=not(mod(n,5))`,
    `-frames:v` counts _output_ frames, so pass ceil(n/5) or the scan runs into the next cuts.
  - **Those reds are out of gamut AND bright** (DWG/DI measurement render: 40–86 % of pixels have a negative Rec.709
    channel; red reaches 8–11 scene-linear). An RGC-style gamut compression folded into the cuts' LUTs (ACES defaults,
    into Rec.709; `scratchpad/rgc_lut.py`, `LUT/BOTTB_Syd26/gamut_test/`) helped only a little: worst red clip 33.5 → 30.4 %
    (202), 26.7 → 20.1 % (304), 23.0 → 22.3 % (245). The picture went pinker and lighter (sat 0.35 → 0.27), with skin less red.
    Original LUTs restored and read back; test renders `checks/gamut_rgc_lookon_c202/304/245_v1.mov`. Gamut compression
    alone won't fix the red floods; they also need less level (or a highlight roll-off) on those drum cuts.
  - Dehaze: no edge strips on the four zoomed cuts (start/end frames). No pre-Dehaze render exists, so crush can't be
    attributed; near-black share on the Dehaze cuts is 17–56 %, mostly crowd silhouettes.
- **Red-flood drum fix applied (Dean: "Yep do it", 2026-10-15 ~20:00).** 7 drum cuts (202, 304, 172, 72, 245, 340, 315) now
  carry `BOTTB_Syd26/redfix/redfix_A_cNNN.cube` = their previous LUT followed by a **hue-preserving max-RGB shoulder in
  Rec.709 scene-linear (knee 1.0, asymptote 3.0)** (`face_meter/redfix_lut.py`; rollback `face_meter/redfix_rollback.json`).
  Look-on renders `checks/redfix_{A,B}_lookon_cNNN_v1.mov`, sheet `face_meter/drum-redfix-sheet.html`: **worst red-channel
  clip 21–33 % → 0.4–3.6 %**, faces unchanged (±0.01), frame median −0.00…−0.03. Variant B (shoulder + RGC) reached 0 % but
  washed the frame to salmon (median 0.31 → 0.42) and lifted faces; not used. The shoulder works where the gamut
  compression alone didn't (33 → 30 %), because these reds are mainly over-bright (red at 8–11 scene-linear).
- **Beams in haze (2026-10-15 evening).** Dean: FLC Highlights, Bloom, Halation and a Glow at threshold 0.6 did little. Measured
  (DWG/DI render, scene-linear): on the wide at 02:24:57:17 only 1.9 % of the frame is above 1.0 and 0.2 % above 2.0; **the beams
  sit 1.5–2 st over mid grey (0.4–0.65 linear = DI 0.42–0.47; grey 0.34, white 0.51, 2.0 → 0.59)**, so highlight effects only
  catch fixtures, and a node-space threshold of 0.6 selects ~0.2 %. FLC Exposure now **0.2** (Dean). A curve can't be set by
  API, so I built it as a LUT for a timeline node after the FLC (`scratchpad/curve_lut.py`: display-space luma curve via the
  fitted T/Ti, hue-preserving; points 0.10→0.08, 0.30→0.22, 0.50→0.46, 0.60→0.60, 0.80→0.80; the first build lifted 0.8 →
  0.83 until a hold point was added; the variable `C` collided with the DI constant, so name it CURVE) →
  `LUT/BOTTB_Syd26/look/beam_gap_curve_v1.cube` on **timeline node 2** (Dean added the empty node). Cut 226 look-on, node on vs
  off (`checks/beamcurve_{ON,OFF}_c226_v1.mov`): beam cores 0.845 → 0.845, haze gaps 0.375 → 0.338, **beam/gap 2.25 → 2.50**.
  Node 2 has no window yet, so the band darkens with the haze. `SetNodeEnabled` on the timeline graph returned `{"error": ""}`;
  the API has no GetNodeEnabled, so state was confirmed by a 2-frame render matching the ON clip (mean |d| 0.000 vs 5.9 OFF).
- **Noise on cut 144 (02:18:35:04, Dean "looks completely borked") is source noise lifted, not the LUT method:** flat-area noise
  ungraded → graded ×1.81 / ×2.48 / ×2.19 on three frames against the grade's slope at that level ×2.09 / ×2.23 / ×2.10. LUT
  roughness (mean |2nd diff|) 0.00784 against 0.00778 for a smooth model LUT of the same CDL. The cut's base grade is a big
  recipe exposure lift (Slope 1.6–1.69, Power 0.85), so the cure is less lift or NR.
- **Cut 144 lift pulled down (Dean, 2026-10-15: "I added nr, its not quite enough, probably needs the lift pulled down a
  little").** Dean's OFX Noise Reduction is clip node 2 (after the LUT). Node 1 changed `canv26_c144.cube` →
  **`canv26_c144_lower.cube`**: same CDL with Slope/Offset × 2^(−0.5/2.4) (−0.5 stop) and Power 0.848 → 0.90 (the power < 1
  is what steepens the shadows). Predicted noise gain ×2.0 → ×1.5 in shadows. Rendered with NR on (`checks/c144_NR_{oldlift,
lowerlift}_v1.mov`): **flat-area noise −21 %, frame median 0.124 → 0.091**, face still readable. Script
  `scratchpad/c144_lower.py`. Rollback: SetLUT(1, "BOTTB_Syd26/canv26/canv26_c144.cube").
- **The LUT method had real defects (Dean, 2026-10-15 ~21:00: "I am dubious of this LUT approach … I feel like this is what has
  made this problem worse"; "obvious pixels the same color next to obvious pixels of a very contrasting color").**
  1. **The fitted display→DI inverse `Ti` jumped.** HY (per-channel display curve) was made monotone by
     `maximum.accumulate` + 1e-7 steps, so it has plateaus; `np.interp` inverting a plateau leaps (up to 0.085 DI for a
     0.00005 change, at display ≈ 0.07/0.17/0.21/0.38), and the inverse is flat below the curve's floor (0.03–0.11).
     Every LUT used `Ti`, so neighbouring pixels could split wherever the grade moved a colour across a jump.
  2. **A smooth monotone inverse is worse, not better** (16,628 vs 3,919 near-identical real colour pairs landing > 0.05 DI
     apart): the real transform is flat where Resolve compresses (toe, saturated channels pinned at 0), so ANY inverse is
     steep there. A damped least-squares inverse "hit" display targets by moving the hidden (pinned) channel, which the look
     then shows. **Don't build grades by inverting a look-off display model on this footage.**
  3. **The red-fix shoulder divided by the max channel with a 1e-9 floor**, so near-black pixels whose max 709-linear
     channel is negative exploded to bright grey. Live on the 7 red-fix drum cuts until replaced.
  4. **The beam-gap curve LUT on timeline node 2** inherited (1) show-wide. Removed (`SetLUT(2, "")`), node left empty.
  - **Fix: parametric scene-linear grades fitted through the forward model only** (`scratchpad/plut.py`): per-channel
    gain + offset in 709 linear, hue-preserving luminance gamma with a toe (0.02), saturation, optional max-channel shoulder
    (above knee only); 8 numbers per cut, fitted by least squares so `T2(grade(v))` hits the approved display target on 4
    of the cut's DWG/DI frames. Continuous and order-preserving by construction. Near-identical pair test (150k real
    colours, σ 0.003): c144 452 → 5 jumps, face c140 283 → 0, base c001 38 → 0, red fix 0 (after fix 3). Cost: fit error
    median 0.003–0.006 on base grades, ~0.02 on strong face lifts.
  - **Audit that did NOT find it, recorded so it isn't trusted again:** "LUT vs a Gaussian-smoothed copy of itself" flags any
    curved LUT (a smooth model LUT scored as badly). And on the 19:05 look-on render, stray-pixel counts per cut were the same
    with and without my LUTs angle by angle. The worst cuts were drum shots with **no** LUT, so the drum source (8-bit H.264,
    +1.25 st group) carries its own speckle. Both can be true.
  - Third time today a library constant was overwritten by a script variable (`C`, `A`, `B_` in `dicdl_lut2.py`). Load the
    colour maths as a module namespace, or never use single-letter names in scripts that `exec` it.
- **v3 parametric LUTs live on all 203 Canvanauts cuts (2026-10-15 ~22:00; Dean: "just fix everything").** Built by
  `scratchpad/build_param_all.py` → `LUT/BOTTB_Syd26/v3/<same basename>` (map + fitted parameters
  `face_meter/lut_v3_param_map.json`; old→new plan `face_meter/apply_v3_plan.json`; the inventory of the old LUTs is the
  rollback: `face_meter/lut_inventory_20261015.json`). Applied in 4 batches with read-back (each checked the expected old LUT
  first); families now v3 203 / none 151. Cut 144 uses the non-crushing variant (offset/2, power 0.88). The red-fix shoulder
  bug (fix 3 above) is gone in v3.
  - **Verify** (`Renders/verify_Canvanauts_Syd26_v3param_lookoff_v1.mp4`, 370 s, 39,325 frames; `face_meter/verify_v3_param.json`,
    one mid-frame per cut at 960 px). Model-free accuracy (render against the approved display grade applied to the ungraded
    render's own pixels): **base grades median 0.0097 (p90 0.013), face lifts 0.0145 (p90 0.025)**, worst 0.042. Cuts with
    Dehaze/NR nodes are excluded, because node 2 changes them. Ungraded single-node cuts unchanged (max 0.008). Stray
    contrasting pixels (|x − 3×3 median| > 0.2 with < 0.1 brightness change): ungraded 0.0008 % mean, old LUTs 0.0010 %,
    v3 0.0010 %, and 0 cuts where either adds > 0.01 pct-pt over ungraded. So at look-off neither LUT set adds stray pixels
    at that level. What Dean saw is look-on, where the hidden-channel/inverse effects would show. v3 removes the
    mechanism by construction (no inverse). Look state after verify: FLC re-enabled, checked on pixels (2-frame look-on render
    vs look-off, mean |d| 13.3); cut 144 look-on is clean, without the crush.
- **Beam curve v2 (no inversion; Dean: "1. Yes let's do that", 2026-10-15 ~22:30).** `scratchpad/beam_v2.py`: knots placed on
  the neutral axis through the forward model T2 only (display 0.10→0.08, 0.30→0.22, 0.50→0.46, 0.60/0.80 held = DI 0.128→0.111,
  0.284→0.237, 0.389→0.369), PCHIP in DI on 709-linear luminance, hue preserving. Greys land exactly; pair-jump test 0.
  `LUT/BOTTB_Syd26/look/beam_gap_curve_v2.cube` on **timeline node 2** (read back). Cut 226 look-on vs curve off
  (`checks/beamcurve2_ON_c226_v1.mov` vs `beamcurve_OFF_c226_v1.mov`): beams 0.845 → 0.845, gaps 0.375 → 0.353, **beam/gap
  2.25 → 2.39** (v1 gave 2.50 via the faulty inverse); band zone 0.275 → 0.236 without a window, so Dean adds a top gradient
  window. No trim/roll-edit call exists in the 21.1.1 API (only delete + append, which resets the multicam angle and drops
  the grade), so the 3 blackout trims are Dean's UI roll edits.
- **Skin hero list** (`face_meter/skin_hero_magenta.json`): YuNet faces ≥ 28 px at 480 wide, ≥ 2 s, look-on render. Most
  big-face cuts are under blue light (hue 300–340°): that's lighting, so leave it. The fixable set is lit faces (Y > 0.08)
  leaning magenta (hue 40–115° against the 123° skin line): 37 cuts, top: 02:11:47:13, 02:10:57:12, 02:19:30:16,
  02:23:09:24, 02:15:57:17, 02:29:37:14, 02:09:55:24, 02:10:29:22, 02:07:48:00, 02:07:55:06.
- **Correction (Dean, 2026-10-15: "First one is dark not a blackout").** Cut 268's opening 2.5 s: the brightest 20 % of the
  frame drops 4.7 stops, but the frame median only 0.47 stop. That's a dark lighting state, not a blackout. My dip metric
  (top-20 % luma) overstates darkness; describe dips by the frame median as well. No trim needed. The other two (153 end:
  lights −2.2, frame −1.05 st; 269 end: lights −1.3, frame −1.07 st) are for Dean's eye.
- **"Is the set too dark?" (Dean, 2026-10-15 ~23:00; "or is it going to hold up on tvs and phones and computers").** 40 s
  look-on window (02:13:25–02:14:05) across states: frame mean 0.296 (18:47) / 0.298 (19:05) / 0.288 (21:30) / 0.310 (now);
  near-black (< 0.06) 34.8 / 36.2 / 37.9 / 33.6 %; **faces 0.226 / 0.219 / 0.157 / 0.171**. The set wasn't darker; the faces
  were, because the windowless beam curve darkened mids. Rule of thumb given: faces 0.25–0.30 look-on for online delivery
  (phones in lit rooms and YouTube compression lose detail near black; Macs show 2.4 files a bit lighter). Dean's CST pair
  (gamut compression) is now timeline nodes 1–2, FLC is node 3, node 4 is empty.
- **Beam curve removed; face target +1/3 stop (Dean: "Yes").** `SetLUT(4,"")`. A window can't fix the beam curve: on
  close-ups the faces sit in the top of frame. Face plan v5 (`face_meter/face_plan_v5_target_up_third.json`): graded face
  target 0.198 → 0.218 (×2^(1/7.2)), lift only, 70 %, cap 2 st (drum 1.5): **98 cuts** (15 new, kept ones +0.23 st median);
  cut 144 excluded (noise-limited, keeps `v3/canv26_c144_lower`). LUTs `v4/facev5_cNNN.cube` (parametric, jump pairs 10
  total), applied over v3 with read-back; rollback `face_meter/facev5_rollback.json`. Verify look-off (CSTs on):
  median +0.02 st, but 17 cuts > 0.3 st off (cut 34 +1.75). **One closed-loop pass** (`face_plan_v5_cl1.json`,
  `v4/facev5_cNNN_cl1.cube`): **median −0.00 st, p90 0.22, max 0.43**, 2 cuts > 0.3. Renders
  `Renders/verify_Canvanauts_Syd26_facev5{,cl}_lookoff_v1.mp4`.
- **Before any Canvanauts delivery or RiP (Dean, 2026-10-15 night: "Remember to do it for later plus the zoom rips"):**
  1. CAM 5 group pre-clip NR node (TNR + UltraNR Luma 0.041/Chroma 0.016) un-bypassed (Open in Timeline on the multicam).
  2. RiP the zoomed cuts, including the four dynamic-zoom Dehaze cuts (170, 226, 109, 139), and check the edges after.
  3. Main bus limiter about −1 dBTP (about 11 songs peak above 0 dBTP on the clip-gain mix).
  4. Halation is on (Dean). Look state: CST pair + FLC (Exposure 0.2, Split Tone Strong 0.3/35/0.45, vignette off).
- **Black Parade 4K preview (Dean, 2026-10-15 ~23:00: "run a full render of welcome to the black parade in 4k for me to
  preview, and then you can close davinci down"; drum NR off for this pass, OK'd).**
  `Renders/preview_BlackParade_Canvanauts_Syd26_4K_v1.mp4`: 222366–230317 (song markers 222416 / END 230267, ±2 s), 3840×2160
  H.264 60 Mb/s + AAC from A4 (whole-show clip-gain mix), look on (CST pair + FLC), v3/v4 LUTs, Dehaze nodes, no RiP,
  drum NR bypassed. 513 s render. render-qc PASS (7,952 frames; video 318.08 s / audio 318.14 s; tail not silent;
  60.1 Mb/s); look on confirmed on pixels (vs look-off verify mean |d| 11.5); −16.1 LUFS, true peak −1.6 dBFS. Not
  watched by me. `render-qc.sh` is zsh (`print`): run it with `zsh`, not `bash`. Project saved, In/Out cleared, Resolve quit,
  memreg cleared.
- **Housekeeping (Dean, 2026-10-15 ~23:30: "Do the housekeeping").**
  - Deleted 56 superseded test and verify renders of mine (`video/checks/` 14–15 Oct tests; `Renders/` look-on check and
    5 older verifies): BOTTB +37 GB. Kept: `measure_*` (pipeline data), `verify_..._facev5cl_lookoff_v1.mp4`, the Black
    Parade preview, the NR result clip, 13 Oct evidence clips.
  - Moved the superseded LUT sets (`canv26`, `canv26f`, `redfix`, `gamut_test`, `look`, `stage0*`) from Resolve's LUT library
    to `/Volumes/BOTTB/Sydney - 2026/video/lut_archive_superseded_20261015/` (README there), verified file-by-file first.
    `Project.db` showed no plain-text references to them; grades may be stored compressed, so this is a move, not a delete.
    Resolve's library keeps `BOTTB_Syd26/v3` and `v4` (2.2 GB). The exFAT drive adds `._` files, so compare with `-x '._*'`.
    Claude Code refuses `rm -rf "$L/$d"`; write `"${L:?}/${d:?}"`.
  - Grading scripts saved to gigstills `scripts/sydney26_grade/` (README: which method stands) and their data to
    `runs/sydney26_canvanauts_grade/grade_data/` (150 MB, untracked).
  - Commits (not pushed): bottb `docs/sydney26-multicam` 061506b (runbook) + 7315bc2 (multicam sync, songmap scripts);
    gigstills `feat/log-source-input` 2ce27a1 (first-pass cut, 276 tests pass) and `main` b1c4bb3 (grade scripts). Left
    alone: gigstills main's older uncommitted cut-recipe/darktable edits from other sessions (8 Oct, 28 Sep).
  - Not done: Resolve's render queue still holds ~40 of my old test jobs (Resolve is closed; clear them next session).
- **Song duration markers cover the viewer (Dean, 2026-10-16: "Can I hide the note box on the color page, it's covering a
  lot of the frame").** The Green song markers span each whole song (e.g. "Thnks fr th Mmrs", 5034 frames), so their long
  note shows on every paused frame of the song, on the Color page too. Hide it in the Edit page Timeline Viewer's options menu
  (the "…" at the viewer's top right) > untick Show Marker Overlays; tick it again for marker work. Keep song-marker notes
  short, or put the detail in customData, so the overlay stays small.
- **Dark close-ups: a depth-keyed lift beats Face Refinement and whole-frame lifts (Dean, 2026-10-16: "Depth map +1
  again, this seems to be a generally better fix").** After the facev5 lift hit its caps (2 st, drum 1.5), the dark Pit/Drum
  cuts were lifted by hand: Depth Map node (Isolation on the subject, Preview off, Use OFX Alpha) → serial node fed its key
  (blue) and picture (green) → HDR Global Exposure. Dean's values: +1 on most, +3 on 02:13:33:05 (guitarist), +1 global
  then +1 keyed on 02:11:12:06. Face Refinement was offered first; Dean used it once (02:13:22:01). Dean skipped the
  washed-out cuts (raised black floor, p10 ≥ 0.05) and kept to frames with a true black floor. My "short by" stops underestimate
  a keyed lift (soft key). Pick candidates by frame darkness, not face shortfall alone, and include close-ups where YuNet found no
  face (dark faces aren't detected). Log: gigstills `face_meter/faceref_log.json`. A panned cut with a Depth Map key
  must be in the RiP set (zoom alone doesn't break the key, Dean 2026-10-16); none of these were zoomed.
  **Measured (4K ProRes look-off per-cut checks `video/checks/darkface_cNNN_lookoff_4K_v{1,2}.mov`, ~70 s per render;
  `face_meter/verify_darkface_v{1,2}.json`, script gigstills `scripts/sydney26_grade/verify_darkface.py`):** Face Refinement on
  02:13:22:01 moved the face +0.00 st; swapped to a depth key at +2 (Black Offset 0.1) → +0.31 st, still −0.62 under target.
  Depth key +3 on 02:13:33:05 → face +0.56 st (−0.34); depth key on 02:27:13:01 → +0.56 st, widening the key added nothing
  (−0.61; Dean accepted it). A soft depth key passes only a fraction of the HDR exposure to the face. Whole-frame Global Exposure
  on 02:20:56:11 → face +0.96 st, on target. **Exposure also raises a black floor that isn't zero** (v1 p10): 02:11:12:06
  0.022 → 0.066, 02:13:08:23 0.043 → 0.054, 02:26:24:02 0.032 → 0.050. Dean's v2 fixes: Lift −0.05 on the global node of
  02:11:12:06 → p10 0.010, frame mean 0.058 (below the unlifted 0.067: background darker, keyed subject lifted); Lift −0.04
  on 02:13:08:23 → p10 0.043, back to the original floor; Lift −0.04 / Blue Lift −0.07 on 02:26:24:02 → p10 0.050 → 0.049.
  **Lift in a keyed node acts only inside the key**: on 02:26:24:02 only 3 % of pixels moved by more than 0.01. To pull a
  greyed background down, use an unkeyed node.
- **A check that lied: measure levels on the same decode path as the baseline (2026-10-16).** `verify_darkface.py` first read
  the 4K ProRes as rgb48 and box-averaged to 480 wide, while the "before" numbers came from rgb24 area-scaled frames
  (`verify_face_render.py`). The rgb48 path read p10 about 0.007–0.01 high and faces about 0.05 st high (e.g. Face Refinement
  +0.08 st that was really +0.00), so a re-render seemed not to change the floor. The script now measures levels via the rgb24
  area-scale path and uses 4K only for noise. Before comparing a "before" and an "after", check per frame on one or two frames
  that both use the same decode.
- **Dean's depth-map pass (2026-10-16 morning).** Read back afterwards: Depth Map → External Key + HDR (often with Primary
  Balance) on 46 Canvanauts cuts. Apart from the 8 checked cuts, all of them run from 02:27:13 to the end of the set. All
  212 base LUTs (v3/v4/redfix) are still on their cuts; the depth cuts with no LUT never had one. 9 of them are dynamic
  zooms (starts 219576, 221093, 225026, 226358, 226498, 227639, 227812, 228879, 229423). I first said the depth key forced
  them into the RiP set; Dean corrected that the zoom doesn't affect the key (the strip finding was a Pan). They are in the
  zoom RiP set anyway; check the edges after.
- **Depth pass, earlier songs (Dean, 2026-10-16: "Okay this is all done").** Read back: 57 cuts before 02:27:13 now carry
  a Depth Map key + lift (about 95 for the set). 30 of my 60 rule candidates (`face_meter/depth_candidates_v1.json`), 27 Dean
  picked himself; he left 33 candidates alone. So the frame-darkness rule finds about half of Dean's picks: use it as a starting
  list, not as his criterion. All 212 base LUTs read back intact afterwards.
- **Full-set look-off check of the depth pass (2026-10-16).** 1080p H.264 look-off render of the whole Canvanauts set (FLC
  node 3 disabled, no audio): 2 h 33 min with about 95 Depth Map cuts while the Mac was paging (7.7 of 8 GB swap). Let the
  memreg TTL cover that: a 60 m TTL lapsed mid-render. Measured with `verify_face_render.py` against `verify_face5cl`
  (same frames, boxes and rgb24/area decode). Control: the 292 untouched cuts moved a median +0.000 st (max 0.10). The
  lifted faces gained a median +0.27 st (p10 +0.10, p90 +0.46) and 50 of 59 landed within ±0.6 st of the look-off target. The
  frame-median "changed" test missed 23 cuts whose faces gained > 0.1 st with the frame barely moving (that's what a depth
  key does), so judge a depth pass on the face, not on the frame. Flags: greyed blacks (p10 to ≥ 0.05) on 6 cuts, mostly
  lit Tracking shots that started near 0.04; faces +0.6 to +0.8 st over target on about 10. Ignore Static Desk "faces"
  (false detections).
- **What the Sydney 2026 Canvanauts look does to levels (measured 2026-10-16).** Last night's look-on 4K Black Parade preview
  against today's look-off check render, on the untouched cuts only (572 sample frames, alignment corr 0.977 at 0 vs 0.57 at
  ±5 frames): p10 0.040 → 0.013 (−1.7 st), p50 0.168 → 0.143 (−0.20 st), p90 0.431 → 0.498 (+0.18 st), faces 0.221 → 0.212
  (−0.12 st, n=208). The look is an S-curve that comes out slightly darker overall. It pulls look-off "greyed blacks" at
  p10 0.05–0.06 back down to about 0.02, so judge raised blacks with the look on.
- **`SetNodeEnabled` on a timeline node can lie in both directions (2026-10-16).** After the full-set look-off render,
  `GetNodeGraph().SetNodeEnabled(3, True)` returned True, yet Dean found the FLC still off; a second call also returned True,
  and Dean then confirmed it on. There is no `GetNodeEnabled` read-back. After any look-off render, ask Dean to confirm the
  FLC is on, or prove it with a two-frame look-on render, before anyone grades or renders.
- **Midtone lift after the look (Dean, 2026-10-16: timeline node 4 after the FLC, "02").** Four look-on 4K samples in Black
  Parade (`video/checks/midlift_[A-D]_lookon_4K_v1.mp4`, untouched cuts 277/314/329–332/339) against last night's look-on
  preview, at the same frames: midtones +0.2 to +0.25 st on pit/tracking cuts (+0.1 on a bright drum shot, +0.4 on a dark
  wide), faces +0.23 to +0.33 st, p10 up only 0.004–0.009, p90 up 0.03–0.06, pixels at 254+ 0.04 % → 0.08 % at worst (drum).
  So 0.02 more than cancels the look's −0.12 st on faces and −0.2 st on mids; about 0.01 would just restore look-off levels.
  Dean's call: **0.01** (2026-10-16, ".01 it is"). That's the timeline node 4 midtone lift for the Canvanauts look from now on.
- **Black Parade final mix v1 placed (2026-10-17, mix-assist-4a; Dean: "logic is shut so you are good to open resolve").**
  `Canvanauts_S3_Black-Parade_v1_at_02-28-08-00.wav` (Extreme SSD `02_Production/Canvanauts/bounces/`, 48 k/24-bit stereo,
  324.0 s, BWF 426624000 = Logic TC 02:28:08:00 = timeline frame 222200 exactly, since show TC = Logic TC on the edit
  timeline). mix-assist QC: −13.6 LUFS-I, −1.00 dBTP. **`align-mix --band 300 3000` against the +16 dB desk scratch
  refused** (onset match only 1.21× the runner-up, which is a crowd-in-sound bounce against an unmixed sum). Direct NCC in 300–3000 Hz,
  30 s windows at 5 points (`scratchpad/bp_sync.py`): +7.5 ms at 150/240/285 s (ncc 0.17–0.23 against runner-up ≤ 0.07),
  +6.9 ms at 5 s, +24 ms at 60 s (weak, ncc 0.15 against 0.135); wrong-region control 0.027. That is the known ~7.6 ms
  mixed-vs-unmixed offset (Beggin' pilot), so it was placed at its stamp. New track **A5 "Black Parade mix v1 (final)"**,
  222200–230300, left offset 0. The overlapping A4 whole-show pieces 221733–222366 and 222366–230318 are disabled
  (clip-level, read back). In/out fades wait on Dean's in point (stick hit 02:28:06:18 lies before the file; first piano at
  about 02:28:11) and out (about 02:33:30:13).
- **Canvanauts cards (2026-10-17; Dean said "Yes" to the adjustment-clip plan).** Resolve 21.1 has no per-clip bypass of the timeline grade (manual
  searched), so the look moves to an Adjustment Clip on V2 and the cards go on V3. Tracks added: V2 "Adjustment", V3 "Titles"
  (the timeline had only V1). `generate-song-overlays.ts --event sydney --band canvanauts --out <Sydney 02_Production>` → 6 PNGs,
  DB order = played order (matches the Green song markers). Movies in `/Volumes/BOTTB/TitleCards/Sydney2026/canvanauts_syd26_NN-<song>_card.mov`
  (ProRes 4444, 125 f, alpha fades in 12 / out 22, read back: alpha max 0/128/255/255/175/12 at f0/6/12/60/110/124; 1.27 GB
  peak each at -threads 2, run one at a time). Placed on V3 at the song-map start (`video/song_maps/songs.json`) +32: 191505, 199735, 205498, 210213,
  216549, 222448; no audio items added. Black Parade: the bounce's clear first note is 02:28:16:16 (+26 dB out of a −55 dB gap),
  = song-map start; the sound at 02:28:10–11 sits on crowd level. Smooth Criminal's map start is the grid downbeat; an instrument onset
  is 14 s earlier (5049.40 REF ≈ 216165), so check the card there.
- **Sydney 2026 look moved to the Adjustment Clip (Dean, 2026-10-17).** Dean copied the four timeline nodes one by one (CST1,
  CST2, FLC, 0.01 midtone) onto an Adjustment Clip on V2 spanning the whole timeline (79500–360347), then disabled the timeline
  nodes. Check: 2-frame 4K renders at 7 frames, X = timeline look with V2 off (confirmed to carry the 0.01 look: exactly halfway
  between the preview and the 0.02 samples), Y = adjustment clip only. **5 of 7 frames bit-identical** (this FLC has no
  per-instance grain, unlike Brisbane's); 212500 and 223820 differ slightly (mean |Δ| 1.7 and 0.9 /255, blurred 0.7 and 0.3,
  signed ≤ 0.24). Control Z = V2 off with the timeline nodes off: |Z−X| 24 /255, near the look-off render, so the look now lives
  only on the adjustment clip. Bit-identical X and Y alone cannot prove the move, because "timeline on, adjustment clip empty"
  gives the same result, so always render the V2-off control.
- **Canvanauts Sydney 2026 RiP: Dean chose "Include Color Grading Effects" ON for all 102 orange cuts (2026-10-17).** This is the first RiP
  on this RCM multicam project. 102 = every `DynamicZoomEnabled OR ZoomX ≥ 1.299` V1 cut in 191405–230729 (25 in Black Parade);
  none had Face Refinement, and no panned-only cut carried a depth key. Super Scale 2 on the 24 camera `.MP4` sources. CAM 5 NR (TNR +
  UltraNR) re-enabled by Dean in the multicam first: the drum reference frames took 7.5 s for 3 frames against 1.3 s on the wide. Pre-RiP references
  (look on, ProRes 422 HQ, 3 frames): `checks/ripcheck_drum_207230_preRiP_v1.mov` (cut 207189–207270), `ripcheck_wide_192980_preRiP_v1.mov`
  (192861–193095). Open questions the post-RiP check answers: is the clip grade cleared or applied again on top of the bake, and
  what colour space is the baked file tagged with?
- **Answer (2026-10-17, post-RiP check): with Color Grading ON under RCM, the grade bakes once but goes through the output
  transform.** All 102 became `Video` items in `/Volumes/BOTTB/Renders` (`Sydney 2026 Multicam - <angle> Render N.mov`, ProRes 422
  HQ 10-bit, 3840×2160, 30 GB total). Each has one empty node and no colour group, so there is no double grade (clip LUT, CDL and the group Pre-Clip
  are all in the file). The tag reads `Input Color Space` "Rec.709 (Scene)" plus `Input Gamma` "Gamma 2.4": in this split
  gamut/gamma RCM, "Input Color Space" is only the gamut field, so the tag matches the output space and is not the bug.
  `SetClipProperty("Input Color Space", "Rec.709 Gamma 2.4")` returns False, as do other spellings; "Rec.709" returns True and
  changes nothing. **The cost:** the bake runs DWG → Rec.709/Gamma 2.4 with the DaVinci output DRT, so highlights and saturated
  reds are tone-mapped and clipped into the file before the adjustment-clip look sees them. Measured on the post-RiP renders
  against the pre-RiP references (look on, middle frame): mean |Δ| 0.020 drum / 0.018 wide; signed R −0.029/−0.025, G −0.007/−0.011, B −0.011/−0.008;
  luma p50 0.230→0.227 / 0.056→0.061 (unchanged); **p90 0.549→0.508 / 0.652→0.588**. Side by side: slightly less pink and flatter
  highlights on the wall and screen. So the Brisbane rule stands for an RCM project: RiP with grading OFF keeps the grade live in
  timeline space. Grading ON is only safe on a non-managed (YRGB) project, or when the shift is accepted.
- **Grading OFF does not avoid it either (2026-10-17, Black Parade's 25 cuts, Dean: "decompose everything, but redo only black
  parade").** Decompose to Original (UI) brought all 102 back as multicam items with their grades (49 LUTs matched the
  record, the other 53 had none). The 25 Black Parade cuts were recoloured Yellow so that Timeline > Select Clips By Clip Color picks only
  them, then RiP'd with Video Effects ON and Color Grading OFF. The clip grades stayed live (10 LUTs) and the cuts left their groups;
  re-assigned by angle, all 25 read back. Pixels against new pre-RiP references (`checks/ripcheck_{sr15_226700,deskdz_226050}_{pre,post}RiP_v2.mov`):
  still off, **p90 0.613→0.558 and 0.799→0.698**, blue −0.026/−0.039, p50 unchanged. The RiP file itself is display-referred
  Rec.709 (10-bit Y 64…876; a C-Log3 source never reaches 64), so **under RCM, RiP always renders through the project
  output transform** (input CST → DWG → DaVinci DRT → Rec.709/Gamma 2.4), whatever the grading checkbox says. The clip
  LUTs and the look then work on tone-mapped, gamut-clipped data. The fix to try is to set the project output colour space to
  DaVinci WG/Intermediate for the RiP, so the file holds timeline-space data, then restore Rec.709/Gamma 2.4.
- **Fix confirmed: RiP with the project output set to DaVinci WG / DaVinci Intermediate (2026-10-17).** `SetSetting("colorSpaceOutput",
"DaVinci WG")` and `SetSetting("colorSpaceOutputGamma", "DaVinci Intermediate")` both work through the API and read back. Dean
  decomposed the 25 Yellow cuts and RiP'd them again (Video Effects ON, Color Grading OFF). **Resolve tagged the new files
  "DaVinci WG/Intermediate" / "DaVinci Intermediate" by itself**, so no clip-property change was needed (the API refuses most
  Input Color Space strings anyway). Then: output restored to Rec.709 / Gamma 2.4 (read back), the cuts re-assigned to their camera groups
  by angle (25/25), and Super Scale set back to 1 on the 24 sources. Pixels against the pre-RiP references (`…_postRiP_v3.mov`): mean |Δ| 0.006/0.007
  (it was 0.025/0.032 with the output transform baked), blurred 0.003/0.006, p50 unchanged, **p90 0.613→0.606, 0.799→0.787**,
  signed ≤ −0.006, noise unchanged. The residual is 10-bit 4:2:2 log storage of a resampled zoom. **RiP recipe on an RCM
  project: output → DWG/Intermediate, RiP with grading OFF, output back, re-assign groups, verify on pixels.**
- **Check renders left the timeline In/Out on the test frames (2026-10-17).** The 3-frame ripcheck jobs passed `MarkIn`/`MarkOut` to
  `SetRenderSettings` (allowed only while no Dean In/Out exists), and that wrote the timeline In/Out (read back later as 226050–226052).
  Nothing was lost, because the release In/Out was set afterwards, but **clear or restore the In/Out from the RELEASE marker after every check render**.
  The same day, a peer's "the mix on your timeline predates the vocal finalisation" turned out to be wrong: **check the file's own mtime
  and lineage before passing on a peer's claim about which mix is placed.** Also, `TitleCards/EndCard_2x.mov` is 1920×1080 (98 f, yuva444p12le,
  fades baked into RGB), so on a 4K timeline Resolve scales it up. It was not in the Sydney media pool and had to be imported.
- **Black Parade 4K v1 (2026-10-17 16:02):** `Renders/Canvanauts_BlackParade_Sydney2026_4K_v1.mp4`, 1,774,889,480 B, 7833 frames
  (222416–230248), render-qc PASS (45.0 Mb/s, audio 313.39 s vs video 313.32 s, tail fading to −40 dB), −13.5 LUFS. **True peak −0.1 dBTP
  after AAC (the bounce reads −1.0)**: the encode adds about 0.9 dB, so a −1 dBTP bounce does not leave a −1 dBTP master. The last frame is black (Y 16) and the end card
  shows at −2 s. Render time **50 min 47 s** (9.7× real time: 4K with FLC, halation, CST and 25 RiPs) on a paging machine.
- **`derive-1080-ig.sh` is only on `.worktrees/nok-delivery-notes`**, not on main or this branch. **Its fixed 8 Mb/s IG rate
  overflows the 300 MB cap on any song over ~4:50** (5:13 → ~326 MB with 320 kb/s audio). Black Parade used a scratch copy at 7 Mb/s.
  Fix the script to compute the IG rate from duration (target ≤ 290 MB) when that branch is next touched.
- **Black Parade post-delivery (2026-10-17):** 109 completed jobs cleared (gigstills' checks as well as mine; all were
  Complete). Render name reset to the timeline name. The first `SetRenderSettings({"CustomName": …})` returned
  `{"error": ""}` and the retry returned True. **Read the name back by `AddRenderJob()` and checking the job's
  `OutputFilename`** (it read `BOTTB Sydney 2026 - rough cut v3.mp4`), then delete that job: there is still no
  `GetRenderSettings`. 25 Yellow cleared, 77 Orange kept for the other Canvanauts songs. CAM 5 pre-clip node 2
  (OFX Noise Reduction) set off; node 1 (HDR) is part of the grade and stays on. No read-back exists, so Dean confirms
  it in the UI. Super Scale 1 on 24 sources, In/Out = RELEASE, saved. The mix on A5 is the delivered MIXv8 trim.
  Left for Dean: halation off.
- **CAM 5 NR off confirmed by Dean (2026-10-17).** He had to open the multicam to see it: on the main timeline only RiP'd
  items carry a colour group, and none of Black Parade's RiPs is a drum shot. To check a group pre-clip node, open the
  multicam from a cut of that angle, and close it again before any script runs.
- **Timeline renamed (2026-10-17, Dean): "BOTTB Sydney 2026 - rough cut v3" is now "BOTTB Sydney 2026 - final cut"**, the
  Sydney 2026 show's working timeline from here on. Entries above that say "rough cut v3" mean this timeline. The render
  name was reset to the new name (job read-back: `BOTTB Sydney 2026 - final cut.mp4`). The two "rough cut v3 (…)" backup
  timelines keep their names. Saved.
- **Halation off (Dean, 2026-10-17).** Post-delivery for Black Parade is complete.
- **Amakazaam "Under Pressure" final mix v1 placed (2026-10-18, handed over by mix-assist-21 "Mix under pressure"; Dean
  had asked it to hand over).** `Amakazaam_S4_Under-Pressure_v1_at_02-50-51-21.wav` (Extreme SSD `02_Production/Amakazaam/`,
  48 k/24-bit stereo, 233.375 s, BWF 492090000 = 02:50:51 + 21.875 frames; −13.5 LUFS-I, −1.0 dBTP measured here). **The stamp
  is not on a frame:** the filename rounds down to :21 (35 ms early). Placed at the nearest frame, **256297 = 02:50:51:22**
  (5 ms late), startFrame 0, endFrame 5834, on new track **A6 "Under Pressure mix v1 (final)"** (256297–262131, left
  offset 0). Sync against the desk scratch (`scratchpad/up_sync.py`, the bp_sync recipe): +7.0 ms at all five points
  (t = 20/60/120/170/200 s, NCC 0.19–0.32 against a runner-up ≤ 0.13), wrong-region control 0.018. That is the known mixed-vs-unmixed
  offset, so the stamp holds (0.34 GB, 2 min). A4 pieces wholly inside the song (256652–261919, 261919–262106) are
  disabled. **The two partial pieces are still on:** 250158–256652 doubles the first 14 s of the mix and 262106–267606 its
  last frame. Blade A4 at 02:50:51:22 and 02:54:45:06 before a render (the API cannot blade). `AddTrack` returned
  `{"error": ""}` and had worked: list the tracks before retrying.
- **Under Pressure 4K check render (2026-10-18; Dean: "Halation is on paging for 38 minutes is fine").** Dean's range is the
  audio In/Out from his Logic cycle (02:50:51:21–02:54:45:06 = 256296–262131), **not the green song marker** (02:51:08:02–
  02:54:34:18). The timeline In/Out read empty when he asked, so it was set from that range and a Cyan `RELEASE: Under Pressure`
  marker was added at relative 176796, duration 5836. His A4 blades did not show through the API: A4 had no edit at :22 or :06.
  So for the render the two partial A4 pieces (250158–256652, 262106–267606) are **temporarily disabled; re-enable them after**.
  Job 622cbd5a, `Renders/preview_UnderPressure_Amakazaam_Syd26_4K_v1.mp4`, H.264 45 Mb/s, single pass. CAM 5 NR off, look on
  (V2). memcheck at 6 GB: COMFORT ask, Dean OK'd it. Peers holding.
- **Black Parade published 17 Oct (bottb-17, from its relay):** YouTube https://youtu.be/AT4kyKuBRlQ, FB reel 1084809634321382,
  IG reel DelnQL4CaWJ, LinkedIn activity 7517132058419175424, TikTok 7697543006886333748; ledger group
  `sydney-2026-canvanauts-blackparade`. **Live thumbnail checked here (2026-10-18)** from the plain `maxresdefault.jpg`
  (1280×720): Canva logo, "My Chemical Romance / Welcome to the Black Parade", BotTB logo, no year on it.
  **Result:** Complete in **6 min 48 s** (Black Parade's graded 4K took 50 min; the Amakazaam set is ungraded and CAM 5 NR is off),
  1,324,172,826 B, render-qc PASS (5836 frames, video 233.44 s / audio 233.51 s, 45.1 Mb/s, tail fading to −37.5 dB),
  −13.6 LUFS, true peak −0.6 dBFS after AAC (the bounce reads −1.0). The A4 partial pieces were re-enabled after the render;
  In/Out survived it this time. Saved.
- **The 77 Canvanauts RiPs went before the setup (2026-10-18).** Dean read "77 RiP clips, when they are done tidy up" as RiP now,
  and I read it as RiP after I had prepared. While the RiP dialog was open the API misbehaved: `GetCurrentPage()` None,
  `GetToolsInNode` None, and Super Scale read-back failing on all 24 sources (nothing changed). That is the sign the dialog is
  open, so stop calling. Result: 77 files in 4 min (18:56–19:00), 25 GB, **ProRes 422 Standard, Rec.709 tagged, written to the
  Resolve project's default `Extreme SSD/…/2026/Brisbane/02_Production/BOTTB Sydney 2026 Full Show/Renders/`** (not BOTTB),
  output still Rec.709, Super Scale 1 and CAM 5 NR off. Grading was OFF (clip LUTs still live, no groups). So these carry the
  output-transform shift and need Decompose to Original plus a redo with the recipe. **Before any RiP request, give Dean the
  setup first and say "wait for my go" in the same message.**
- **The 77 Canvanauts cuts RiP'd with the recipe (2026-10-18, Dean away: "tidy up and do any checks, then move on to grading").**
  Dean decomposed the first (early) RiP, then 39 LUTs were back on 77 multicam items. CAM 5 NR on (proved by render time:
  drum 3 frames 7.2 s against wide 1.3 s), Super Scale 2, pre-RiP references `checks/ripcheck_{drum_207230,wide_192980}_preRiP_v4.mov`,
  output DWG/Intermediate. Dean RiP'd to `/Volumes/BOTTB/Renders`, ProRes 422 HQ, Video Effects ON, Grading OFF: 77 files, 19:07–19:23
  (15 min, **slower than the Extreme SSD run's 4 min**, which was 422 Standard at Super Scale 1), 37 GB. Waited without API calls
  (`scratchpad/wait_rip.sh`: 77 new files, none modified for 90 s, then `GetCurrentPage()` not None). All 77 read back
  as Video items tagged DaVinci WG/Intermediate, 39 LUTs live. Then output Rec.709/Gamma 2.4, 77 re-assigned by angle
  (29 CAM 1, 21 CAM 2, 17 CAM 3, 7 CAM 4, 3 CAM 5; 0 mismatches), Super Scale 1 (24). **Pixels, post vs pre (middle frame,
  look on): drum mean |Δ| 0.0056, p90 0.504→0.505, noise σ equal; wide 0.0037, p90 0.666→0.658.** Orange cleared (0 left),
  5 jobs cleared, render name reset, saved. **Trap, twice now: the first `SetMarkInOut` after a render returns `{"error": ""}`
  and sets only the In (out = in); the second call sets both.** Always read it back. Canvanauts now has every zoomed
  cut RiP'd. The first-attempt RiPs on the Extreme SSD (25 GB, `…/2026/Brisbane/02_Production/BOTTB Sydney 2026 Full Show/Renders/`)
  and the older ones on BOTTB are unused. Deleting them is Dean's call.
- **Under Pressure measurement (2026-10-18, Dean away; comfort: idle-ok, idle 18 min).** Cut list: 56 V1 multicam items, all five
  angles, 21 zoomed, no grades (`gigstills/runs/sydney26_amakazaam_underpressure/cut_list.json`, written with the outside-MCP
  fusionscript connection, as `wait_render.py` does). Look-on control `checks/up_lookon_F259100_v1.mp4`. V2 (look) and V3 (titles) off:
  **the render had left Resolve on the Deliver page, where `SetTrackEnable` returned True and read back True (still on).**
  `OpenPage("edit")` first, then it worked. Renders `Renders/measure_UnderPressure_Amakazaam_Syd26_lookoff_v1.mp4` (1080p H.264,
  Rec.709, 5836 frames, 4 min 34 s) and `…_lookoff_DWGDI_v1.mov` (ProRes LT, output DWG/DI for the render only, 4 min 11 s).
  Output restored; V2/V3 on; the restored look-on control is framemd5-identical to the first one, and the look-off frame differs.
  In/Out restored (the renders moved it to 179600–179601), saved. Grade agent (Opus) briefed via `BRIEF.md` in that run dir.
- **Under Pressure grade applied (2026-10-18, Dean away).** Grade agent (`gigstills/runs/sydney26_amakazaam_underpressure/`,
  REPORT.md): 27 apply (26 base Dean option + 1 face lift, cut 53), 16 held for Dean (big blue lifts on drums/Pit: wash or
  lighting is his call), 13 identity. **The Canvanauts forward model T2 failed here** (median 0.056 vs 0.020) on out-of-Rec.709
  blue/cyan, so it was refit with both sets (T2b; Amakazaam held-out 0.043 → 0.027). `RefreshLUTList()`, then
  `GetNodeGraph().SetLUT(1, "BOTTB_Syd26/amkup/amkup_cNNN.cube")` on 27 V1 items (two calls of 14/13), and all 27 read
  back by name. Verify render `Renders/verify_UnderPressure_Amakazaam_Syd26_lut_lookoff_v1.mp4` (look off, 5836 frames, 4 min 11 s).
  Look back on, and the look-on control is framemd5-identical again. In/Out restored, saved. The subagent was blocked from writing
  .md files; the editor saved its REPORT.md. The agent's 2.76 GB refit ran unregistered: say "register before running" in
  grade briefs.
  **Verify (grade agent, on the real render):** the 27 applied cuts land on prediction (rendered − predicted median ≤ 0.0017 at
  every percentile, worst 0.0075). Model-free error against the approved display grade median 0.0086, p90 0.0150, worst 0.0175
  (Canvanauts v3: 0.0097/0.013/0.042). The 29 cuts without a LUT are unchanged: 17 byte-identical, 12 within H.264 noise
  (median ≤ 2/255). Stray pixels 0.0019 % → 0.0022 % (intended 0.0028 %). Pair jumps above the control on 6 cuts are
  codec splits at the threshold: the same pairs through the LUT files differ by ≤ 0.016. Cut 53 face 0.135 → 0.186 against
  0.189 (−0.05 st), so no closed-loop pass is needed. Files: `REPORT_verify.json`, `verify_render.json`, `verify_pairs.json`.
- **Under Pressure held cuts approved (2026-10-18).** Review page instead of a contact sheet: one card per held cut with
  1080p look-on frames rendered from Resolve (before, then with the held LUT applied for the render and removed again), a wipe
  slider, and Approve/Reject buttons writing to the page's db (`decisions/c###`), read back with ArtifactData `list`. Dean asked
  for this over the JPG sheet ("add buttons so I can approve or reject … use higher res shots"). Dean approved all 16 (note on
  cut 25: "Very little difference"). Applied with `SetLUT(1, …)`, guarded by timeline name and `IsRenderingInProgress()`:
  16/16 read back by name; the song now has 43 LUT cuts of 56 V1 cuts (13 identity). Saved. The pixels Dean approved are the
  render of these exact LUTs, so no second verify render.
- **Unused RiPs deleted, CAM 5 NR off, Resolve closed (2026-10-18 night, Dean: "Remove the unused rip files … Disable nr
  for me and then shutdown davinci").** Before deleting, re-ran the usage check on all 7 timelines and every video track
  (media pool item `File Path`): none of the 204 listed files was used, and no other unused RiP was missing from the list.
  `rm` of the 204 (64 GB: BOTTB 462 → 497 GB free, Extreme SSD 170 → 194 GB); then the 204 offline media-pool items removed
  with `MediaPool.DeleteClips` (0 left), saved. **CAM 5 NR can be set from the API, without opening the multicam:**
  `GetColorGroupsList()` → "CAM 5 Drum (S-Log3 8-bit)" → `GetPreClipNodeGraph()`: node 1 `HDR`, node 2
  `OFX: Noise Reduction` → `SetNodeEnabled(2, False)`. Proved by render time, since there is no read-back: 3 frames of drum cut
  257947 (4K ProRes HQ, `checks/nrcheck_drum_257977_off_v1.mov`) took 0.8 s, against 7.2 s with NR on. Job deleted, In/Out
  restored to 176796–182631, render name reset, saved, then `resolve.Quit()`. Under Pressure's A4 cuts aren't done yet (Dean).
- **Extending the Resolve MCP: static study (2026-10-18 night, subagent, Resolve closed).** Full report:
  the private repo `~/src/personal/resolve-lab` (`docs/feasibility-2026-10-18.md`, decoders in `scripts/`;
  GitHub `dpovey/resolve-lab`). The editor's grading scratch is in gigstills `scripts/sydney26_grade/editor_scratch/`. **ResolveMCP is a signed launcher around readable Python** (an embedded `.pyz` run by `ResolvePython`; the
  `pylauncher` processes are live sessions' MCP servers). It has no plugin mechanism, so extending means our own MCP
  server next to it. **The real gain is reading state back from `Project.db`:** grades are stored as 0x81 + zstd + protobuf, and
  the `.proto` schemas ship inside the Resolve binary. From a read-only copy it already reads each node's enabled flag
  (param `0xC0000001`, field 2: 2 = on, 0 = off; the meaning is inferred from data), every FLC parameter by name including
  `halationIsEnable`, keyframes, Input Sizing and Dynamic Zoom rectangles. Spot-checked by the editor: CAM 5 pre-clip node 2
  NR = OFF (matches tonight's render-time proof), final-cut timeline CST1/CST2/FLC/node 4 = OFF. It reads the state at the
  last save, so the order is: save, copy with `sqlite3 -readonly`, decode. **Never write to Project.db.** Not yet tested
  live: a toggle, save, read-back loop (E1); a halation on/off DRX swap with `ApplyGradeFromDRX` on a scratch copy (E2); the
  undocumented methods `Graph.SetNodeActive/SetNodeLocked/ResetNode`. **Never call `DeactivateLicense`** (it deactivates
  the licence and force-quits) or `TriggerCtrKTest`, both found in the binary's docstrings. RiP and Decompose have no API path
  (context menu only), so they need UI automation or a render-and-overlay stand-in. A Ghidra pass over the 511 MB arm64 slice
  would probably exceed 6 GB and take hours; it queues behind the mix session's REA/Ghidra work and needs Dean's OK.
- **Installing REA is blocked for agents even with Dean's OK in the chat (2026-10-18).** The auto-mode classifier refused
  `npm install --prefix /Volumes/Supp1Tb/ai-models/rea --ignore-scripts rea-agents@6.7.0` (and the mix session's earlier
  attempt, as "external code"), and also refused a peer message announcing the install. Dean runs it himself or adds a Bash
  permission rule; agents don't retry it another way.
- **REA toolchain installed by Dean (2026-10-18), all on Supp1Tb:** REA 6.7.0 at
  `/Volumes/Supp1Tb/ai-models/rea/node_modules/.bin/rea` (no `rea setup`, no agent config changed), Ghidra 12.1.4 at
  `/Volumes/Supp1Tb/ai-models/ghidra_12.1.4_PUBLIC` and Temurin JDK 21.0.12.1 at `…/jdk-21.0.12.1+1/Contents/Home`, both
  checksums OK. Set per command: `JAVA_HOME=… GHIDRA_INSTALL_DIR=…` (not in the shell profile). `rea doctor` passes Ghidra,
  its headless mode and the JDK. **Trap: the Ghidra release has no macOS natives** (only Linux and Windows x86_64), so the
  decompiler is missing until `support/gradle/./gradlew buildNatives` runs. That command downloads Gradle 9.7.1; put
  `GRADLE_USER_HOME` on Supp1Tb and treat the build as a heavy job.
  **Natives built (Dean, 2026-10-18):** `buildNatives` took 1 min 34 s. The decompiler, sleigh, demanglers and lzfse land in
  each module's `build/os/mac_arm_64/`, not `os/`, and `rea doctor` now passes `ghidra-native_decompiler`.
- **Resolve read-back and UI-automation checks (2026-10-19 ~00:25, Dean: "start resolve to do this when nothing heavy is
  left").** Comfort gate "ask" (8 GB against 7.3), passed by the idle exception (idle 31 min, memreg empty, heavy.lock not
  held). Resolve was registered critical while open and removed after.
  - **`launch_resolve` can lie after a quit.** After `resolve.Quit()` it answered "DaVinci Resolve is running" without
    launching, because the MCP keeps the stale connection (`_handle_launch_resolve`: `self._resolve is not None`). The next
    `run_script` failed and cleared it, then a second `launch_resolve` started Resolve (10 s). Check `pgrep -x Resolve` after
    launching. Resolve opened on "Untitled Project": `LoadProject("BOTTB Sydney 2026 Full Show")`.
  - **E1 passed: Project.db is a working read-back for node enable.** Steps: CAM 5 group pre-clip node 2 (NR)
    `SetNodeEnabled(2, True)`, then `SaveProject()`, `sqlite3 -readonly .backup` and `resolve-lab/scripts/nodestate.py`: ON.
    Then `False`, save, read: OFF (left as found). Field `0xC0000001` = node enabled is now confirmed both ways. This proves
    the API call reached the saved project; the render-time check proves the render.
  - **UI automation can reach the menus only.** REA's `observe-native-ui` refuses Resolve ("target-limit: running
    executable exceeds the 256 MiB identity-check budget"). Read directly (`resolve-lab/tools/axdump`, `axhit`):
    - Resolve's Qt UI exposes **only the menu bar** (about 1,450 items, each pressable).
    - `AXWindows`, `AXFocusedWindow` and hit-tests inside the window all return the application element, so the timeline,
      panels, right-click menus and the FLC "Enable Halation" checkbox are invisible to accessibility.
    - **Render in Place is in no main menu.**
    - The main menus do have **Clip › Decompose in Place** (it may be the compound-clip one, not RiP's "Decompose to
      Original": check with Dean), "Select All Clips Under Playhead", "Select Clips", "Bypass All Grades",
      "Enable/Disable All Nodes" and "Keyboard Customization…".
    - **Possible RiP path, untested:** Dean assigns a keyboard shortcut to Render in Place, if Keyboard Customization lists
      it. Then: set the playhead by API, press "Select All Clips Under Playhead" by AX, send the shortcut, and press Return
      in the dialog (which keeps its last settings). Verify by API afterwards: the item has become a `.mov` Video item.
- **Amakazaam cards (2026-10-19, Dean: "the set needs song cards, the song needs an end card").** `generate-song-overlays.ts
  --event sydney --band amakazaam` wrote to **`02_Production/Amakazaam!/Overlays/`**: the folder takes the band's DB name, `!`
  included, so it was moved to `Amakazaam/Overlays/`. 6 PNGs in played order (Valerie, Superstition, Under Pressure, Are You Gonna Go
  My Way, You Oughta Know, Killing in the Name), matching `/Volumes/BOTTB/Sydney - 2026/video/song_maps/songs.json` (the song map
  lives on BOTTB, not in a repo). Movies `TitleCards/Sydney2026/amakazaam_syd26_NN-<song>_card.mov` with the Canvanauts ffmpeg recipe:
  125 f, alpha 0/128/255/255/175/12 read back, 1.27 GB peak each. V3 placement = song-map `start_frame` + 32: 244444, 250240,
  256734, 262189, 267746, 275765.
- **Scripting refused because a print service held Resolve's port (2026-10-19).** After launch, `launch_resolve` timed out and
  `dvr.scriptapp("Resolve")` returned None in 0.07 s, with a project open, no dialog, and External scripting = Local. `lsof`
  showed Resolve/`fuscript` listening on `*:49153`, while **LRS Personal Print Manager** (`LRS.PersonalPrint.Service user service`)
  held **`127.0.0.1:49153`** and `[::1]:49153`. The more specific bind wins, so local script connections reached the print service.
  Resolve picks this port at launch, so the clash is intermittent. Fix (Dean: "kill it"): `kill` the user-service pid. launchd
  restarted it on another port, and scripting connected at once, with no Resolve restart. **Check:** `lsof -nP -iTCP:<port> -sTCP:LISTEN`
  on Resolve's listening port whenever the connection fails instantly. Also seen: after a quit, Resolve can reopen on the Project
  Manager (scripting is unavailable until a project is open), so Dean double-clicks the project.
- **Black Parade's clip fades now read 0 (2026-10-19).** On 2026-10-17 `SetFades({"FadeOut": 98})` on the last V1 cut (230143–230249) and on
  the A5 mix read back `FadeOut 98.0`, and the 4K render's last frame was black. After a quit and reopen, `GetFades()` on both
  reads `{'FadeIn': 0.0, 'FadeOut': 0.0}`. Not yet known: whether the fades were really lost (on save, on reopen, or by a later edit) or
  `GetFades` reads wrong after a reload. Until that's settled, set the fades in the same session as the render, read them back right
  before `StartRendering`, and check the last frame is black on the render itself.
- **There is no trim or blade in the 21.1.1 API** (the stub has no SetStart/SetEnd/SetDuration/trim on TimelineItem; only
  `GetLeftOffset`/`GetRightOffset`). Shortening a cut means either Dean in the UI, or `DeleteClips` (no ripple, leaves a gap) plus a
  re-append of the pool item with new source in/out, which for a multicam item also means choosing the angle.
- **Under Pressure RiP (2026-10-19), the recipe run end to end.** CAM 5 NR on (Project.db read-back: ON), 21 cuts Orange (14 Static Desk,
  5 Stage Right, 2 Desk Tracking; no drum, no Face Refinement), Super Scale 2 on 24 sources, output DWG/Intermediate, pre-RiP refs
  `checks/ripcheck_up_{sr15_257363,deskdz_260141}_preRiP_v1.mov`. **Dean RiP'd to the Extreme SSD** (`…/2026/Brisbane/02_Production/BOTTB
  Sydney 2026 Full Show/Renders/`, "much faster"): 21 ProRes 422 HQ files, 7.9 GB, the first file landing at 12:37:36 and the last at 12:41:12. A
  waiter watching `/Volumes/BOTTB/Renders` would have missed them, so ask where the RiP is going. Read back: 21 Video items tagged DaVinci
  WG/Intermediate, 43 LUT cuts still live; output back to Rec.709/Gamma 2.4; 21/21 re-assigned by angle; Super Scale 1 (24). Pixels
  post vs pre (look on, middle frame): desk DZ mean |Δ| 0.0059, p90 0.831→0.820; Stage Right 1.5× mean |Δ| 0.0133, uniformly darker
  (signed RGB −0.012/−0.011/−0.015, p50 0.625→0.613). Dean may move the RiPs to BOTTB for archive: relink after the move.
- **A roll edit from a script works through the menu bar (2026-10-19, Dean: "can you just roll the edit out").** The API can't trim, but
  `resolve-lab/tools/axpress <pid> "Trim" "Select Nearest Edit To" "Roll"` and `axpress … "Trim" "Extend Edit"` can. Steps:
  the Edit page (on Color, Select Nearest Edit To is disabled); `SetCurrentTimecode` on the edit (02:54:45:00); `Edit › Deselect All`;
  `Trim › Select Nearest Edit To › Roll`; `SetCurrentTimecode` one frame past the Out (02:54:45:07); `Trim › Extend Edit`. Read back:
  Photo Pit 261989–262125 → 261989–262132, drum 262125 → 262132, every other track unchanged, In/Out intact. **This is the first
  timeline edit made by UI automation.** The same pattern should give a blade (`Timeline › Razor` at the playhead) and Fade Out to
  Playhead. Then the Photo Pit took FadeOut 98 and the A6 mix FadeOut 98 (both read back), with the end card at 262034–262131 Add.
- **Halation can be read, not asked (2026-10-19, Dean: "Shouldn't you have been able to read the halation with your new tools?").**
  I asked Dean to confirm Enable Halation before the Under Pressure render, when the Project.db decoder could already read it.
  `resolve-lab/scripts/flcstate.py <copy.db>` after `SaveProject()` and `sqlite3 -readonly .backup`: **Adjustment Clip@79500 FLC node ON,
  `halationIsEnable` = 1, `bloomIsEnable` = 1** (13:00 save, minutes before the render). Control: a backup timeline's FLC reads
  `halationIsEnable` = 0, so the decoder tells the two apart. The final cut's own timeline FLC node is OFF, which is right: the look is on the
  Adjustment Clip. **New rule: before any delivery render, save, copy and run `flcstate.py`; report halation from it. Ask Dean
  only when the decode can't find the node.** This replaces "ask Dean to confirm Enable Halation" from NOK 2026-10-06.
- **Under Pressure delivered (2026-10-19).** Job 9a2051e4 → `Renders/Amakazaam_UnderPressure_Sydney2026_4K_v1.mp4`, 1,320,524,166 B, **10 min 28 s**
  (NR on, 43 LUTs, 21 RiPs, halation; machine paging with swap at 10 GB, Dean: "Go, paging is fine"). render-qc PASS (5836 frames, 44.9 Mb/s,
  audio 233.51 s vs video 233.44 s), −13.5 LUFS, TP −0.6 dBFS, last frame Y 16, the end card visible over the fade, the song card at
  +18 s. 1080p 351,586,441 B (11.7 Mb/s) and IG 237,256,281 B (7.8 Mb/s, 226.3 MiB) by `derive-1080-ig.sh`, both PASS, 1.01 GB peak,
  6 and 5 min. **`render-qc.sh` is zsh: `bash render-qc.sh` fails with "print: command not found"**, so run it with `zsh`.
  Post-delivery: A4 pieces back on, CAM 5 NR off (Project.db: OFF), the job cleared, the render name reset (job read-back
  `BOTTB Sydney 2026 - final cut.mp4`), 21 Orange cleared, In/Out = RELEASE, saved; halation still on (Project.db). Dean "yes" (13:27)
  to "good to go out" and to `_superseded`: preview/measure/verify renders moved to `Renders/_superseded/` (the gigstills run dir still
  names their old paths). Handed to bottb-17 with the thumbnail not yet made.
- **ShipReX "Mustang Sally" rough mix MIXv1 (2026-10-22, from "Mix under pressure" on Dean's request; for picture, not the master).**
  `02_Production/ShipReX/MIXv1_bwf.wav` (48 k/24-bit stereo, 326.0 s, BWF 233385477 stamped by mix-assist; `MIXv1.wav` has no bext).
  Sync against the desk scratch (`ms_sync.py`, the up_sync recipe): **+7.0 ms at all five points** (t = 20/80/150/220/280 s, NCC
  0.53–0.65 against a runner-up ≤ 0.18), wrong-region control 0.029, 0.32 GB, 2 min. The stamp holds. **My slip: I worked out
  stamp ÷ 1920 by hand as 121555.98 and placed it at 121556; it is 121554.94, so the right frame is 121555 = 01:21:02:05 (stamp 2.6 ms
  before the frame).** The import's `Start TC` read 01:21:02:04 (Resolve floors the stamp to a frame), which gave it away. **Rule:
  compute the frame in code (`round(stamp/1920)`) and check it against the imported clip's `Start TC` (floor) before appending.**
  The `davinci-resolve` MCP failed to connect at session start, and the direct `DaVinciResolveScript` route (as in `wait_render.py`)
  worked for reads, `AddTrack`, `ImportMedia`, `AppendToTimeline` and `DeleteClips`. After that, the auto-mode classifier blocked the
  re-append; Dean: "You need to place it." Placed on A7 "Mustang Sally MIXv1 (rough)" at 121555–129705 (startFrame 0, endFrame 8150, left offset 0, read back), saved. A4 pieces overlapping 121555–129705:
  117270–121615 (starts long before the mix, overlaps its first 60 frames), 121615–122268 (inside), 122268–129868 (runs 163 frames past the end).
- **Direct `DaVinciResolveScript` from `/usr/bin/python3` segfaults on exit (2026-10-22): Dean got "Python quit unexpectedly".**
  Two of my runs left `Python-2026-10-22-2309*.ips` / `-2315*.ips`: SIGSEGV in `fusionscript.so`
  `Fusion::RemoteApp::FindLocalObject` on its own thread during interpreter teardown, after the script had done its work and
  printed. Resolve and the MCP's `ResolvePython` helpers were unaffected. **Fix: first line of any direct script,
  `atexit.register(lambda: (sys.stdout.flush(), os._exit(0)))`**, so teardown never runs. `wait_render.py` has the same exposure.
- **Mustang Sally 4K preview with MIXv1 (2026-10-22; Dean: "bounce a 4k copy of mustang sally and upload to youtube with this audio";
  he muted A4 himself; picked mix-extent range, as-is preview, "Go, paging is fine").** In/Out 121555–129704 (01:21:02:05–01:26:28:04, the
  bounce's extent; the green marker is 01:21:32:18–01:26:36:18), Cyan `RELEASE: Mustang Sally` at relative 42055, dur 8150. **The first job
  read MarkIn 201055: I passed absolute frames to `SetMarkInOut` (the 2026-10-14 trap above).** Deleted unstarted, re-marked 42055–50204,
  re-queued, read back 121555–129704. Job c1d8ab8a → `Renders/preview_MustangSally_ShipReX_Syd26_4K_v1.mp4`, H.264 45 Mb/s single pass,
  set ungraded (V2 look only), 1 dynamic-zoom cut rendered live, no cards. **8 min 51 s**, 1,848,743,770 B, render-qc PASS (8150 frames,
  video 326.00 / audio 326.08 s, 45.0 Mb/s), −13.8 LUFS-I, −0.7 dBTP after AAC (bounce −1.0). In/Out survived the render. Job cleared,
  render name reset to the timeline name (no read-back exists), saved. **The project library is now Blackmagic Cloud (PostgreSQL,
  ap-southeast-2) since 22:13 (deapovey-57); `GetCurrentDatabase()` reads it.** `state.py` fixed to add `GetStartFrame()` to the In/Out.
- **New tool `scripts/bwf-sync-check.py` (2026-10-22), replacing the scratchpad bp_sync/up_sync/ms_sync copies.** `venv/bin/python -I
  bwf-sync-check.py <bounce.wav>` reads the BWF stamp with ffprobe, prints the frame to place at (`round(stamp/1920)`) and its TC, then
  the five-point NCC vs the desk scratch and a wrong-region control. Proven on MIXv1_bwf.wav (+7.0 ms ×5, control 0.032, same as
  ms_sync) and on a stamp-less copy (refused, exit 1).
- **~~Logic bounces carry no bext~~ CORRECTED 2026-10-22: Dean's Logic 12.2 bounce `ShipReX/MIXv1.wav` carries one.** ffprobe:
  `encoded_by=Logic Pro`, `time_reference=233385475`, a umid. mix-assist's restamped `MIXv1_bwf.wav` says 233385477, 2 samples
  later. Both land on frame 121555. The mix session believed the bounce had no bext. Read the stamp with ffprobe before restamping,
  and still check it with `bwf-sync-check.py`.
- **Direct scripting when the MCP is down (2026-10-22).** `davinci-resolve` MCP timed out at start-up. `DaVinciResolveScript` from
  `/usr/bin/python3` (the `wait_render.py` header) did reads, AddTrack, ImportMedia, AppendToTimeline, DeleteClips, SetMarkInOut,
  AddMarker, render setup/start and SaveProject. Add the `atexit … os._exit(0)` line (entry above) or Dean gets a crash dialog per run.
  Unlisted YouTube upload of the preview: https://youtu.be/hjiTbqrFazc (social session, Dean drag + Studio).
- **V2 Voyagers "Starships / UFO" (S5) master v1 placed (2026-10-28, bottb-8f; from mix-assist-d5).** `Extreme SSD/…/02_Production/V2Voyagers/
  V2Voyagers_S5_Starships-UFO_v1_at_03-34-22-05.wav` (Dean's Logic bounce `V2Medley_logic_r16_master.wav` byte for byte, sha256 5b921d12…;
  339.000 s, 24-bit/48 k; BWF 617385475; mix-assist QC −14.57 LUFS-I, −1.00 dBTP). `bwf-sync-check.py` (run from the branch with
  mix-assist's `uv run python`, because main has no scripts venv): +7.0 ms at all 5 points, ncc 0.55–0.67, control 0.015, so the stamp holds.
  mix-assist's align-mix against SYDNEY26_full.wav refused twice (1.06×/1.04×). **Placed on new A8 "V2 Medley S5 master v1" at 321555–330030
  (03:34:22:05–03:40:01:05)**, left offset 0, read back, saved. The import's Start TC read 03:34:22:04 (floor), as the 2026-10-22 rule predicts.
  The A4 pieces 321538–321766, 321766–329886 and 329886–330230 are clip-disabled; the A4 track was already off. **vs r14** (`align-mix
  --bounce v1 --ref r14 --ref-bext`): v1 starts **150 frames (6.000 s) earlier**, 5/5 windows, measured − bext 0.0 frames, residual −7.75 dB
  (different version). `AppendToTimeline` left the playhead at the item's end (03:40:01:05).
  The bounce starts in crowd noise (Logic's full cycle), so it needs crossfades into the show audio at both ends; those wait on Dean's In/Out.
- **A brief's "current mix on the timeline" was wrong (2026-10-28).** The job said r14 (`V2Medley_fullmix_r14_master_ceiling-3.0_24bit_20261022.wav`)
  was the medley audio on the full-show timeline. It was on none of the 7 timelines and not in the media pool. mix-assist had read its own
  "r14 shipped" as "placed", although its board still had "Davinci handoff" OPEN. Rule (skill, step 2): find the "current" file by path
  on the timeline before planning a replacement around it.
- **Medley In/Out and fades (2026-10-28; Dean via mix-assist-d5: "Start with the in out set to the audio"; Dean here: "Fades on the clip").**
  In/Out 321555–330029 (relative 242055–250529, read back); Cyan `RELEASE: Starships / UFO 03:34:22:05-03:40:01:04` at relative 242055,
  dur 8475; A8 `SetFades` FadeIn 25 / FadeOut 98 (read back); saved. The A4 track is off, so these are fades from and to silence, not a
  crossfade. Dean plans to recut the medley's picture; the audio placement doesn't depend on the cut. Check `GetFades()` again before any render:
  Black Parade's fades read 0 after a reopen (2026-10-19 entry above). A read-only script hung with no output while Dean was playing
  and finished by itself once playback stopped: wait for it, don't kill it.
- **V2 Voyagers song markers and cards (2026-10-29, bottb-8a; Dean: "adjust the song markers and add the titles (you can do it
  for the whole v2 voyagers set)").** Dean's medley In/Out now **321816–330030** (03:34:32:16–03:40:01:05, 8215 f). Cyan RELEASE moved
  there. Green song starts moved to 5 f before the first note, ends kept: Venus 297464, Cosmic Girl 301585, Drops of Jupiter 307851,
  All Star 315739, Starships / UFO 321836; Red `END: Venus` 301584 (segue). Old markers backed up to the session scratchpad first,
  all read back, saved. Cards (`generate-song-overlays.ts --event sydney --band "v2 voyagers"` → `02_Production/V2Voyagers/Overlays/`,
  movies `TitleCards/Sydney2026/v2voyagers_syd26_NN-<song>_card.mov`) on V3 at first note +32: 297501, 301622, 307888, 315776,
  321873. In/Out and playhead saved before ImportMedia/AppendToTimeline and restored (read back). The DB medley card reads
  "Nicki Minaj / with UFO (Sneaky Sound System) / Starships". UFO enters at the song map's "bridge" section, REF 9362.26 ≈ 323986
  (03:35:59:11): no marker or card there yet.
  - **The first-note detector fires on the wrong thing in a live set; read the 100 ms trace before using it.** New
    `scripts/transient_marker.py` (the Canvanauts-2025 rule as a tool; proven on a synthetic decaying hit + sustained entry, and a
    flat control). On `SYDNEY26_full.wav` it caught **All Star's four stick clicks** (315690, 0.54 s apart; band at 315744) and
    **Venus's walk-on backing track** (297420; band at 297469). It agreed within a frame with the song map on Drops of Jupiter and on
    Starships (321841 on both the master v1 and the full mix). Cosmic Girl is a segue: the intro rises at 301590, 2.4 s before the grid's
    first downbeat, after ~2 s at −37 dB. The 2025 Canvanauts master could not serve as ground truth: its place on that timeline
    matched neither runbook start, so prove against a synthetic case instead.
  - **Card alpha read-back: never downscale before taking the max.** New `scripts/song-card-movs.sh` (PNG dir → 125-frame
    ProRes 4444, alpha fades in 12 / out 22, read back at f0/6/12/60/110/124, never overwrites). With `scale=64` in the check, the
    known-good Amakazaam card read 136/187 and the new ones 143/196 (scaler overshoot depends on the artwork); at full resolution
    both read 0/128/255/255/175/12, the runbook values. Frame-based (`s/n`) and time-based (`st/d`) fades gave identical files.
  - **A8's fades read 0 again** (`GetFades()` {0, 0} on the medley master, set to 25/98 and read back 2026-10-28): the Black Parade
    trap a second time, after Dean's session. Re-set the Out fade once the Out is final, read back right before the render.
  - `AppendToTimeline` with `endFrame` 124 gave 124-frame card items (297501–297625), where the Canvanauts/Amakazaam cards are 125.
    The dropped frame has alpha 12/255 here; pass `endFrame` 125 next time if the item must be 125.
  - **Medley card and Out, same day (Dean: "Maybe medley should be Nicki Minaj / Sneaky Sound System with song Starships / UFO on
    the bottom line? Make my out where the frame audio ends, the medley audio does fade out … maybe not to zero though").**
    Card re-rendered with artist "Nicki Minaj / Sneaky Sound System", title "Starships / UFO", no qualifier line (a scratchpad copy
    of the generator with a one-song override; run from the repo root with `NODE_PATH=<repo>/node_modules`, because packages
    resolve from the script's own folder). The shared `songCredit()` medley rule ("with X (Artist)") is unchanged.
    `MediaPoolItem.ReplaceClip()` swapped `…_05-starships-ufo_card.mov` into the V3 item (321873, position kept); old PNG and movie
    in `_superseded/`. Out = A8's last frame **330029** (03:40:01:04; In/Out 321816–330029, 8214 f, RELEASE marker updated). The
    bounce's tail: crowd at about −20 dB until 03:40:00:05, then its own fade, −44 dB at 330010 and −89 dBFS on the last frame: it
    does reach silence, but in about 1 s.
- **V2 medley grade handover (2026-10-29; Dean: "Okay talk to the gigstills agent to do grades … it might need some keyframes
  particularly a few cloud shots and one of the bass player around 03:38:39:20").** gigstills-ce briefed through
  `gigstills/runs/sydney26_v2voyagers_medley/BRIEF.md`; cut list written by the new read-only `scripts/resolve/cut_list.py`
  (99 cuts, 321816–330029; the bass player is cut 73, Photo Pit 327951–327999). gigstills asked for a **look-ON** 1080p render as well
  (Dean judges "darker" with the look on, so the keyframe lifts should be measured in what he sees). Render jobs queued by a
  scratchpad `rjob.py` (SetMarkInOut, then one job, its MarkIn/MarkOut read back, `StartRendering([jid])`).
  - **`SetRenderSettings` refuses the whole dict when one key is refused.** With ProRes 422 LT (`mov`), `SelectAllFrames: False`
    and `MultiPassEncode: False` each return False (21.1.1), and a dict containing either fails. Send `MultiPassEncode` only for
    H.264/H.265 and leave `SelectAllFrames` out: the job's MarkIn/MarkOut read-back checks the range. The format name is `mov`, not `ProRes`.
    A failed setup had already moved the In/Out (SetMarkInOut runs first), so restore it from the RELEASE marker either way.
  - **Renders (2026-10-29, M5 Pro / 64 GB):** look-on 1080p H.264 of the medley (8214 f) **7 min 7 s**; look-off Rec.709 **45 s**;
    look-off DWG/DI ProRes LT **47 s** (3.32 GB). The Film Look Creator is ~90 % of a look-on render. All render-qc PASS; look-on ≠
    look-off (F325000 mean Y 15.6 vs 21.9); a 2-frame look-on control at 325000 framemd5-identical before and after. Restored:
    output Rec.709/G2.4, V2/V3 on, In/Out from the RELEASE marker, playhead, 5 jobs cleared, saved.
  - **Resolve's Preferences window blocks scripting:** while Dean had it open, `GetCurrentPage()` read None, `SetTrackEnable`
    did nothing and `SetCurrentRenderFormatAndCodec` returned False. Page None with a project open = a modal window; ask, don't retry.
  - **`render-qc.sh` broke on ffprobe 9.0.2** (and so would any `-show_entries stream=… -of csv=p=0` read): ffprobe 9 repeats
    stream entries under a `stream_group` section, so each value came back twice with a newline and the Python checks crashed into
    FAIL. Fixed with `| grep . | head -n1` on the four reads; proven PASS on the look-on render and FAIL on a wrong range.
    Trigger: Resolve renders (timecode track → a stream group; 2–3 copies); WAVs and ffmpeg-made files read once. `-of json` is safe
    (stream_groups is a separate key). Same day: `splice-mix.sh`, `endcard-qc.sh`, `endcard-treat.sh`, `song-card-movs.sh` fixed the
    same way, and `build_media.py`, `drum_scan.py`, `desk_project.py`, `desk_compare.py`, `mix_scan.py` now take the first non-empty
    line (they read WAVs, so they weren't failing yet). gigstills `drum_noise.py`/`noise4k.py` flagged to gigstills (their repo).
    mix-assist's library uses JSON; its plain-text callers are one-off research/repitch scripts on WAVs.
  - **Machine (Dean, 2026-10-29: "I have a chunky machine now … take advantage of it where possible"):** M5 Pro, 64 GB, 18 CPU /
    20 GPU cores. The finished look-on render went to gigstills while Resolve rendered the look-off ones. Agent file and skill
    updated: parallel when headroom allows (CLAUDE.md 2026-10-27), not "one at a time across all sessions".
- **`memreg` retired (2026-10-29; Dean, relayed by gigstills-ce: "we aren't using it any more").** `~/bin/memreg` no longer exists.
  Earlier entries that register jobs with it, or use its comfort gate and TTLs, are history: size jobs from `vm_stat` headroom
  (CLAUDE.md 2026-10-27) and don't put memreg in briefs.
- **V2 medley grade applied (2026-10-29).** gigstills-ce (`runs/sydney26_v2voyagers_medley/REPORT.md`): 51 LUTs built; **34 applied**
  (24 base, 10 face lift; faces targeted at this song's own median after Dean's "I want things darker generally, but these are
  pretty dark shots"), 17 held for Dean, 48 no LUT. Pre-check (dry run): all 34 rows matched a current V1 item, 1 node, no LUT;
  `RefreshLUTList()`, `SetLUT(1, …)`, 34/34 read back; rollback `rollback_editor_20261029.json`. Verify render
  `Renders/verify_StarshipsUFO_V2Voyagers_Syd26_lut_lookoff_v1.mp4` (look off, 46 s, render-qc PASS): cut 2 mean Y 37.6 → 44.4, cut 13
  (no LUT) 20.0 → 20.0. Keyframe plans for cuts 73 and 13 (static keyframes, HDR Global Exp on a serial node) go to Dean: UI-only.
- **V2 medley held-grade review page (2026-10-29, Dean: "Can we make a review sheet?").** Under Pressure's format: 18 cards (17 held
  + cut 36, flagged by gigstills' verify for rollback), 1080p look-on frames rendered from Resolve at each cut's middle frame (V3 off),
  "Original" = no LUT, "Graded" = with it. Done as: 36's LUT off → 18 two-frame ProRes HQ jobs started by id together (`rbatch.py`) →
  all 18 LUTs on → 18 more → held LUTs off, 36 back on; each step read back 18/18; tracks/In/Out/playhead restored; jobs deleted.
  Mean |before − after| 2.6–33.6 levels per pair. Page https://claude.ai/artifact/BQtqUALQN6mCYxfvLYoK8M, `db` decisions/c### =
  {cut, decision: graded|original, note}; frames in gigstills `runs/sydney26_v2voyagers_medley/review/`.
- **Bear-inspired teal/amber look: handed back from gigstills (2026-10-29).** Dean had given it to gigstills-ce and asked me to take
  it back. Its study is in gigstills `runs/sydney26_look_bear/RECOMMENDATION.md` (FLC Split Tone already on and measured tiny; on this
  footage 77–85 % of mid-zone pixels are saturated LED wash; faces sit at −2.2 st with the violet shadows; proposes qualified HDR nodes
  between the CST pair and the FLC, A/B on Local Versions). **The look lives on one Adjustment Clip spanning the whole show
  (79500–360347), so any change to it also changes the already delivered songs on re-render.**
- **Held grades decided (2026-10-29, review page, 17 of 18).** Applied full: 9, 18, 27, 43, 49, 70, 82, 86, 96–99 (12/12 read back).
  Half strength (Dean: 24 "Maybe half way, main concern is the amount of noise"; 88 "Halfway?"): gigstills scaled the fitted grade
  until the *visible* change was half (halving the parameters gave only 0.67 of 2.24 st on 24: gamma and display curve interact);
  `v2med_c024_half.cube` (face +1.12 st, noise ×1.7 vs now, full was ×2.5) and `v2med_c088_half.cube` applied, read back. Kept
  original: 11, 12. **Cut 36 rolled back** (`SetLUT(1, "")`). Undecided: 66. Medley now: 48 + 14 + 2 − 1 = 34 + 13 = 47 LUT cuts of 99.
- **Rollback for the show look (Dean: "I want it for the whole show, but I want to be able to roll back to the old look").**
  1. Project export `/Volumes/BOTTB/Sydney - 2026/video/project_backups/BOTTB_Sydney_2026_Full_Show_pre-bear-look_20261029.drp`
     (`ProjectManager.ExportProject(name, path, True)` on the open cloud project, 6 s, 2.26 MB zip / 15.7 MB, 7 SeqContainers;
     it shows **Resolve is now 21.1.2**).
  2. Adjustment Clip local versions (API works on it): `RenameVersionByName("Version 1", "Look v1 (17 Oct)", 0)`,
     `AddVersion("Bear look", 0)` (becomes current, copies the 4 nodes), `LoadVersionByName(name, 0)` switches.
  **Proven on pixels** (2-frame look-on controls at 325000/300000/230000, framemd5): v1 = Bear copy = v1 reloaded; a test LUT on
  Bear's node 4 changed 325000 while loading v1 gave the original hash; removing it restored the hash. "Bear look" is left active,
  so Dean's look edits can't touch v1. The HDR/qualifier nodes are UI-only; the A/B render waits on Dean building them.
- **Bear look v1, Dean's settings (2026-10-29/30, "Bear look" local version on the Adjustment Clip).** Two corrector nodes, "Teal" and
  "Amber", between CST2 and the FLC (node ids 5 and 6; the .drp lists nodes by id, so their place in the graph isn't read back).
  FLC Split Tone OFF in Bear (`splitIsEnable` 0; Amount 0.3 kept), ON in Look v1. HDR palette colour balance (X / Y):
  **Teal: Dark 0.05 / −0.05, Shadow 0.002 / −0.02** (as Dean gave it; 0.002 may be 0.02); **Amber: Light −0.03 / +0.03.**
  First values were Amber 0.02, Teal Dark 0.04 / Shadow 0.02, then "increased the strengths a bit".
  - **Keys:** Teal = HSL Sat 0–30 (High Soft ~15) AND Hue = skin + 50 (wide, ~60–70), Lum off; Amber = skin key (picker on the
    white-lit hand, Lum off). **Dean first set Amber as the inverse of Teal: wrong**, since the inverse of "low-sat AND not-skin" is
    "saturated OR skin", which puts amber on the LED wash. Sampling skin on a violet-lit face (03:37:50:02) put the "skin" gap on
    magenta, so real skin (the hand) stayed in the teal key; sample skin under white light. In Resolve's default highlight view
    (Shift-H), **grey = NOT selected**, original colour = selected (I first wrote "white", which is Highlight B/W mode).
    Invert lives in the Key palette (Qualifier Invert, Output Invert) as well as the Qualifier palette.
  - **HDR Mode on these nodes: no.** The project has `useColorSpaceAwareGradingTools` 1; the manual (p.242) says not to use node HDR
    Mode with colour-space-aware tools; it is for HDR output.
- **Halation read-back now works on the cloud library: `resolve-lab/scripts/drp_flcstate.py` (2026-10-30).** Since 10-22 the
  project lives in Blackmagic Cloud, so there is no local Project.db for `flcstate.py`. `SaveProject()`, then
  `ProjectManager.ExportProject(name, path, True)` (6 s), then `python3.14 -I drp_flcstate.py <file.drp> [names]`: each
  `<ListMgt::LmVersion>` in the export carries its grade as hex `<Body>` (0x81 + zstd), the same blob. Read: final cut, both Look v1 and
  Bear look FLC ON, `halationIsEnable` 1, `bloomIsEnable` 1; control: a media-pool grade reads `halationIsEnable` 0. **This replaces
  the sqlite step of the halation rule for cloud projects.**
  - **Bear look reads more saturated (Dean: "it looks a bit more saturated … Was split tone doing something else?"; then "I don't
    mind that look").** Decoded Look v1's FLC split tone: Strong, Amount 0.3, Angle 35°, Pivot 0.45, **`splitIsProtectNeutrals` 1**.
    With neutrals protected it acts on the *coloured* pixels, pulling the violet/blue wash toward amber (nearly opposite), which
    mutes it; the 2026-10-15 check measured near-neutrals only, so it saw "barely any difference". Turning it off in Bear gives that
    chroma back; the Teal/Amber tints add chroma on neutrals and skin by design. Confirm the split on the A/B render (gigstills).
- **Bear A/B renders + the amber leak (2026-10-30, Dean at bed time: "on the big white shots, there was a noticeable pixel boundary
  where it turned yellow … maybe diagnose?").** `Renders/ab_StarshipsUFO_Syd26_look-{bear,v1}.mp4` (whole medley, look on, V3 off,
  8 min 2 s each; render-qc PASS), done by a scratchpad `ab.sh` that loads each version, renders, then restores "Bear look", V3,
  In/Out, playhead and clears the jobs. Three-way at 03:39:48:12 (look-on before grades / v1 / Bear): clean, clean, **blocky orange
  patch** → the Bear nodes, not the cut-97 LUT; Teal can't make orange, so **the Amber key leaks**. Bear vs v1 elsewhere: green haze
  goes yellow (03:38:47:10, orange added to green), pale projection screen goes orange (03:39:15:00), finale smoke and silver suits
  orange/copper (03:39:41:24–end, up to 39 % of the frame). Scan: gigstills `runs/sydney26_look_bear/editor/orange_scan.py` (+ json).
  The blocky edges are the camera's compression blocks flipping in and out of a hue key on near-neutral pixels. The puck hue is
  fine (orange); the key is too wide (hue range includes pale yellow/green, Sat Low too low, Lum uncapped). gigstills asked for
  measured qualifier numbers that separate faces from the leaks. **While the v1 render ran, "Look v1" was the active version: any
  UI change then would have gone into v1. Tell Dean before an A/B that renders the old version.**
  - **Qualifier numbers in the look nodes don't map to the display hue bar (2026-10-30).** Dean's first Amber key (picker on a
    white-lit hand): Hue 32.1 / Width 40.8 / Soft 10, **Sat 0–3.6**, Lum off (sampled 49.9–60.3). It keyed near-neutral smoke,
    screens and silver with a slight yellow cast (Dean: "It seems that key is picking up yellow not skin tone"). My placeholder fix
    (Hue ~28, Width ~16, Sat Low ~2, Lum 30–65) left amber "almost never" active except on yellow objects. Reason: the Teal/Amber
    nodes sit after CST2, i.e. on DWG/Intermediate values, where skin reads Sat < ~2–4 on the qualifier scale. **Don't guess
    qualifier numbers in DWG/DI nodes from the display bar: measure faces vs leaks on the DWG/DI render first** (asked of
    gigstills, `runs/sydney26_look_bear/RECOMMENDATION_amber_key.md`). Fallback: no qualifier, a much smaller Light-zone amber.
  - **Amber changed to option B (Dean, 2026-10-30: "Should the amber qualifier apply to skin tones? … we are making only skin tones
    more amber?", then "Lets do more of B").** Options put to him: A skin-only amber (needs a DWG/DI-measured key), **B warm highlights
    everywhere: Amber node with no qualifier and a much smaller Light-zone amber**, C no amber (FLC Skin Bias 0.7 already warms skin).
    Steps given: all three qualifier switches off (check Shift-H shows the whole frame), Light about −0.01/+0.01 (a third of −0.03/+0.03),
    check the smoke at 03:39:48:12 / 03:39:55:00, and if it goes cream a small opposite Highlight push (~+0.005/−0.005). gigstills
    switched from the key analysis to a measured Light strength for B. Re-render Bear for its A/B after Dean sets it.
  - **gigstills on option B (2026-10-30, `runs/sydney26_look_bear/RECOMMENDATION_amber_key.md`):** unkeyed Amber Light
    **−0.005/+0.005** (wash hue shift median 3.4°, worst 4.2°; smoke +1.7 Lab chroma; −0.004 if 96–97 smoke reads warm); no
    Highlight/Specular counter-push (the amber peaks at display 0.47–0.69, where the orange smoke sat). **Bear as rendered is
    brighter in darks/mids** (p50 up on 12 of 15 test cuts, +54 % cut 2, +59 % cut 25; dark faces ~+30 %), not from amber:
    Teal node or split tone off. Asked Dean to check Teal's Dark/Shadow Exp and try Dark Exp −0.1…−0.2. Key study, for the record:
    **Resolve qualifier Hue = DI hue/3.6 + 31.8** (Width = full width at 50 %, Soft = total ramp); Resolve Sat is compressed (skin < 2);
    the best DI key kept 81 % of skin and caught 3–20 % of the leaks, so no clean skin key exists here.
  - **Bear look v2 settled by Dean (2026-10-30: "Okay I am happy with this setting").** Amber node rebuilt with no qualifier (deleting
    the node was simpler than finding the switch: Dean "I can't work out how to disable the qualifier"), Light −0.005/+0.005 per
    gigstills (corrected 2026-10-30: the HDR X/Y fields step in 0.01, so Dean's node most likely holds −0.01/+0.01, twice that). **Node order IS readable through the live API**: `GetNodeGraph()` index order with `GetToolsInNode(i)` read 1 CST1,
    2 CST2, 3 Teal [HSL Qualifier, HDR], 4 Amber [HDR], 5 FLC, 6 Primary Balance (the .drp lists by node id instead, which misled
    me earlier). Export check: halation ON in both versions, split tone OFF in Bear / ON in v1. Bear re-render
    `Renders/ab_StarshipsUFO_Syd26_look-bear_v2.mp4` for gigstills' A/B (tag bear_ab_v2). Teal Exp not confirmed by Dean.
  - **Dean changed the grade during my render** (Teal Dark Exp −0.01 while `bear_v2` rendered). A render taken across a grade change
    is mixed, so I stopped my own job (`StopRendering()` only after checking the queue held just that job id; it read 11 %), moved
    the partial to `_superseded/`, deleted the job and re-rendered as `ab_StarshipsUFO_Syd26_look-bear_v3.mp4`. **Say "don't change
    the grade until I say the render is done" when starting a render while Dean is grading.** −0.01 Exp is ~0.01 stop; gigstills'
    brightening was ~0.6 stop on p50 in some cuts.
  - **Bear v3 render (unkeyed Amber as set by Dean, recorded as −0.005/+0.005 but probably −0.01/+0.01, Teal Dark Exp −0.01; render-qc PASS) vs v1:** the orange blotches are gone
    (03:39:48:12 smoke clean, slightly cooler than v1). The orange scan's "R−B up" now reads median 1.0 %, peaks 66–77 % on the
    **green-lit drum cuts** (03:39:22–25, 03:38:46–48, 03:35:45, 03:36:48): the green wash moves evenly toward yellow-green (amber
    plus no split-tone pull), with no patches. The scan no longer separates leaks from intended warmth once the key is gone; use
    gigstills' wash-hue measure (ab_measure, tag bear_ab_v2 on the v3 file) for the verdict.
  - **gigstills on Bear v3 vs v1 (2026-10-30, RECOMMENDATION_amber_key.md §7):** leaks gone; **darks still brighter**: display luma
    ratio p5 ×1.28, p25 ×1.19, p50 ×1.08, faces ×1.09 (≈0.25 st at p5); 38 of 99 cuts p25 > +15 %, worst dark cuts 50 ×2.4, 28/14 ×2.0.
    Uniform across hue/sat, so not the Teal key; most likely FLC split tone off (v1's Strong split held shadows down). Teal Dark Exp
    −0.01 had no measurable effect. **Unkeyed amber came out ~2× the linear model's prediction**: green wash −7…−9° (cut 96 −14.3°),
    fails < 5°; smoke +3.7–4.0 Lab warm; violet unchanged; faces toward skin as with the keyed 0.03. Options put to Dean: toggle split
    tone on cut 25 (03:36:10:00) to confirm, then Teal Dark/Shadow Exp −0.2/−0.1 or split tone back on at a lower amount; Amber
    −0.0025/+0.0025 if greens/smoke read too warm. (My orange scan is not a leak detector for an unkeyed node: gigstills agrees.)
  - **HDR palette X/Y can't go below 0.01 (Dean, 2026-10-30: "Amber is the smallest possible move you can't do less than 0.01").**
    I wrote gigstills' −0.005/+0.005 down as Dean's setting without asking what the field read. The node most likely holds
    −0.01/+0.01, which accounts for the amber measuring ~2× the prediction: it is 2×. **For anything finer than a 0.01 step,
    set the smallest step and scale the whole node with Key palette → Key Output → Gain** (1.00 = full; on an unkeyed node the key
    is solid white, so Gain works as node opacity): 0.50 gives gigstills' −0.005, 0.25 gives −0.0025. Record what the field reads, not
    the number that was recommended.
  - **Where the amber shows, per cut (2026-10-30, new `scripts/look_ab_scan.py`, v1 against Bear v3, 99 cuts, 46 s with 5 workers;
    control v1 against v1 reads 0.0 everywhere).** Output: gigstills `runs/sydney26_look_bear/editor/abscan_v1_bearv3_20261030/`
    (json + `sheet_green.jpg`, `sheet_neutral.jpg`). **The cost is the green wash, not the smoke:** green pixels move −7…−10° toward
    yellow on every green-lit cut (cuts 21, 33, 45, 51, 54, 76, 78, 91 with green over 30 % of frame: −7.3…−13.7°). Clearest by eye:
    **cut 51, 03:37:34:21**, where the grey-blue projection screen turns yellow-green. Bright near-neutrals (smoke, silver suits) only
    +1…+3 b* (finale smoke cuts 96–98: +0.2…+2.0), hard to see side by side. Skin-ish pixels +5…+18° toward yellow. Dean asked
    about a Highlight move: not for warmth (the amber already peaks in display 0.47–0.69 and the smoke and suits are where a
    Highlight push lands; gigstills §3).
  - **Comparisons need a page (Dean, 2026-10-30: "I need a page, gigstills produced us a nice page. We always want that when comparing
    shots").** My look_ab_scan sheets (two 1920×4360 JPGs) were not enough. Asked gigstills to put the comparison page into a skill
    and regenerate it for v1 vs Bear v3 from the scan json plus its §7 levels. Rule now in the live-video-editor skill.
  - **Dean's picks on the v1 vs Bear v3 page (2026-10-30, 32 shots, read from gigstills `data/compare_v1_bearv3_choices_20261030/`).**
    Greens: v1 on 9 of 11, so fix the green shift (Bear kept only on cuts 45, 76). Amber: Bear on all 9, but on cut 97 smoke
    (03:39:48:02) "probably half as much". Darks: Bear on 7 of 8; cut 17 (03:35:42:13) "maybe halfway towards bear". Faces: Bear on all 4.
    Cut 11 (03:35:23:01): "distinct pixel edges of the teal due to camera compression" (the Teal qualifier keying on blocks).
    **The look is one adjustment clip for the whole show, so per-cut fixes (17, 97, 11) can't go on its nodes:** they go on the V1 clip
    grades, which carry into the Look v1 rollback too. Record which clips carry Bear-only fixes so a rollback can strip them.
  - **gigstills' colour checks, what to ask for after a look render (gigstills 2026-10-30; scripts in
    `runs/sydney26_look_bear/scripts`, run with `../../.venv/bin/python`).** `ab_measure.py` (15 focus cuts: wash hue, neutrals, faces,
    floors, clipping; pass = wash |dH| < 5°, faces not further from skin, p0.1/p5 unchanged, no new clipping; ~4 min); `ab_levels.py`
    (whole-song luma ratios p5–p90 + faces; ~3 min); `green_floor.py` (per-cut p1/p5 floor and darkest-quarter colour: finds washed-out
    cuts; ~3 min); my `look_ab_scan.py`; qualifier B−A shift maps (key edges, compression blocking); the shot-compare page (Dean's picks
    read back with ArtifactData). After a look change ask for: ab_measure + ab_levels + look_ab_scan + a compare page.
  - **Dean set Hue vs Hue −13 on greens (per gigstills, 2026-10-30; not yet confirmed to me).** He is considering crushing the washed-out
    green shots. gigstills' green_floor (Bear v3 vs v1): most green cuts already sit at p1 = 0, so crushing would only clip. Raised
    floors: 18 03:35:46:01 p5 0.49 (all green, no blacks), 88 03:39:23:24 0.23, 43 03:37:05:24 0.13, 89 03:39:25:22 0.11,
    46 03:37:14:22 0.065, 74 03:38:40:21 0.056, 49 03:37:23:11 0.052 (v3 roughly doubled 43/46/49). Advice: a node on each cut's own
    V1 clip grade after its LUT, Dark/Shadow Exp down, no qualifier (a green key on an all-green frame selects everything and adds
    edges in noisy darks, as on cut 11). Those are Bear-only fixes: add them to the rollback strip list.
  - **Washed-out green shots are a squeezed green channel, not raised blacks (Dean, 2026-10-30, scopes at 03:39:32:07, cut 91: "it
    might be that there are no midtones").** Measured (10-bit, p5/p25/p50/p75/p95): G look-off 249/469/658/722/786; v1 221/501/726/794/850;
    Bear v3 241/509/722/786/842, with 36–39 % of pixels above 760 in the output roll-off. R is 0 on a quarter of the frame. The dark areas
    are green haze (G ~230–500), mids and lights by luminance, so **HDR Dark/Shadow Exp barely touches them** and a crush would only clip R.
    Bear also lifts R mids (p50 245 → 373): that's the yellowing. Fix is a green-only curve on the clip grade (pull the green
    lower-mids down, keep the top), like Dean's red-wash toe rule. Scratch measurer: per-channel percentiles from look-off, v1, Bear.
  - **A green-only curve shifts everything else toward magenta (cut 91, 03:39:29:02, 2026-10-30).** Dean put a Custom Curves node
    (green only) on the V1 clip (it had no LUT). Measured with `clip_ab.sh` (scratch: render the clip with the node on, toggle it off
    with `SetNodeEnabled`, render, re-enable, render again; on and on2 framemd5 identical, so the toggle round-trips): greens −14 chroma
    as intended, but the skin, orange and red pixels −39° hue, blue/violet +39° toward purple, near-neutrals +3 chroma (pink on the silver suit and
    wig). The curve takes green out of every pixel. Limit it with a soft green hue qualifier, or use Hue vs Lum on greens.
    Page: https://claude.ai/artifact/38UbJTnjZEMDym96Wv3L1n (built with gigstills' shot-compare `build_page.py`; Artifact publish needs
    the page copied under the scratchpad or cwd).
  - **Washed-green shots across the medley (2026-10-30, `editor/greenwash.py` on Bear v3, every 5th frame, frames with > 50 % green).**
    The drum camera is far worse than cut 91: G p5 560–780 (cut 91: 252), so there are no shadows at all. Cuts 74 03:38:41:01 (worst),
    88, 31, 49, 18, 36, 43, 39, plus 82 (Photo Pit). About as flat as 91: 76, 45, 78, 87, 33, 89. Most strobe green/dark, so the fix is the
    cut 91 one (curve + green Hue qualifier, no keyframes). Page: https://claude.ai/artifact/VcknwAGBsRzu35xK52XEfB (gigstills
    shot-compare build_page.py, Look v1 vs Bear v3).
- **V2 medley pre-RiP (2026-10-30, Dean: "I am happy let's move on to finalising, denoise and scaling etc and get ready to ship it").**
  state.py: final cut, 3840×2160, In/Out = RELEASE 321816–330029, queue empty. 25 cuts Orange (18 Dynamic Zoom + 7 static ≥ 1.3; state.py's
  "19 dynamic + 7" double-counts one), none with Face Refinement or a depth key; cut 91 (03:39:29:02, DZ) carries Dean's green HSL qualifier
  node, which keys per pixel and stays live on the bake. Pre-RiP refs (look on, ProRes 422 HQ, **1080p** because rjob.py forces 1920):
  `checks/ripcheck_v2med_{sr18_327270,c91dz_329305}_preRiP_v1.mov`. Super Scale 2 on 24 sources; output DWG / Intermediate (read back).
  Dean's clip-grade fixes with qualifiers (not zoomed, not RiP'd): cuts 18, 74, 75, 76, 78, 81, 91; keyframes on 73 and 13.
  zsh does not word-split `set -- $r`: use `${=r}` (a loop ran rjob.py with one argument; it failed before touching Resolve).
- **Denoise is mine to switch, not Dean's (2026-10-30, Dean: "You can do 1 I think?", then "Make sure you remember this").** CAM 5 Drum
  (S-Log3 8-bit) group Pre-Clip = node 1 HDR, node 2 `OFX: Noise Reduction` (the other four groups have one empty pre-clip node).
  `scripts/resolve/grpnode.py "CAM 5 Drum (S-Log3 8-bit)" 2 1` (via the atexit wrapper) switches it; no read-back exists, so prove it on
  pixels: 3 frames of a drum cut at 4K before and after (`checks/nrcheck_v2med_drum_324100_{before,after}_v1.mov`), then
  `scripts/nr_check.py`: spatial HF sd 0.0192 → 0.0094, frame-to-frame 0.0440 → 0.0335, mean unchanged, and the render time 1.5 s → 15.3 s.
  Opening the multicam to do it by hand is no longer needed. After delivery: `grpnode.py … 2 0` and the same check the other way.
- **Render in Place reuses file names and overwrites (2026-10-30, V2 medley RiP to `/Volumes/BOTTB/Renders`).** The 25 new files are named
  `Sydney 2026 Multicam - <angle> Render[ N].mov`, numbered from scratch for each RiP, and the folder went from 117 to 127 such files:
  about 15 Canvanauts files were overwritten in place. They were orphans (decomposed 2026-10-17), and a scan of every timeline found no
  item outside the medley using any of the 25 paths, so nothing broke. **Give every RiP its own empty folder**
  (e.g. `Renders/RiP/<song>/`), and run the path-user scan (`pathusers.py`: every timeline's items vs the new paths) after any RiP into a shared folder.
- **V2 medley RiP done (2026-10-30, Dean, to `/Volumes/BOTTB/Renders`).** 25 Video items tagged DaVinci WG/Intermediate, 6 LUTs still live,
  cut 91's qualifier node live; output back to Rec.709 / Gamma 2.4 (read back); 25/25 re-assigned to CAM groups by angle; Super Scale 1 (24).
  Pixels post vs pre (look on, 1080p, middle frame): Stage Right 1.8× mean |Δ| 0.023 but blurred 1.8/255 (signed ≤ −0.005, p50 0.356→0.354):
  the difference is texture, visibly sharper from Super Scale; cut 91 DZ 0.0073, blurred 1.3/255. CAM 5 NR ON (grpnode.py, pixel-proven).
- **axpress needs Accessibility trust, and this session had none (2026-10-30).** `axtrusted` printed `AXIsProcessTrusted: false`, inside and
  outside the sandbox, so menu-bar edits (roll, Extend Edit) went to Dean. The medley's last cut (329934–330077) ran 47 frames past the
  Out (330029), so a FadeOut on it would not reach black at the Out: roll its end edit back to 330030 before setting the fade. Build
  the tools from `resolve-lab/tools/*.swift` with `swiftc`; trust is granted in System Settings › Privacy › Accessibility (Dean's call).
- **V2 medley end and render setup (2026-10-30).** Dean rolled the last cut's end edit to 330030 (read back: 329934–330030, next V1 item
  starts 330030, audio unchanged). EndCard_2x on V3 329932–330030 (endFrame 98 exclusive), CompositeMode ADD read back 1. **The last cut is
  only 96 frames, so `SetFades({"FadeOut": 98})` returned False** (fade longer than the item); 96 was accepted and **reads back 95**.
  A8 left without a fade (Dean: the bounce fades itself). Halation from `ExportProject` + drp_flcstate: Bear look FLC ON, halationIsEnable 1
  (Dean confirmed too). Export kept: `project_backups/BOTTB_Sydney_2026_Full_Show_pre-medley-render_20261030.drp`. 4K job 2118eab9:
  321816–330029, 3840, H.264 45 Mb/s, MultiPassEncode False, audio on → `Renders/V2Voyagers_StarshipsUFO_Sydney2026_4K_v1.mp4`.
- **V2 medley delivered (2026-10-30 ~15:45):** 4K v1 1,862,415,927 B; 1080p v1 496,769,382 B (11.8 Mb/s); IG v1 274,535,567 B
  (6.5 Mb/s target → 6.4, 261.8 MiB; 8 Mb/s would have been ~342 MB on 328.6 s). Both derived **in parallel** with `-threads 6`:
  ~1.15 GB peak each, 4.5/5.7 min, render-qc PASS on all three (8214 frames). −14.6 LUFS, −0.7 dBTP, LRA 6.9; last frame Y=16, end
  card visible. **After the render the Resolve bridge stayed blocked** (master finished 14:14; at 15:28 `wait_render.py` was still
  alive and a one-line job-status read hung 120 s, Resolve at 3 % CPU, so not rendering; probably playback or a dialog). The master
  was QC'd from the file (ffprobe duration + render-qc) instead of waiting. Thumbnails filed in `Renders/Thumbnails/StarshipsUFO/`;
  handed to bottb-e8 (the session holding the V2 copy) in one message per the contract.
- **Same day, ~15:50: Dean force-quit Resolve** (it had stopped answering him too; the blocked bridge above was Resolve hung, not
  playback). Deliverables were already on disk and QC'd. Cleanup (NR off, Orange clear, In/Out, render name) waits for a relaunch;
  on reopening, run `state.py` and compare against the 13:52 export (`pre-medley-render_20261030.drp`: end card, fades, roll, NR on)
  to see what the force quit lost. Anything changed after 13:52 and not saved is gone and was not in the render either.
- **After the force quit (2026-10-30 ~16:30):** Resolve reopened with no project; I loaded "BOTTB Sydney 2026 Full Show" by
  script (`LoadProject`, cloud DB, no prompt). **What survived:** end card + Add, Dean's roll, 25 Orange, A8, Bear look version.
  **Lost:** the last cut's FadeOut (read 0; re-set 96 → reads 95). So a force quit can drop the last unsaved edit: after one, re-read
  every pre-render change, not just the big ones. Post-delivery done and read back: CAM 5 NR off (`grpnode.py … 2 0`; 3-frame
  render 0.9 s vs 15.3 s with NR, HF sd 0.0265 vs 0.0094 on), Orange 25 → 0, jobs cleared, In/Out = RELEASE, render name = timeline
  name (probe job read `BOTTB Sydney 2026 - final cut.mov`, deleted), saved. **The 13:37 `nrcheck_*_before/after` refs were rendered
  look-off** (mean 0.29 vs 0.30–0.31 now): compare an NR re-check against a frame cut from the delivered master, not those.
  Halation left ON until Dean says.
- **Tools promoted from the scratchpad (2026-10-30, Dean: "consider what you learnt… what improvements, skills or tools"):**
  `scripts/resolve/rr.sh` (runner + hang guard), `render_range.py`, `post_delivery.py`, `last_fade.py`, `open_project.py`,
  `wait_render.py` hang guard, `scripts/derive-1080-ig.sh` (IG rate from duration, parallel; now on this branch) and
  `scripts/handover.py`. Each was proven on the V2 medley: a 3-frame render through render_range → wait_render → post_delivery
  (job deleted, In/Out back, name read back), the hang guard with a sleeping script (rc 142), derive's rate/QC path on the
  existing files. **derive's own encode branch hasn't run from the script yet** (same ffmpeg command as the proven parallel run).
  Lesson: the medley ran ~40 helpers from `/tmp`; promote on the second run.
- **gigstills' Resolve colour facts (2026-10-30, each one first given as wrong advice; recorded from gigstills-ce, not re-measured here):**
  HDR wheel X/Y minimum magnitude 0.01; go lower with node Key Output Gain (0.5 halves it). **Hue vs Hue: a NEGATIVE Hue Rotate moves a
  hue rightward on the strip** (green toward cyan); anchor yellow and skin at 0. Qualifier hue bar: Resolve Hue = DI hexcone hue / 3.6
  + 31.8; skin ≈ 23–40. Get the Highlight/mask view before advising on a qualifier: a key edge across noisy darks flips compression
  noise in and out (cut 11's blocks); soften that edge side, widen past the noise or add Clean Black, keep Blur and Pre-Filter.
  Measure p1/p5/p10 before a global crush (most green cuts were already at black). Strobing: cut 51 goes 0–82 % green between
  samples, so **3-frame-per-cut scans (my look_ab_scan) mislead**; gigstills `look_check.py` (every 5th frame, one pass per render)
  replaces it and ab_measure/ab_levels/green_floor. `key_noise.py` checks blocky keys on node-off/on clip renders.
