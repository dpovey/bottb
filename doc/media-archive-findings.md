# BOTTB media archive — findings & plan

Investigation 2026-09-22/23. Goal: consolidate in-use raw video onto one disk, back up
Brisbane 2025 + Sydney 2025 to Google Drive, free a whole disk for the Sydney 2026 event,
and reorganise the Google Drive.

---

---

## 0. THE PROCEDURE (read this first)

Rebuilding one band's timeline onto trimmed media. Everything below is measured; the
numbered detours at the end are things that were tried and are wrong — do not retry them.

### Step 1 — trim the angles (Resolve Media Management, never ffmpeg for BRAW)

For each angle, build a **plain, non-multicam** timeline containing only that angle over the
band's range, then **File → Media Management → Timelines → Copy → "Used media and trim keeping
48 frame handles"**. The size estimate is the tell (389.8 GB → 5.05 GB). Media Management
preserves Blackmagic camera metadata and Input Color Space; `ffmpeg -c copy` silently drops them.
Media Management refuses to trim inside a multicam (reports New Size == Current Size).

### Step 2 — retarget the FCPXML

Export the source timeline as FCPXML 1.10, then:

```sh
tools/resolve_finish.py inpoints --src "Timeline 1" --out inpoints.txt     # Step 3
tools/fcpxml_retarget.py --in Info.fcpxml --out band.fcpxml \
    --map-file trim.json --crop-to-fill --inpoints inpoints.txt --report --verify
```

**One pass, always from Resolve's ORIGINAL export — never re-run on a file a previous run
produced.** `--map-file` points the angle assets at the trimmed files; `--crop-to-fill` is the
letterbox fix (Step 4); `--inpoints` fixes Resolve's wrong exported `mc-clip/@start` values
(Step 3) and re-anchors every connected clip (titles, End Card, sync audio) so it stays on its
frame. The tool refuses to write if the trim does not cover the cuts, which is the check that
caught a real 17–27 s tail shortfall.

Check the output before importing: every connected clip should sit exactly where the original
export has it, on a whole frame (Jumbo: 33 of 33), and the mc-clip start deltas vs the export
should be only 0 and +1 frame.

### Step 3 — build the in-point truth file from `GetSourceStartTime()`

Resolve's FCPXML **export** writes wrong `start` for some mc-clips, so the truth must come from
the live project:

```sh
tools/resolve_finish.py inpoints --src "Timeline 1" --out inpoints.txt
```

Resolve exposes **three** in-point fields and only one is right everywhere. Measured on all 585
Jumbo cuts:

| field                           | 584 ordinary cuts        | the 80 % retimed cut       |
| ------------------------------- | ------------------------ | -------------------------- |
| `GetSourceStartFrame()`         | **one frame low on 160** | right                      |
| `GetLeftOffset()`               | right                    | **wrong by 24,068 frames** |
| `GetSourceStartTime()` → frames | right                    | right                      |

Patching from `GetSourceStartFrame()` is what left **160 cuts rendering exactly one frame early**
— the rebuilt frame came back bit-identical to the _previous_ frame of the original, which also
proves the trim itself is lossless. Patching from `GetLeftOffset()` would have thrown the retimed
cut 17 minutes off; a histogram of start deltas before import caught it. **Always check that
histogram**: it should be only `0` and `+1`.

The tool adds a **+1/1000 frame nudge** to every patched in-point: Resolve mis-rounds
irreducible rationals (`182671/24s` imports as frame 96270, not 96271). **Keep it tiny.** The
first version used 0.1 frame, which is harmless on 24 fps angles but not on the 25 fps Roving
camera in a 24 fps multicam: its sample positions are already fractional, so 0.1 flipped the
chosen source frame about once a second (40 frames wrong per 100 s) and broke 13 frames of the
80 % retimed clip. At 1/1000 both went to **zero**.

Retimed clips can have a **sub-frame** in-point (Jumbo's 80 % clip starts at 96271.2). Keep it
exact — `resolve_finish.py inpoints` writes it as `96271.2` and the tool carries it as a fraction.

### Step 4 — import, and keep the letterbox fix

```sh
tools/resolve_finish.py import --fcpxml band.fcpxml --name "BAND FINAL"
tools/resolve_finish.py finish --src "Timeline 1" --dst "BAND FINAL" --timeline-grade tl.drx
```

`finish` transfers everything FCPXML drops: item properties (incl. the scaling keys), fades,
speed changes, markers, a clip-for-clip audio rebuild with its crossfades, the A1/A2/A4 mute
that mirrors the A3 solo, and the timeline-level grade. The `.drx` must be grabbed from the
source with the Color page in **Timeline** mode.

Resolve builds its own multicam on import. **The three
`scale="1.0666667"` `<adjust-transform>` values on the 4096-wide angles are CORRECT and
deliberate** (now written by `--crop-to-fill`) — Resolve _fits_ (0.9375) where the original _crops_, so without them every shot
comes back letterboxed, smaller and darker. Measured: PSNR 21.58 → 26.43 dB.
CAM D (3840-wide) must stay at `scale="1 1"`. Do not "fix" these back to 1.

### Step 5 — restore the grades with ColorTrace

**Media Pool → right-click the new timeline → Timelines → ColorTrace → ColorTrace From
Timeline…**, source = the original timeline, **Automatic**. Confirm a target clip shows matching
SRC/REC in the Property table, then Copy Grade and Exit.

**Leave every checkbox at its default.** Color, Sizing, Input Sizing and Version Camera Raw
Settings were each tested in isolation and all three runs produced _byte-identical_ results —
the options do not matter, and unchecking them wastes a run.

ColorTrace matches on source timecode, so it is only as good as the in-points: with the old
wrong in-points it swapped grades between 7 pairs of adjacent cuts every run; with the corrected
in-points, **0 of 585** tool sets differ.

FCPXML carries cuts, angles and media but **no grades at all**; the source timeline has two
grade layers — a per-cut **clip** grade (`Primary Balance` + `Custom Curves` on all 585) and a
**timeline** grade. Restoring only the timeline grade leaves the rebuild visibly darker.

### Step 5b — transplant Dynamic Zoom through a `.drt` round trip

```sh
tools/resolve_finish.py dynzoom --src "Timeline 1" --dst "BAND FINAL" --name "BAND FINAL DZ"
```

Dynamic Zoom rectangles and curve have **no scripting API**, FCPXML drops them, and Paste
Attributes does not offer them. Resolve's native `.drt` timeline export does store them, in each
clip's `<EffectFiltersBA>` (u32 version, u32 length, flag byte `0x80` raw / `0x81` zstd, then a
protobuf payload). `dynzoom` exports both timelines as `.drt`, copies the source clip's blob
verbatim onto each Dynamic Zoom cut of the rebuild (matched by V1 start frame), and imports the
result as a new timeline. Because `.drt` is native, angles (by UUID), grades, media and everything
else survive the round trip.

Measured on Jumbo (100 s window, 2400 frames): **2258 bit-identical; the only differing frames are
the 2 Dynamic Zoom cuts in the window, at 57–69 dB** (was 21–23 dB) — sub-code-value, invisible.
Running the tool twice gives byte-identical renders.

