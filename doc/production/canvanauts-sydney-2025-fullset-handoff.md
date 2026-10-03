# Handoff: Canvanauts (Canva) full set, Sydney 2025: audio and video, as done for Google

From bottb-48 (video editor), 2026-10-03, at Dean's request. Same job as the Google / The Incident
Commanders full set: a finished 4K full-set video for YouTube. **Read first:** the `live-video-editor`
skill, then `video-post-learnings.md` sections **"Sydney 2025 full sets: Google / The Incident
Commanders"** (every step and trap from the last run, in order) and **"Reels from other shows:
Sydney 2025 Canvanauts 'Anti-hero'"** (this band's cameras, sync and grade). Do not re-derive them.

## What is different this time (Dean, 2026-10-03)

1. **Part of the set exists only on the "ambient mics"**: those sections must be level-matched to the
   desk sections at a minimum (loudness), ideally tone-matched too, with crossfades at the joins.
2. **One song is already mixed and mastered: Anti-Hero (Taylor Swift cover), and "it's a different
   version"**: check what that means before using it (below).
   (Corrected 2026-10-03, Dean to bottb-b2: "anti-hero is an as covered by version. It's the only song
   that's been fully mixed and mastered." "Different version" means **a cover**, not a different take or
   edit: same performance. Still confirm placement with `align-mix`; expect `different_version` from the
   processing and trust `placed`.)

## Known facts (measured 2026-10-03; verify before relying on them)

- **Resolve projects:** `Canvanauts` (the full set), `Canvanauts - Anti-hero`, `Canvanauts - Anti-hero -
Reel`, `Canvanauts - Interview`. Both of the first two reference only
  `/Volumes/Extreme SSD/Audio/Sydney/Canvanauts/Canvanauts.wav` (an old path; the file now lives in
  `bottb/_TO_SORT_Audio/Sydney/Canvanauts/`).
- **Cameras/multicam** (from the reel): Video 1 = Audience A7S III `luca_1`, 2 = Wide A7S III `luca_2`,
  3 = Chase FX6 `.MXF`. The FX6 clip 0004 carries a ~0.03 black pedestal (the camera-match LUT on a "Chase FX6"
  group fixed it on the reel); Google's clip 0007 did not. Measure. The Wide's room audio lags the desk by
  81 ms. Canon `MVI_*` stills-camera inserts exist (MVI_0208 on the reel). Check whether the full-set
  project is RCM v2 like the reel or unmanaged like Google.
- **Audio, `bottb/_TO_SORT_Audio/Sydney/Canvanauts/`:** `Canvanauts.wav`, a Logic bounce, 48 kHz stereo,
  1292.74 s (21:33), BWF time_reference 172800000 = 01:00:00:00 (the multicam start), from `Project.logicx`,
  whose media is `DLIVE003.WAV` + `BotB-001_01–04.wav` + `Canvanauts.wav`.
  - **`DLIVE003.WAV` (dLive desk 2-track) is only 671.84 s (11:12)**, roughly half the set. The rest is
    on `BotB-001`.
  - **`BotB-001.WAV`** (`/Volumes/Battle Of Band 2025/Stereo Audio/`) is 4-channel 48 kHz, 7443.7 s,
    first half of the night. **Verify what each channel is before calling it "ambient":** on the Google
    set the mixdown session found `BotB-002_*` were copies of the desk L/R (r 0.99–1.00 below 1 kHz) on a
    clock drifting −13.2 ppm. That drift matters across a 21-minute splice.
- **Mixed Anti-Hero:** there is no standalone mastered WAV; the mixed audio is inside
  `bottb/_TO_SORT_Video/Canvanauts/Canvanauts - Anti-hero (4k).mp4` (2025 delivery) and the 2026 reel.
  "Different version" may mean a different mix of the same performance, or a different edit or take. Test
  it with `mix-analyser align-mix` (reading `same_mix` / `different_version`) against the desk audio for
  that song. If the performance or timing differs, ask Dean before using it; don't force-fit it.
- **DB setlist** (`canvanauts-sydney-2025`): Are You Gonna Be My Girl (Jet), Anti-Hero (Taylor Swift),
  Valerie (Amy Winehouse), I'm Still Standing (Elton John), Don't Stop Me Now (Queen). **The Google DB
  order was wrong for the played order**: confirm the order and first notes with Dean by ear, one
  slot at a time.

## The pipeline (each step has a runbook entry from the Google run)

1. **Audio → the mixdown session** (`cd ~/src/personal/mix-assist && claude --agent mixdown`; brief it the
   way `google-sydney-2025-fullset-mix-brief.md` does). Never plan Logic steps for Dean yourself. The ask:
   one mastered full-set WAV, ~−14 LUFS / −1.0 dBTP, BWF-stamped on the same clock, with the ambient-only
   sections level/tone-matched to the desk sections.
2. **Placement:** the master on its **own named audio track**, never swapped inside the multicam.
   Verify with a short render (r and frame residual).
3. **Chapters:** Mint `CH Canvanauts <n> <song>` markers at Dean's first notes.
4. **Titles:** song cards via `generate-song-overlays.ts` (it numbers in DB order: rename by played order).
   Filmic opening and credits via `generate-set-titles.ts --style filmic --no-members` (**branch
   `feat/filmic-set-titles`, commit 5048f45, not merged to main yet**: ask Dean). Titles and end card on
   their own track; the end card needs Additive composite.
5. **Grade:** gigstills cut-recipe. The measurement render must have **title tracks and any look Adjustment
   Clip OFF**. Check every target clip's node graph before `SetCDL`. Crowd shots crush under a contrasty look:
   the per-cut pre-look lift (Offset with white held + Power) fixed it on Google.
6. **Look:** the FLC on an **Adjustment Clip** below the titles (keeps halation off them; the API cannot see
   its grade, so verify on renders). First check **Resolve's cache location is external** (it filled the
   boot disk on 2026-10-03).
7. **Delivery:** Orange-mark zoomed cuts, `superscale.py` (now covers `.MXF`) 2 → Dean RiPs to `/Volumes/BOTTB`
   → Super Scale 1 → 4K H.264 ~45 Mb/s + AAC 320 from Dean's In/Out (the render clears In/Out: restore from the
   RELEASE marker) → `render-qc.sh` → 1080p via ffmpeg (`-c:a copy`) → one-message handover to the Social agent.

## Disk state at handoff

Extreme SSD 246 GB free, BOTTB ~510 GB free, boot ~90 GB. The Drive archive (`04-recreate-sources.txt`) is
running in the background (rclone, ~0.6 GB). It is not yours to stop.
