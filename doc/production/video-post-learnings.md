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
  no longer necessary for new cards. Note this does NOT retroactively fix
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
  So any transformed clip (pan, zoom, dynamic zoom) carrying a depth/AI key goes in the RiP set.
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