Gotchas: Resolve names an imported `.drt` after the **file**, ignoring `timelineName`; and the
round trip (like the finish pass) can drop fades, so both steps re-assert fades last.

The source values, for reference, are also in Resolve's OTIO export (`Resolve_OTIO` → effect
"Dynamic Zoom": `dynamicZoomScale`/`dynamicZoomCenter` keyframes, `dynamicZoomEase`). Jumbo's 66:
centre always 0,0; 43 default (1.0↔0.8), 14 swapped, 9 hand-set scales — see
`doc/jumbo-dynamic-zoom-cuts.txt`.

### Step 6 — verify, in this order

1. **Control render first**: re-render the _source_ timeline over the range and PSNR it against
   an earlier render of itself. Expect `inf` / 100 % identical. This proves the renderer is
   deterministic and there is no noise floor. (File _sizes_ differ between identical renders —
   container metadata — so never compare sizes.)
2. Per-frame PSNR with `stats_file`; the headline number is **identical-frame count**.
3. Run `tools/resolve_finish.py verify` for the structural checks (positions, angles, in-point
   deltas, properties, timeline grade, audio counts), then map any differing frames back to items.

Expected residual after Steps 3 and 5b: **only the Dynamic Zoom cuts, at 57–69 dB** (visually
identical, not bit-exact), plus one whole-clip fade that Resolve caps at duration−1 (a 239-frame
fade-out on a 239-frame clip comes back 238 — `verify` reports it as a known limit). Measured on the
100 s window with clip grades off on both sides: **every other frame bit-identical**, including
all Roving frames and the retimed clip. The clean way to measure this without waiting on a
ColorTrace pass: duplicate the source, `SetNodeEnabled(1, False)` on the window's items, and
compare against the un-ColorTraced rebuild.

### False detours — tried, measured, wrong. Do not repeat.

1. **Reconform From Bins to move a graded timeline onto the new multicam.** Keeps grades, but
   **destroys all per-cut angle selection** — FCPXML import regenerates angle UUIDs, so 0 of 4
   match and every cut falls back to the default angle. Verified by diffing `<mc-angle angleID>`.
2. **`TimelineItem.CopyGrades()` across timelines.** Returns `True` 585/585 and copies nothing.
3. **`Graph.ApplyGradeFromDRX()` on a multicam item.** One call never returned and **crashed
   Resolve 21.1**. Never loop it.
4. **Comparing DRX `<Body>` blobs to test grade equality.** A clip that renders _bit-identically_
   still has a different Body. Use `GetToolsInNode()` — but note it compares the tool _set_ only,
   never values.
5. **`Graph.GetNumNodes()` as a test for "is there a grade?"** It returns 1 for an _ungraded_
   node. This is what hid the missing clip grades for hours.
6. **`TimelineItem.GetProperty()` as a test for "is the sizing the same?"** It exposes output
   Transform only — not Input Sizing, not Dynamic Zoom rects. It reported zero differences across
   all 585 items on all 32 properties while the images visibly differed.
7. **Blaming the media.** CAM D's trimmed file is _byte-identical_ to the original (same MD5,
   same Start TC, same frame count) and still rendered differently. The trim is lossless; a
   one-frame in-point error proved it by matching the neighbouring frame exactly.
8. **Chasing a spatial or whole-timeline temporal offset.** ±32 px search gives a 0.8 dB bump at
   best; a ±360 frame search peaks at offset 0. Neither is the cause.
9. **Re-declaring the angle format as the multicam's format.** Stretches instead of cropping:
   20.8 dB vs 31.2. The `scale=1.0666667` correction is the right fix.
10. **Chaining patches.** Re-running `--inpoints` on a file an earlier patch already moved put
    re-anchored clips a frame _late_ (sync audio at 489, not 488): the child position is only
    self-consistent in the original export. Always run the full pipeline from the export.
11. **Checking only V1.** The connected-clip drift (8 of 9 title overlays and the End Card one
    frame early) was invisible to a V1-only structural check and only showed as 51 odd frames
    in the PSNR. `resolve_finish.py verify` now checks every video track.
12. **A big rounding nudge.** 0.1 frame looked safe because it is safe at 24 fps. It isn't on a
    25 fps angle or a retimed clip. Use 1/1000.
13. **Rounding away sub-frame in-points** on retimed clips — keep them exact.
14. **Setting Dynamic Zoom through the API.** `SetProperty("DynamicZoomEase", n)` changes the value
    it reads back and nothing in the render (ease 0–3 rendered pixel-identical). Toggling Dynamic
    Zoom in the Inspector gives the right rectangles but not the original's curve.
15. **OTIO import as the rebuild route.** It carries Dynamic Zoom, but OTIO does not record the
    active multicam angle, so every cut imports on the multicam's FIRST angle (tested: disabling
    or reordering the angle tracks does not help). The export also writes multicam source times
    without `tcStart` (one hour out). And via the API it only imports with
    `importSourceClips: False` — the default fails silently, even for Resolve's own export.
16. **Trusting `SetFades()` returning True.** V1 and V2 fades were set, reported success, and were
    gone by the end of the finishing pass. Re-assert them last and check them in `verify`.
17. **`ffmpeg -v error` for PSNR.** Suppresses the summary (it prints at info level). Use
    `-hide_banner`, and always `-nostdin` inside shell loops.

---

## 1. Inventory

### Disks (all three are 2.0 TB SSDs — they are _not_ different sizes)

| Volume                                                      | Device                                       | Used / free       | Holds                                                                                                                                       |
| ----------------------------------------------------------- | -------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `BOTTB`                                                     | Samsung T7 (exFAT)                           | 924 G / **939 G** | Brisbane 2026 (Triffid, 27 Aug) active finish: Footage CAM A–D 649 G, DJI 12 G, Stills 63 G, Renders 60 G, Proxies 59 G, BOTTB@Triffid 57 G |
| `Battle Of Band 2025` (now `BOTTB SYD26`, wiped 2026-10-06) | Samsung **T7 Shield** (rugged, HFS+ → exFAT) | 1.6 T / 191 G     | Melbourne 2026 raw `Video/CAM A–D` 1.2 T · Sydney 2025 `Footage` 417 G · Stereo Audio 7.8 G                                                 |
| `Extreme SSD`                                               | SanDisk Extreme 55AE (exFAT)                 | 1.7 T / 129 G     | `bottb/` archive 1.5 T + ~200 G non-BOTTB (`.gradle` 86 G, ml-cache 31 G, Logic 27 G, DaVinci cache 33 G)                                   |

Role assignment (chosen on ruggedness, since capacities are equal):
T7 Shield → travel/field disk · Extreme SSD → media home · T7 → studio/active edit.

### Google Drive (info@bottb.com)

2 TiB total, 1.253 TiB used, **764 GiB free**, trash empty. Access via rclone remote `bottb:`.
144 folders / 1,786 files. `events/2026/Melbourne/01_media/video` is 1,246 GiB = **99 % of the drive**;
everything else combined is ~13 GiB.

Workspace plan is Business Standard (2 TB/user). Upgrade to Business Plus (5 TB) is
**+$133 AUD/yr** — far better value than the Additional Storage add-on ($40 USD/mo per TB).
Blackmagic Cloud: **$5/mo per project library** (worth it), **$15/TB/mo media** (not worth it
at this volume).

### Backup gaps

- **Brisbane 2026 raw (661 G on `BOTTB`) has no backup at all.**
- Melbourne 2026 masters: Drive only (after the T7 Shield is wiped).
- Sydney 2025: on T7 Shield _and_ Extreme SSD, verified byte-identical (name+size,
  all clips match; only macOS `._` sidecars differ). Not on Drive.

---

## 2. The Melbourne 2026 footage

`Jumbo - Full Set` → `Timeline 1`, 00:27:57:18, 585 cuts on V1, all inside **one multicam clip**
`A001_05200041_C001 Multicam` (03:36:24:15, 26 audio ch, Start TC 01:00:00:00).

| Angle         | Source                           | Duration | Size    | Notes                                 |
| ------------- | -------------------------------- | -------- | ------- | ------------------------------------- |
| Full Stage    | `CAM A/A001_05200041_C001.braw`  | 2:39:17  | 363 GiB |                                       |
| Left Camera   | `CAM B/B001_05270208_C001.braw`  | 3:36:24  | 493 GiB | spans 2 files                         |
| Right Camera  | `CAM C/C001_04220530_C001.mov`   | 3:29:23  | 229 GiB | **ProRes _Proxy_**, not a true master |
| Roving Camera | `CAM D/CLIP/C8666–C8675.MP4` ×10 | ~2:23    | 146 GiB | **25 fps** (rest are 24)              |

Four files hold 1,086 GiB of the 1,246. Per band (~28 min of a 216-min show) ≈ 189 GiB,
so per-band splitting saves only ~25 %; its value is restore granularity, not space.

### Camera clocks were never set — only CAM D is correct

| Angle | TC start    | File date        | Verdict             |
| ----- | ----------- | ---------------- | ------------------- |
| CAM D | 20:19:54:11 | 2026-06-05 20:24 | ✅ real time-of-day |
| CAM A | 00:41:36:22 | 2026-05-20 02:20 | ❌ 16 days early    |
| CAM B | 02:08:12:22 | 2026-05-27 03:47 | ❌ 9 days early     |
| CAM C | 05:30:09:04 | **2025**-04-21   | ❌ 14 months out    |

So the multicam was **audio-synced**, and the alignment exists in exactly one place:
the project library (410 MB, `~/Movies/DaVinci Resolve`, **boot disk, single copy**).

### The alignment (extracted from FCPXML export — keep this)

Multicam frame 0 == TC 01:00:00:00. Angle offsets within the multicam:

| Angle        | Source      | Offset               | Source start | Multicam-clock TC of its first frame |
| ------------ | ----------- | -------------------- | ------------ | ------------------------------------ |
| Left Camera  | CAM B       | **0.000 s** (anchor) | 7692.917 s   | 01:00:00:00                          |
| Right Camera | CAM C       | 397.833 s            | 19809.167 s  | 01:06:37:20                          |
| Full Stage   | CAM A       | 483.792 s            | 2496.917 s   | 01:08:03:19                          |
| Roving       | CAM D C8666 | 788.083 s            | 73194.440 s  | 01:13:08:02                          |
|              | C8667       | 1175.750             | 73582.080    | 01:19:35:18                          |
|              | C8668       | 1519.917             | 73926.240    | 01:25:19:22                          |
|              | C8669       | 1803.500             | 74209.840    | 01:30:03:12                          |
|              | C8670       | 3477.958             | 75884.240    | 01:57:57:23                          |
|              | C8671       | 5550.167             | 77956.440    | 02:32:30:04                          |
|              | C8672       | 8046.375             | 80452.680    | 03:14:06:09                          |
|              | C8673       | 10190.333            | 82596.560    | 03:49:50:08                          |
|              | C8674       | 11965.250            | 84371.480    | 04:19:25:06                          |
|              | C8675       | 12643.375            | 85049.640    | 04:30:43:09                          |

Show-clock constant K = 72406.293 s (multicam frame 0 ≈ 20:06:46 real TOD), but the ten CAM D
clips spread ±0.130 s (3.1 frames @24) — each was audio-synced individually, so **do not** force
one TOD constant; derive each file's TC from its own multicam offset.

Jumbo band starts at multicam 3468.625 s → multicam TC **01:57:48:15**.

---

## 3. Test results (all run 2026-09-23, evidence-based)

### ✅ Proxies work with camera originals deleted

Project closed and reloaded, original absent from disk:
proxy linked → renders normally, clip stays online. Proxy unlinked → **Media Offline**.
`LinkProxyMedia()` / `UnlinkProxyMedia()` are scriptable.
**Caveat:** file handles survive renames, so any test like this MUST close/reopen the project,
and Resolve caches rendered frames — use a fresh timecode per test or results are meaningless.

### ❌ Replacing an angle's media inside an existing multicam does NOT re-conform

`ReplaceClip()` and `ReplaceClipPreserveSubClip()` both put the content in the wrong place.
Proven that **timecode is ignored** on replace: two files with byte-identical video and
different TC (`06:21:19:23` vs `05:30:09:04`) produced byte-identical stills.

### ✅ Building a NEW multicam synced by timecode works — including trimmed angles

`CreateMulticamClip(clips, {"angleSyncMode": MULTICAM_ANGLE_SYNC_TIMECODE, ...})`.
A 2-minute trimmed CAM C, TC set to 01:57:48:15, landed exactly at 3468.6 s inside a
3h36 multicam. Resulting multicam: Start TC 01:00:00:00, duration 03:36:24:15 — identical
TC space and length to the original.

### ❌ Reconform From Bins re-points the clip but LOSES per-cut angle selection

**This is the key structural fact.** Per-cut angle choice is stored as an angle **UUID**, e.g. the
original's `0e5c29f9…` = Full Stage, `bf06adde…` = Left, `de3b7286…` = Right, `03db14e2…` = Roving.
Any newly created multicam gets fresh UUIDs, and reconform does not remap them — the
`<mc-source srcEnable="video" angleID=…>` element simply disappears from every cut and they
fall back to the default angle. Symptom: everything plays Full Stage or black.
Angle _names_ are irrelevant to this; matching names does not help.

### ✅ FCPXML import preserves cuts AND angle selection exactly

Importing the exported FCPXML reproduces the whole edit with angles intact, because the XML
carries the angle definitions and the per-cut `mc-source` references together, so the UUIDs stay
internally consistent:

```
585 cuts = 221 Full Stage + 174 Roving Camera + 120 Right Camera + 70 Left Camera
```

Frame-checked at 00:01:21:02: identical framing, identical angle, identical moment.

### ✅ The finishing work CAN be transferred programmatically (solved 2026-09-23)

The FCPXML round-trip gets cuts + angles right; everything else is copied item-by-item in
script, since the two timelines have exact 1:1 item correspondence (585 items, zero position
or duration mismatches):

```python
for src, dst in zip(orig_items, rebuilt_items):
    p = src.GetProperties()
    dst.SetProperties({k: p[k] for k in KEYS if k in p})
    src.CopyGrades([dst])      # ⚠️ NO-OP — see correction below
```

> ⚠️ **CORRECTED 2026-09-23 (evening): `CopyGrades()` does NOT copy clip grades across timelines
> on these multicam items.** Re-tested with the _destination_ timeline current and the Color page
> open: returns `True`, and `GetToolsInNode(1)` on the destination stays `None`. The luma
> improvement credited below came from the **`Scaling` property fix**, not from grades — the grade
> copy was never checked with `GetToolsInNode()`. Use **ColorTrace** for clip grades (§0 Step 5).
> The `SetProperties` part of this loop is still correct and necessary.

`KEYS` **must include the scaling keys** — `RetimeAndScalingEnabled`, `Scaling`,
`ResizeFilter`, `RetimeProcess`, `MotionEstimation` — as well as the transform/crop/dynamic-zoom
ones. Omitting `Scaling` alone left `orig=0` vs `rebuilt=2` and visibly reframed every
4096×2160 clip in a 3840×2160 timeline.

Verified: zoom/dynamic-zoom counts match the original exactly (ZoomX=3, DynamicZoom=8 in the
first 200), and mean luma went from **39 % off to 0.16 % off** (71.51 → 51.37 vs 51.45).

**`project.SetCurrentTimeline(dst)` IS MANDATORY.** Many of these APIs silently no-op when the
destination is not the current timeline — `SetSpeed()` returns False and does nothing;
`GetIsTrackEnabled()` lies; audio items expose 7 property keys instead of 15 (the
`[Active Timeline Only]` ones). Set it once at the top and re-assert after any timeline switch.

**The timeline-level grade DOES transfer** (corrected 2026-09-23) — via the Gallery, not CopyGrades:

```python
project.SetCurrentTimeline(src); resolve.OpenPage('color')
src.SetCurrentTimecode('00:00:20:00')
still = src.GrabStill()
album = project.GetGallery().GetCurrentStillAlbum()
album.ExportStills([still], dir, 'zz', 'drx')
project.SetCurrentTimeline(dst)
dst.GetNodeGraph().ApplyGradeFromDRX(dir + '/zz_1.4.1.drx', 0)   # 0 = no keyframes
album.DeleteStills([still])
```

Verified: rebuilt timeline graph went 0 → 1 node with tools
`['Primary Balance','Log Grade','Custom Curves']`, matching the original exactly.
**Caveat:** `GrabStill()` captures whichever graph the Color page is showing, and the
Clips/Timeline toggle is GUI-only and unreadable by script — so put the Color page in
**Timeline** mode once per rebuild first. One click, not one per clip.

### What FCPXML loses, and whether it can be restored

| Thing                                        | In the edit? | Survives FCPXML? | Restorable                                                                                          |
| -------------------------------------------- | ------------ | ---------------- | --------------------------------------------------------------------------------------------------- |
| Video + audio fades                          | yes          | **no**           | ✅ `GetFades`/`SetFades` (max is `duration−1`; a 239-frame fade on a 239-frame clip comes back 238) |
| Speed changes                                | 2            | partial          | ✅ `SetSpeed` with `RippleTimeline: False` — cuts stay put, linked audio follows automatically      |
| Timeline markers                             | 13           | **no**           | ✅ `GetMarkers`/`AddMarker` — exact                                                                 |
| Audio clip pan                               | yes          | **no**           | ✅ `SetProperties({'AudioPan': …})`                                                                 |
| Audio clip volume                            | yes          | yes (4 dp)       | —                                                                                                   |
| Audio crossfades                             | 12           | **no**           | ⚠️ `AddTransition` exists, **untested**                                                             |
| Timeline-level grade                         | 1 node       | **no**           | ✅ DRX route above                                                                                  |
| Fusion comps                                 | none here    | n/a              | ✅ Export/ImportFusionComp round-trips faithfully (tested with a Blur)                              |
| Colour versions                              | none here    | n/a              | ✅ per-version `AddVersion` + `LoadVersionByName` + `CopyGrades`                                    |
| Clip colour / flags / clip markers / enabled | none here    | n/a              | ✅ all round-trip                                                                                   |
| **Stabilisation**                            | unknowable   | —                | ❌ **no read API at all**                                                                           |
| ResolveFX on nodes                           | none here    | n/a              | likely rides along with `CopyGrades` (inferred, no positive control found)                          |

**Two property keys missing from the earlier list:** `LensCorrectionEnabled` (True on every clip
here) and `Distortion`. Add both. Note `SetProperties` validates all-or-nothing — one bad key
kills the whole dict, so keep video and audio dicts separate.

**⚠️ AUDIO IS NOT 1:1.** Video is 594 items index-for-index in both timelines. Audio is not:
`Timeline 1` has [7,9,25,8] items per track (36 clips + 12 transitions), the rebuild has
[7,8,7,7] = 29 clips, **and the tracks are reordered** (source A1 lands on rebuilt A3, A3→A2).
Any audio transfer must match by name + start frame, never by index — and seven audio clips
plus all twelve crossfades are simply missing. **This is the biggest open hole in the rebuild.**

**⚠️ Stabilisation is invisible to scripting.** The only API is `Stabilize()` — no getter, no
settings, no `Stabilization*` property key, no tracker object. You cannot detect whether a clip
is stabilised, so you cannot even count the manual work. Decide up front whether these edits use
it at all.

**⚠️ Never use `SetCDL`.** It is write-only (no `GetCDL`, so useless for copying) and
destructive — it permanently added `Saturation, Hue & Lum Mix` to a node, which survived a
project reload and which `CopyGrades` would not clear.

**Measurement trap:** Resolve caches rendered frames, so re-exporting a still after a change
returns the _old_ frame (PSNR identical to six decimals is the tell). Close and reopen the
project to flush, or use a timecode not previously visited.

### The original problem: FCPXML alone loses everything except cuts and angles

Measured on the first 100 V1 items, before the transfer step above:

|                      | original `Jumbo - Full Set` | after FCPXML round-trip                   |
| -------------------- | --------------------------- | ----------------------------------------- |
| ZoomX/ZoomY ≠ 1.0    | 3                           | **0**                                     |
| Dynamic Zoom enabled | 4                           | **0**                                     |
| grade                | present                     | **absent** (frame visibly flatter/cooler) |

So grades, transforms, dynamic zoom (and almost certainly stabilisation, ResolveFX and speed
changes) are dropped. ColorTrace can bring grades back; sizing/dynamic zoom would need a bulk
Paste Attributes pass, unverified. **Treat FCPXML as a rebuild, not a preservation path.**

### ✅ Reconform From Bins re-points an existing edit to the new multicam (clip only)

**Media Pool → right-click the timeline → Timelines → Reconform From Bins…**
(not the File or Timeline menu). Turn off **Conform Lock Enabled** on the clips first.
Dialog: Timeline Options (All Clips), Choose Conform Bins tree, Conform Options.
Settings that worked: **Timecode ✓ / Source timecode**, everything else off, and tick
**only** the bin holding the new multicam (untick Master — the old multicams share
01:00:00:00 and 3h36 and will match otherwise).

Result: **all 585 clips re-bound** to the trimmed multicam.

---

## 4. Gotchas that must be handled in any real run

1. **Angle names must match the original multicam's** (`Full Stage`, `Left Camera`,
   `Right Camera`, `Roving Camera`) or cuts can't resolve their angle and render **black**.
   Source clips carry `Angle = 'None'`, so set it: `SetMetadata({"Angle": "..."})` then build
   with `MULTICAM_ANGLE_NAME_ANGLE`. Tagging all ten CAM D clips the same groups them into
   one angle, matching the original structure.
2. **ffmpeg `-c copy` drops Blackmagic camera colour metadata.** `bt709` tags survive, but
   the BMD atoms don't, so a trimmed clip imports as `Rec.709 (Scene)` instead of
   `Blackmagic Design Film Gen 5` → washed-out log under YRGB Color Managed v2.
   Fix: `SetClipProperty("Input Color Space", "Blackmagic Design Film Gen 5")`.
   (`Input Gamma` refuses to set separately — returns False.)
3. **`SetClipProperty('Clip Name', ...)` returns `False` but works.** Don't trust the return.
4. **`SetClipProperty('Start TC', ...)` on a multicam returns `True` but does nothing** —
   a multicam's Start TC is derived from its angles. Set the angles' TC instead.
5. **FCPXML import always builds its own multicam** from the XML; it will not bind to an
   existing one. Use Reconform From Bins instead.
6. **`FlattenMulticam()` returns `None` via script** — appears to need UI selection.
7. **Media Management will not trim inside a multicam**: it reports New Size == Current Size
   (1.32 TB) because it treats the whole multicam as used.
8. `run_script` has a **10 s timeout** and blocks `import os`.

## 5. Tooling

- **BRAW trimming is SOLVED — use Resolve's own Media Management** (verified 2026-09-23).
  ffmpeg has no BRAW demuxer and `brawtool` has no trim, but Media Management trims BRAW
  losslessly _provided the timeline is not a multicam_:

  Build a plain timeline holding only that angle, trimmed to the band:
  `mp.CreateTimelineFromClips(name, [{"mediaPoolItem": clip, "startFrame": a, "endFrame": b}])`
  then **File → Media Management → Timelines → Copy → "Used media and trim keeping N frame
  handles"**. The dialog's size estimate is the tell: 389.8 GB → **5.05 GB** on a plain
  timeline, versus 1.32 TB → 1.32 TB on the multicam.

  Output verified: `Video Codec: Blackmagic RAW`, full 4096×2160, exact frame count
  (2 min + 2×48 handles = 2976 frames), correct Start TC, and
  `Input Color Space: Blackmagic Design Film Gen 5` **preserved**.

  Prefer this over ffmpeg for _all_ angles — Resolve keeps the Blackmagic camera metadata that
  `ffmpeg -c copy` silently drops, so the Input Color Space fix-up is then unnecessary.
  The SDK route (~100-line C++ CLI) is no longer needed.

### The rewriter tool

`tools/fcpxml_retarget.py` (+ `tools/test_fcpxml_retarget.py`, 61 stdlib tests, all passing).
Pure stdlib CLI; takes a JSON map of `asset → {path, start, duration, rate}` and rewrites the
angle assets. Flags: `--dry-run`, `--report`, `--verify`, `--allow-shortfall`, `--no-gap-fixup`.
An unmodified document round-trips **byte-for-byte identical** (it re-attaches the `<!DOCTYPE>`
that `xml.etree` drops and normalises self-closing tag spacing).

Structural gotchas it found in the real export — all of these bite anyone doing this by hand:

1. **`multicam/@tcStart = 3600/1s`.** `mc-clip/@start` is in the multicam's own timebase;
   `mc-angle` children are laid out from 0. Used range = `start − tcStart`. Get this wrong and
   every coverage check is off by exactly one hour.
2. **Explicit `<gap>` fillers must be re-timed.** Each angle is a contiguous run of
   `<gap>` + `<asset-clip>` at absolute offsets; moving a clip ~3000 s leaves a hole or overlap.
   Note CAM B ("Left Camera") starts at `offset="0/1s"` with _no_ gap and needs one created.
3. **Only ONE of the ten CAM D clips is used by the Jumbo edit** — all 174 video + 7 audio
   Roving cuts fall inside `C8670.MP4` (`21:04:44:06..21:32:56:17`). The other nine need not be
   trimmed or archived for this band at all.
4. **Mixed rates inside one angle:** CAM D asset-clips carry `start` on the 25 fps source grid
   but `duration` on the 24 fps multicam grid. Harmless here (neighbouring clips are unused) but
   it would matter if two _used_ 25 fps clips were ever adjacent.
5. **592 mc-clips, not 585** — 585 video plus 7 audio-only (`srcEnable="audio"`) nested on lane 2
   inside other mc-clips. Scan with `iter()`, not `findall`, or you miss them.
6. One `<timeMap>` exists, but on a nested `End Card.mov`, not on any mc-clip — so no multicam
   clip is retimed and the linear source-range mapping is safe. **Re-check this per band.**

Independent confirmation of the formula: the tool computes CAM A's required range as
`01:31:21:18..01:59:39:04`, exactly 2 s inside the Media-Management trim start of `01:31:19:18`
— i.e. the 48-frame handle, derived from a completely separate code path.

### The multicam letterbox fix (essential)

Angle clips declaring a format wider than the multicam's (CAM A/B/C are 4096×2160 in a
3840×2160 multicam) are **letterboxed** on FCPXML import — Resolve fits (scale 0.9375) where the
original crops. Every shot comes back smaller with black bars, and darker, because the wider
frame includes more dark surround.

Fix: set the existing `<adjust-transform>` inside each `<mc-angle>`'s `<asset-clip>` from
`scale="1 1"` to the fill/fit ratio:

```
fit  = min(Wmc/Wclip, Hmc/Hclip)     # 0.9375 here
fill = max(Wmc/Wclip, Hmc/Hclip)     # 1.0
scale = fill/fit                      # 1.0666667
```

CAM D (3840-wide) needs no correction. Note the asset-clips **already have** an
`<adjust-transform scale="1 1" …>`, so it must be _modified_, not added.

Measured effect on a 2400-frame A/B render: PSNR 21.58 → **26.43 dB**, SSIM(Y) 0.794 → **0.939**,
frames below 25 dB 1915 → **442**, frames at/above 40 dB → 350.

### mc-clip source in-points must be patched from the API (essential)

Resolve's FCPXML **export** writes wrong `start` values for some mc-clips. Measured on Jumbo:
163 of 585 wrong — one catastrophically (a retimed clip, out by **24,068 frames**) and 162 by ±1.
`SetSpeed` was wrongly suspected; a fresh import already has the bad value before any speed is set.

Fix: read the truth from the API on the original timeline, then set each `<mc-clip start>` to
`tcStart + frames/24 + 1/240`. **The `+1/240` epsilon (0.1 frame) is required** — Resolve
mis-rounds irreducible fractions (`182671/24s` imported as frame 96270, not 96271).

> ⚠️ **CORRECTED 2026-09-23 (evening).** This section originally said to take the truth from
> `GetSourceStartFrame()` and reported mismatches 585 → 0. That metric was misleading: it measured
> agreement of the _same wrong field_. Rendering proved **161 of 585 cuts were still one frame
> early**. The truth must come from **`GetSourceStartTime()`** — see §0 Step 3. Now built into
> `resolve_finish.py inpoints` + `fcpxml_retarget.py --inpoints`.

Note the 7 audio mc-clips are nested inside parent clips, so their `offset` is _relative_ and
they will not match an absolute-offset lookup. They are the A1 sync audio, which is disabled
anyway to mirror the solo.

### Measured end state (Jumbo, 2400-frame A/B render)

|                     | first attempt | + crop fix | + in-point fix |
| ------------------- | ------------- | ---------- | -------------- |
| PSNR avg            | 21.58         | 26.43      | **26.53**      |
| SSIM (Y)            | 0.794         | 0.939      | 0.927          |
| frames <25 dB       | 1915          | 442        | 444            |
| in-point mismatches | 163           | 163        | **0**          |

> ⚠️ **CORRECTED 2026-09-23 (evening).** The claim below that the rebuild was "structurally
> exact" was wrong. The "pervasive, unexplained" residual is now fully explained — missing clip
> grades, 161 cuts one frame early, and lost Dynamic Zoom. See §0 and "Rebuild fidelity".

Structurally the rebuild ~~is now exact~~ appeared exact by the checks then in use — in-points,
angles, speeds, positions, properties, audio content. **A pervasive 30–40 dB difference remained.** Ruled out: codec (both `apcn` ProRes 422 10-bit), temporal offset, angle selection,
transforms, source ranges. Re-declaring the angle format as the multicam's format is _worse_
(20.8 dB vs 31.2) — it stretches rather than crops, so the `scale=1.0666667` correction stands.

### Remaining known gaps after a full rebuild

- **Retimed clips.** The dominant residual error is the 80 % speed clip: frames 12304–12593
  (290 frames) are wrong. `SetSpeed` restores the percentage but not the exact source range
  (observed 1 frame short when tested in isolation).
- **Solo/mute.** The original has **A3 soloed** — which silences A1/A2/A4 in the render and is
  invisible to FCPXML _and_ to the API (no `GetIsTrackSoloed`). Without reproducing it the
  rebuild renders ~2× loud. Mirror it by disabling the clips on A1/A2/A4 (`SetClipEnabled`).
  Prefer mute over solo in the source project: solo is one click from silently changing a
  delivery and nothing records it.
- **Audio in-points.** 8 clips report a source in-point 1 frame earlier than the source. Passing
  a corrected `startFrame` does _not_ change it — Resolve derives it for clips adjacent to
  transitions. Harmless in practice: the rendered A3 audio is **bit-identical to the source
  Logic stem** (diff RMS 0.0), which is the check that matters.

### Measurement lessons (do not repeat)

- **Never A/B on lossy renders.** ProRes _Proxy_ carries AAC audio; comparing two independent
  AAC encodes sample-wise decorrelates the fine detail while levels and perception stay
  identical. Render **PCM** (`"AudioCodec": "lpcm"`) for any audio comparison.
- **`ExportVideo: True` can be silently ignored** if a previous audio-only job left the render
  preset in that state — the render completes and produces an audio-only file. Call
  `LoadRenderPreset(...)` first to reset it.
- Compare against the **source media**, not just original-vs-rebuild: that is what proved the
  rebuild correct and the original the outlier.
- A human listening for five seconds outperformed an hour of signal analysis.

### FCPXML surgery formula

The trimmed file keeps the camera's own timecode, so for each `<mc-angle>` asset:

```
new_start    = trimmed file's Start TC, in seconds
new_offset   = old_offset + (new_start − old_start)
new_duration = trimmed duration
```

Verified: CAM A old offset 483.792 + (5479.75 − 2496.917) = 3466.625 s, and the Jumbo band
starts at 3468.625 s — exactly the 2 s (48-frame) handle earlier. Leave every `angleID`
untouched.

- BRAW timecode does **not** need a file rewrite: `SetClipProperty("Start TC", ...)` works
  on `.braw` clips inside Resolve (project-level override, doesn't travel with the file).
- ffmpeg trim that works for `.mov`/`.mp4`, TC preserved exactly:
  `ffmpeg -ss <seek> -i SRC -t <dur> -c copy -timecode HH:MM:SS:FF OUT`
  (seek is from file start, **not** timecode: `seek = target_TC_seconds − file_start_TC_seconds`).
  ProRes is all-intra so copy-cuts are frame accurate; CAM D is long-GOP so cuts snap to
  the nearest keyframe (~1 s) — harmless inside handles.

## 6. Plan

**Backbone — proxies.** Full-length proxies of the four Melbourne angles (~25–50 GB) on the
Extreme SSD. Projects open, play and cut with the multicam intact and nothing relinked;
masters live on Drive and come back only for finishing. This alone frees the T7 Shield.

**Optional — per-band archive.** The full pipeline is now mapped:

1. Trim each angle to band + handles (ffmpeg for `.mov`/`.mp4`; **BRAW SDK trim** for `.braw`
   — the one missing tool)
2. **Rewrite the exported FCPXML**: point each `<mc-angle>`'s `<media-rep src=…>` at the trimmed
   file and adjust that asset's `start`/`duration`; leave `offset` (position within the multicam)
   and **every `angleID` untouched** — that is what preserves the 585 angle selections
3. Import the modified FCPXML → new multicam built from trimmed media, full edit, angles intact
4. `SetClipProperty("Input Color Space", "Blackmagic Design Film Gen 5")` on the trimmed clips
5. **ColorTrace** from the original timeline to restore grades

Do _not_ attempt this via ReplaceClip or Reconform From Bins; both lose the angle selections.
Worth only ~25 % space, so decide after the proxies are done.

Sequence:

1. Generate proxies for the 4 Melbourne angles (long GPU job, overnight)
2. Verify Melbourne projects render from proxies with masters offline
3. MD5-verify the Melbourne masters already on Drive (`rclone check`)
4. Wipe the T7 Shield → Sydney 2026 travel disk
5. Drive reorg into `events/<year>/<city>/` (metadata-only `rclone moveto`, no re-upload)
6. Upload Sydney 2025 (457 G) + Brisbane 2025 (132 G) from the Extreme SSD copies
7. Business Plus upgrade, then back up Brisbane 2026's 661 G

**Renders/proxies/cache are transient** (YouTube 4K is the distribution archive) — but keep the
final delivery render per event on Drive (~50 GB), because Content ID claims on cover songs
make YouTube an unreliable archive of record.

---

## 7. State of play (2026-09-25)

**Jumbo is done.** Project **`Mel BOTTB 26 - Jumbo - Full Set`** (formerly the scratch project
`ZZ FINAL`) holds exactly two timelines:

- **`JUMBO FINAL`** — the rebuild on trimmed media (`/Volumes/BOTTB/_JUMBO_TRIM2`, 183 GiB).
  Verified against the original master render over a 100 s window: 2258/2400 frames bit-identical,
  the rest the 2 Dynamic Zoom cuts in the window at 57–69 dB. All structural checks pass.
- **`Timeline 1`** — copy of the original edit on the original masters; the reference for
  `verify`/ColorTrace/`dynzoom`. Goes offline once the masters are archived; delete it then.
  Its 66 Dynamic Zoom cuts, and the rebuild's, are clip-coloured **Orange**.

The real project `Jumbo - Full Set` was never modified.

Cleaned up 2026-09-25 with Dean's OK: `_JUMBO_TRIM` (superseded trim), `_TCTEST`, all test renders,
and the `ZZ E2E` / `ZZ TC A` / `ZZ TRIM JUMBO` projects — BOTTB 458 → 733 GiB free.
`/Volumes/BOTTB/_RENDER_AB` keeps only `V2_ORIG.mov` (the 12000–14399 reference render, needed
for any re-verification) and the two Darkness renders (until the social post is confirmed).

Next: the same pipeline for OUA, REA, SEEK and Mentorloop — §0 end to end.

## 8. Archive & disk consolidation — agreed plan (2026-09-27)

Per-band rebuilds are paused (Jumbo + OUA trims kept). Drive is now **Business Plus, 5 TiB
(3.6 TiB free on 2026-09-27)** — everything fits.

**End state:** T7 Shield wiped → Sydney 2026 travel disk. **BOTTB = the one media disk** (all
video + all renders; Brisbane 2026 paths untouched so the edit keeps working). Extreme SSD =
audio/Logic production + non-BOTTB; finished events Drive-only there. The 4th 2 TB disk
(Time Machine / External SSD / External Storage) and Supp1Tb are Dean's personal — out of scope.

**Tool:** `~/bin/bottb-archive.sh start <jobfile>` (lines `local|remote`), `status`, `log`, `stop`.
Serial rclone copy (2 transfers, 256M chunks, ~0.6 GB RSS), sleeps 3 h on the 750 GB/day cap,
then `rclone check --one-way` (MD5) per folder. Log `~/bottb-archive.log`. Job files in
`doc/archive-jobs/`.

Sequence:

1. Upload + verify: **(a) Brisbane 2026 raw** (`01-brisbane-2026-raw.txt`: Footage 660 G →
   `events/2026/Brisbane/01_Media/Video`, Zoom audio 12 G, BOTTB@Triffid 57 G) — started
   2026-09-27 17:42, ~10 MiB/s; (b) Sydney 2025 457 G from Extreme; (c) rest of Extreme `bottb/`
   (~900 G, skip `03_Cache`).
2. MD5-check Melbourne masters on Drive vs T7 Shield (local read only).
3. Drive reorg: loose top-level folders → `events/<year>/<city>/`; fix `01_media`/`01_Media` case.
4. Wipe T7 Shield (needs 1+2 passed and Dean's yes). Melbourne masters then Drive-only;
   REA/SEEK/Mentorloop rebuilds later mean a 1.2 T download.
5. BOTTB tidy: delete listed test/scratch renders (Dean's OK), move delivery renders from Extreme
   into `Renders/<year>/<city>/`; then clear Drive-verified events off the Extreme SSD.

**Status 2026-09-30:** Brisbane 2026 raw (Footage 660 G, Zoom, Triffid) and Sydney 2025 uploaded
and MD5-verified. Melbourne masters verified (106/106). T7 Shield fully verified against Drive
(Melbourne Video + Sydney Footage/Stereo Audio/.drp, 94/94). **Wipe deferred by Dean to the last
minute before Sydney 2026** — erase as exFAT `BOTTB SYD26` then. Job `03-extreme-rest.txt`
(~875 G) running. Hub unplugs drop the disks mid-upload; the script retries every 3 h.

**Status 2026-10-06:** all archive jobs done and verified (2026-10-04, incl. `04-recreate-sources.txt`
and `_resolve/Resolve Projects`). **T7 Shield wiped** with Dean's yes: erased as exFAT/GPT `BOTTB SYD26`
(1.8 TiB free) — the Sydney 2026 travel disk. Melbourne 2026 raw and Sydney 2025 are now Drive-only
there (Sydney 2025 also still on Extreme SSD). exFAT to match BOTTB and Extreme SSD; no journal, so
eject cleanly rather than pulling it.

---

## SOLVED: the rebuilt timeline renders darker/redder — missing per-cut clip grades (2026-09-23)

**Cause: the original has TWO grade layers and the rebuild only had one.**

| layer                           | Timeline 1                                         | REBUILT_V2                                |
| ------------------------------- | -------------------------------------------------- | ----------------------------------------- |
| clip grade (per cut, 585 items) | `Primary Balance` + `Custom Curves` on **all 585** | **empty on all 585**                      |
| timeline grade (`pTrackVer`)    | `Primary Balance`, `Log Grade`, `Custom Curves`    | same (restored from `tlgrade_1.98.1.drx`) |

Clip-grade tool histogram on Timeline 1 (585 cuts):
`566 x [Primary Balance, Custom Curves]`, `11 x [Custom Curves]`,
`5 x [Primary Balance, Saturation Hue & Lum Mix, Custom Curves]`,
`2 x [Primary Balance, Custom Curves, Hue vs Sat Curve]`, `1 x [Primary Balance, Hue vs Lum Curve]`.

`Primary Balance` is per-shot white-balance/exposure matching, which is why Dean saw it
**per camera**: Full Stage (A) and Right (C) were close to neutral and looked fine, Left (B)
and Roving (D) carried the real corrections and looked wrong.

### What this rules out (all measured, do not re-test)

- **Media is not involved.** CAM D's "trimmed" `C8670.MP4` is **byte-identical** to the original
  (same size 30,803,729,695, same MD5 of first 64 MB, same Start TC 21:04:44:06, same 42312
  frames) — Media Management copied it whole. Yet D still looked wrong. So the trim cannot be
  the cause for any camera.
- **Clip properties identical** orig vs trim on all four cameras — only `Date Added`,
  `Slate TC`, `Usage` differ. ICS and Input Gamma match exactly
  (A/B/C = Blackmagic Design Film Gen 5; D = S-Gamut3.Cine/S-Log3 + Gamma 2.4).
- **ffprobe colour tags identical** orig vs trim (C: prores/tv/bt709; D: h264/pc/unknown).
- **All 158 timeline settings identical** between Timeline 1 and REBUILT_V2.
- **Not temporal.** Wide search ±360 frames on a Left Camera frame: best match at offset **0**
  with symmetric falloff. The gap-anomaly theory for B and D is dead.
- **Item alignment is exact**: 585 items, identical start/end/name, 0 mismatches.

### Measurement lesson (cost hours)

`Graph.GetNumNodes()` returns **1 for an ungraded node** — node count is NOT a test for whether
a grade exists. Both timelines showed `{1: 585}` and no node labels, which looked like a match.
The real test is **`Graph.GetToolsInNode(n)`**, which returns `None`/`[]` when the node is empty
and the actual tool list when it is graded. Equivalently, grab a still and read
`<HasCorrection>` in the exported `.drx` — `pClipFullVer` is the clip grade, `pTrackVer` the
timeline grade.

### API gotchas found here

- **`TimelineItem.CopyGrades()` does not work across timelines.** It returns `True` 585/585 and
  copies nothing; the destination's `GetToolsInNode(1)` stays `None`. Tried with the Color page
  open and with either timeline current. Only the timeline-level layer was touched.
- `MediaPoolItem` has **no** `GetVersionNameList` / grade introspection at all (it is on
  `TimelineItem` only).
- The `run_script` sandbox blocks `import os` — create directories from the shell instead.
- **`Graph.ApplyGradeFromDRX()` CRASHED Resolve 21.1** (2026-09-23). A single call on one 4K
  multicam timeline item never returned: Resolve dropped to 0% CPU, every subsequent
  scripting call hung, and the app then died. Do not use it on multicam items, and never
  loop it. This is why the DRX route is abandoned in favour of Reconform From Bins.

### Fix: ColorTrace (NOT Reconform)

**A duplicate-Timeline-1 + Reconform route does not work** — verified 2026-09-23 by exporting
both multicams to FCPXML and diffing `<mc-angle angleID=…>`: **0 of 4 angle UUIDs match.**

```
ORIGINAL                                 TRIMMED (FCPXML-built)
0e5c29f9-9dc5-41e7-89b2-9cae8ea93a23     fd393cd3-3f38-44d2-a200-3d22af082da1   Full Stage
bf06adde-3f55-4801-b097-3507bba19903     90c17dd5-6e60-4e1d-8cba-2495a074b9c7   Left Camera
de3b7286-5aca-4f0a-96ca-0518776908b7     a73b1f9c-e529-4d52-ab15-b1f6b573e78b   Right Camera
03db14e2-fdc9-4962-b124-2b73ef6514ea     1d9c337f-25e5-459c-abc0-069d9a0f98d8   Roving Camera
```

**Resolve regenerates angle UUIDs on FCPXML import even though the XML carries the originals.**
So reconforming a grade-bearing duplicate of Timeline 1 onto the trimmed multicam would keep the
grades but silently drop all 585 angle selections. Each route loses exactly half:

| route               | cuts | angles | media | grades |
| ------------------- | ---- | ------ | ----- | ------ |
| FCPXML import       | ✅   | ✅     | ✅    | ❌     |
| Reconform From Bins | ✅   | ❌     | ✅    | ✅     |

**The working pipeline is FCPXML for structure + ColorTrace for grades:**

1. FCPXML retarget → rebuilt timeline with correct cuts, angles and trimmed media (done).
2. Timeline-level grade: grab a still from the source timeline, apply the `.drx` to the target
   timeline's node graph (done — `tlgrade_1.98.1.drx`).
3. Clip grades (585): **Media Pool → right-click the target timeline → Timelines → ColorTrace →
   ColorTrace From Timeline…**, source = `Timeline 1`. Automatic mode matches on source timecode
   - filename, both of which the trim preserves by design. One operation, not 585.

ColorTrace is UI-only — nothing matching `Conform`/`ColorTrace` exists in the scripting API.

## Rebuild fidelity: measured root causes (2026-09-23, evening)

### The measurement method that finally worked

1. **Control render first.** Re-render the SOURCE timeline over the same range and PSNR it
   against the earlier render of itself. Result: **2400/2400 frames bit-identical, PSNR `inf`.**
   Resolve's renderer is fully deterministic, so there is no noise floor and every differing
   frame is a real difference. (File _sizes_ still differ — container metadata — so never use
   file size as a comparison.)
2. **Per-frame PSNR with `stats_file`**, not just the summary. `identical(inf)` count is the
   headline number. Map differing frames back to timeline items and correlate against item
   properties. Beware: print ALL runs — truncating the run list to the first 25 caused items
   past frame 13600 to be misclassified as OK.
3. **Bypass the clip grades on both sides** (`Graph.SetNodeEnabled(1, False)`) to separate
   "grade differs" from "image differs". This is what proved the residual was not the grade.
4. `ffmpeg -v error` **suppresses the PSNR summary** (it prints at info level). Use `-hide_banner`
   and keep info. Always `-nostdin` inside shell loops.

### ColorTrace restores the clip grades — and its checkboxes do not matter

**Media Pool → right-click target timeline → Timelines → ColorTrace → ColorTrace From Timeline…**
Automatic mode matched on source TC + name; the Property table showed exact SRC/REC agreement.

Bit-identical frames out of 2400, same 100 s window:

| run                   | options                                | identical |
| --------------------- | -------------------------------------- | --------- |
| no clip grades at all | —                                      | **0**     |
| FINAL V1              | Color only                             | **1262**  |
| FINAL V2              | + Version Camera Raw Settings          | **1262**  |
| FINAL V3              | + Sizing + Input Sizing (all defaults) | **1262**  |

All three runs produced **byte-identical PSNR figures**. Version Camera Raw, Sizing and Input
Sizing are all no-ops here. 7/585 cuts get a mismatched tool set every time (adjacent-pair swaps),
which is a ColorTrace tie-break artefact.

**Do not** chase the residual through ColorTrace options — it cannot fix what remains.

### The residual has three causes, all measured

| cause                               | scale                                                                                                                   | evidence                                                                                                                                                                                                                                                 |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **source in-point off by −1 frame** | **160 / 585 cuts** (27.4 %) — first counted as 161, but one was the retimed cut, where `GetLeftOffset()` is meaningless | every cut with `GetLeftOffset()` delta −1 renders **100 %** differently (12/12 in the sample window); every cut with delta 0 and no other cause is **bit-identical**                                                                                     |
| **Dynamic Zoom lost**               | **66 / 585 cuts**                                                                                                       | `DynamicZoomEnabled=True` on the two delta-0 cuts that still differ 100 %; framing visibly wider in the rebuild (the move is gone). The _flag_ survives FCPXML and ColorTrace; the **rects/keyframes do not**, and `GetProperty()` exposes only the flag |
| **Roving 25→24 fps cadence**        | ~7–16 % of frames within Roving cuts                                                                                    | Roving cuts with delta 0 differ on a small, regularly spaced minority of frames                                                                                                                                                                          |

Per angle, cuts with in-point off by −1: Full Stage 62/221, Right 43/120, Roving 45/174,
Left 11/70.

**The −1 is a bug in `fcpxml_retarget.py`, not in Resolve.** The earlier `+1/240` epsilon fixed
_angle selection_ (585 mismatches → 0) but the **in-point conversion still floors instead of
rounding to nearest**, so 27.5 % of cuts start one frame early. Fix that and the bulk of the
residual goes.

### Dead ends — measured and disproven, do not repeat

- **Not the media.** CAM D's trimmed `C8670.MP4` is byte-identical to the original (same size,
  same MD5, same Start TC, same 42312 frames) yet still rendered differently.
- **Not clip properties, ICS or Input Gamma** — identical on all four cameras.
- **Not the 158 timeline settings** — zero differences.
- **Not timeline-item properties** — zero differences across all 585 items, all 32 properties.
- **Not a temporal offset of the whole timeline** — ±360 frame search peaks at offset 0.
- **Not a spatial shift** — ±32 px search gives a 0.8 dB bump at best; a real misalignment
  would spike far higher.
- **Not the DRX body.** A clip that renders **bit-identically** still has a different
  `<Body>` blob, so DRX bodies cannot be compared for grade equality. `GetToolsInNode()` is the
  usable test, and even it compares only the tool _set_, never the values.
