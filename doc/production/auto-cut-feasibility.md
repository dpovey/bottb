# Automated / assisted rough cutting for live music — feasibility

Written 2026-09-11, BOTTB Brisbane 2026, DaVinci Resolve Studio 21.1. Companion to
`video-post-learnings.md` (Resolve operations) and `logic-cli-feasibility.md` (the audio side's
equivalent study).

**Verdict up front.** Resolve 21.1's AI Multicam SmartSwitch is not usable for a band — not
because it is badly tuned, but because it optimises for a different thing. A _music-aware rough
cut assistant_ built from tools we already have is feasible and worth considering; a fully
autonomous cutter is not. The cheapest high-value component is a shot-transition model fitted
to Dean's own cut list, which needs no new capture and no model training.

## Multicam SmartSwitch, evaluated

### What it is

Studio-only, new in the Resolve 21 line (`TimelineItem.PerformMulticamSmartSwitch` is a 21.1
scripting addition; the UI feature may predate it — the changelog the MCP server serves has no
21.1 entry at all). The manual is explicit about the objective:

> "automatically cuts to the most appropriate angle, **based on who is the active speaker**…
> it also includes other video-related traits such as **lip movement** in the frame"

Plus "use wide angle for **silence**" and wide coverage for "people talking over each other".
It is an interview/panel tool.

### The pilot

Non-destructive method, worth reusing: `PerformMulticamSmartSwitch` acts on a **single**
multicam TimelineItem, so it cannot re-cut an already-cut range (Jumbo is 203 items). Instead
build a separate timeline holding one uncut multicam item over the span, via
`MediaPool.CreateEmptyTimeline` + `AppendToTimeline` with `startFrame`/`endFrame`/`recordFrame`
set to the master timeline's own frames — the TCs then line up for comparison and the real cut
is never touched.

Pilot span: Chelsea Dagger, 02:24:07:06 → 02:28:42:06 (6,874 frames, 4:35). Settings were
Resolve's defaults (see "what was rejected" below).

|                     | AI SmartSwitch | Dean rough cut |
| ------------------- | -------------: | -------------: |
| shots               |             46 |             27 |
| median shot         |          4.8 s |          7.9 s |
| mean shot           |          6.0 s |         11.0 s |
| shortest            |          1.0 s |          2.1 s |
| longest             |         30.3 s |         31.9 s |
| shots under 2 s     |             10 |              0 |
| CAM A (roaming)     |            39% |            48% |
| CAM B (stage left)  |            46% |         **0%** |
| CAM C (stage right) |            13% |         **0%** |
| CAM D (wide)        |         **2%** |            52% |

### Why it fails here, and why tuning won't fix it

`minEditDuration` would remove the ten sub-2-second shots. Nothing in the settings changes the
angle distribution, which is the actual problem: the model hunts faces and lip movement, so on
a band it lives on whichever camera frames the singer's mouth. Dean's grammar is wide-led (52%
CAM D); SmartSwitch essentially abandoned the wide (2%) and spent 59% on the two static side
cameras that Dean did not use at all in this song. Different objective, not different
parameters.

Worth noting the one place it was _closer_ to professional practice than the rough cut: pace.
See the 3.61 s figure in the literature section.

### Operational gotchas found

- **`switchOnVideoOnly: True` is rejected outright** on this material — returns `False` in
  0.0 s. The API doc says "not supported in adaptive/source mode", and the BOTTB multicam is a
  source-audio multicam. So SmartSwitch will always cut audio along with video; on a pilot
  timeline that is harmless, on a real one it is not.
- **`run_script` has a hard 10-second timeout.** SmartSwitch is synchronous and blocks, so the
  script is killed while Resolve carries on running the analysis regardless. Do not read a
  timeout as a failure; poll the timeline item count instead.
- **Analysis speed was 5 fps** for 4 angles. That is ~20 min for 4:35 — extrapolating, ~2 h for
  the full Jumbo set and ~16 h for the whole show. Budget accordingly.
- **"Use Audio Only Fast Analysis"** (`analysisMode:
SMART_SWITCH_ANALYSIS_MODE_AUDIO_ONLY`) is the documented speed lever — "runs much faster and
  is only available in certain modes". Untested here.
- Pilot timelines built at master TC have hours of empty track before the content; the playhead
  lands at the end of the appended clip, so the viewer shows black. Move the playhead to the
  clip start and place `BOTTB_reference_48k.wav` at frame 0 on an audio track (it is
  picture-true) or the cut cannot be judged against the music at all.

## Proxies do not accelerate analysis

Checked against the full 21.1 manual: there is **not one co-occurrence** of proxy or optimized
media with analysis anywhere in the document. Proxy handling is documented exclusively as a
_playback_ optimisation — every option is worded "for playback", and the Deliver page "always
reverts proxies to the original source media" unless overridden. The chapter comparing proxies
against Timeline Proxy Mode, Render Cache and Optimized Media frames all four as real-time
playback aids.

So do not expect Prefer Proxies to speed up SmartSwitch, Magic Mask, or any other analysis
pass. (An earlier suggestion in this session that it might was unfounded; recorded here so it
is not repeated.)

Two proxy facts worth keeping anyway:

- **Deliver › Advanced Settings › "Use proxy media"** overrides the revert-to-originals default.
  Useful for social reels and dailies where master quality is not needed.
- **Unlink Proxy Media does not delete the file** — manual deletion outside Resolve only. Given
  proxies filled a 1.8 TB SSD twice on this project, that matters.

## Feasibility of an assisted rough cut

### What already exists

| Piece                                        | Where                                                    | State                                                                                      |
| -------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Per-frame face detect, size / position / lit | gigstills `scoring.py` (OpenCV YuNet)                    | working; 2,875 candidates scored on CAM A                                                  |
| Localised subject blur / smear               | gigstills `blur.py`                                      | working, deliberately face-weighted                                                        |
| Stable-segment detection                     | gigstills `stability.py`, `segments.py`, `docs/shots.md` | working, already designed for Resolve marker handover                                      |
| CLIP embeddings per frame                    | gigstills `ClipScorer`                                   | working, cached in `embeddings.npz`                                                        |
| Picture-true reference audio                 | `BOTTB_reference_48k.wav`                                | 0–5 ms against picture                                                                     |
| Per-song tempo / beat maps                   | logic-cli, mix-assist                                    | exists per band                                                                            |
| **Isolated per-mic desk stems**              | `01_Media/<Band>/`                                       | the key asset — see below                                                                  |
| ~1,329 of Dean's own cut decisions           | master timeline V1                                       | exportable; Jumbo's 203 saved at `/Volumes/BOTTB/CutLists/jumbo_rough_cut_2026-09-11.json` |

### The central idea: solve "who is singing" in audio, not vision

SmartSwitch struggles with active-speaker detection because it infers it from pixels. We have
the answer already: **individual vocal mic channels in the desk stems**. Gating each vocal
channel gives, frame-accurately and with no vision at all, which singer is live at any moment —
including overlaps and harmonies, which is exactly where lip-movement models break down. The
same trick extends to solos: the guitar DI says when to be on the guitarist.

This converts the hardest part of the problem into an RMS-per-channel measurement on material
that is already built and already time-aligned.

### Who is where

CAM B / C / D are locked off, so performer position is constant per camera per set. A one-time
manual labelling pass ("the drummer is this rect in CAM D") gives a persistent map. Combined
with audio gating, "cut to the drummer" becomes a punched-in **region of the wide** — which is
the existing Super Scale + Render in Place path, and is also how the static cameras are kept
moving.

### When to cut

Craft practice and the research agree: cut on the beat, and prefer musical boundaries — bar
lines, section changes, fills. Tempo maps exist, so quantising candidate cut points to the
nearest beat or bar is cheap, and is probably the highest value per unit of effort in the whole
idea.

### The hard constraint: camera moves

`TimelineItemProperties` in 21.1 exposes `ZoomX`, `Pan`, `DynamicZoomEase` and — new in 21.1,
correcting the note in `video-post-learnings.md` — **`DynamicZoomEnabled`**. But there is still
**no access to the dynamic zoom start/end rectangles**, and no general sizing-keyframe API
(keyframes exist only for colour and stereo convergence).

So a generated rough cut can place cuts, choose angles and set _static_ framing. It cannot
define a move. Every dynamic zoom or pan stays manual, or goes via Fusion. Design around this.

### Learning from manual adjustments

Feasible, with a caveat about scale. ~1,329 decisions is a useful labelled set for a **ranking
model over engineered features** — the features gigstills already emits, plus the audio-derived
"who is live" — and every correction pass adds more. It is nowhere near enough to train
anything end to end. The honest framing: learn _the weighting_ of features already defined, not
learn to cut from scratch.

Methodological warning, and it is gigstills' own rule: _"aggregate statistics looked correct for
all three wrong versions of the exposure metric."_ Any cut-quality metric must be judged on a
montage, not on a score.

## Literature

The genre matters — most automated-editing work is on classical concerts or user-generated
mobile footage, and their objectives differ from a professionally-shot rock set.

- **[Learning to Visualize Music Through Shot Sequence for Automatic Concert Video Mashup](https://ieeexplore.ieee.org/document/9122392/)**
  (IEEE TMM 2021). The most relevant. Dataset is **70 official concert videos, 61 live concerts,
  44 singers, 11 genres** — professionally shot pop/rock. Takeaways:
  - **Eight shot classes**: CU, MCU, MS, MLS, LS, XLS, plus **Audience Shot (ADS)** and
    **Musical Instrument Shot (MIS)**. MIS is the "here is the drummer" idea, already a
    category.
  - **Average shot duration 3.61 s**, minimum ~1 s, measured over professionally-directed
    concert video. For comparison: Dean's Jumbo rough cut is 7.9 s median, SmartSwitch produced
    4.8 s. (Mean-vs-median and single-song-vs-full-set caveats apply, but broadcast concert
    grammar appears to cut roughly twice as fast as our rough pass.)
  - The **"film-language model" is a bigram over shot types**, `P(s_t | s_{t-1})`. This is the
    most transferable idea in the literature and can be fitted from our own cut list — angle
    plus zoom level maps onto shot scale (CAM D wide = LS/XLS, CAM A punched in = MCU/CU).
  - Multi-resolution timing at **1 s / 2 s / 4 s** music frames (local detail, phrase, section),
    fused by entropy — a structural idea that does not require their network.
  - Music features are **188 auto-tagger outputs over log-mel**, not onsets: shot _scale_ is
    driven by timbre/genre, not by beats.
- **[Learning From Music to Visual Storytelling of Shots: A Deep Interactive Learning Mechanism](https://dl.acm.org/doi/10.1145/3394171.3413985)**
  (ACM MM 2020, same group) — the "improve from manual corrections" question as a research
  problem.
- **[When and How to Cut Classical Concerts?](https://arxiv.org/abs/2510.05661)** (arXiv
  2510.05661, 2025) — decomposes into _when to cut_ (temporal segmentation from log-mel
  spectrograms plus scalar temporal features, convolutional-transformer) and _how to cut_ (shot
  selection via a **CLIP-based encoder**, replacing older ResNet backbones). We already compute
  CLIP embeddings, so gigstills is incidentally aligned with the current approach.
- **[Automatic mashup generation from multiple-camera concert recordings](https://disco.ethz.ch/courses/fs11/seminar/paper/samuel-2-2.pdf)**
  (ACM MM 2010, free PDF) — the original pop/rock multi-cam formulation; source of the
  quality / diversity / cut-point-suitability objective.
- **[MoViMash](https://dl.acm.org/doi/10.1145/2393347.2393373)** (ACM MM 2012) — shot-transition
  smoothness and view diversity; the anti-parking-on-one-camera term.
- Craft side: [multi-camera live direction tips](https://www.premiumbeat.com/blog/multi-camera-direction-tips-live-concert/),
  [An Editor's Guide, Appendix A: Multicamera Editing](https://www.oreilly.com/library/view/an-editors-guide/9780132736145/apa.html).
  Consistent advice: cut to the beat; avoid straight-cutting or dissolving between similar
  framings on different cameras.

## What to settle before building anything

Nothing here is built, and nothing should be until these are answered:

1. **Does beat-quantised cutting actually feel right on this material?** Testable in an
   afternoon by snapping the existing Jumbo cut points to the nearest beat and watching the
   difference.
2. **Does the static-camera punch-in hold up at 4K after Super Scale?** If not, half the
   proposed shot vocabulary disappears and the MIS/drummer idea goes with it.
3. **The shot-transition bigram**, fitted from the existing cut list and tested against a
   held-out set of Dean's own cuts. Pure counting, no rendering, no training — and it captures
   our taste rather than a model's.

## Face detection in gigstills — what it can and can't tell us

It is face **detection** (OpenCV YuNet, threshold 0.6, run on candidates re-extracted at
1080px), never **recognition** — there is no identity code in the repo at all. It yields face
count, area, rule-of-thirds position, a "lit" score, and a composite.

Measured on the CAM A run (2,875 candidates): 80.7% have at least one face; median face is
1.04% of frame (p90 2.73%, max 17.35%); `face_lit` median 0.86; 21% of detections are under
0.5% of frame; per band 73% (Jumbo) to 85% (Off the Record).

**That 80.7% is not a detection rate.** Those candidates already survived the exposure and
sharpness cascade, so they are pre-selected for being well exposed and containing a subject. It
says detections are plentiful and well lit; it says nothing about the miss rate, and there is
no ground-truth evaluation anywhere in the repo. If a real number is needed, hand-label a few
hundred frames sampled across the five bands — that would also show whether the Jumbo-vs-OTR
spread is lighting or a genuine weakness.

For genuine recognition (naming band members), Resolve has
`AnalyzeForIntellisearch(identifyFaces=True)`, added in 21.0.

## Automatic cut analysis — the computational layer

Four distinct problems, often conflated. Only the first is solved.

**1. Shot boundary detection** — "where are the cuts in this video". Mature. `PySceneDetect`
(classical, easy), `TransNet V2` and `AutoShot` (deep; AutoShot beats TransNetV2 by ~4.2% F1).
On hard benchmarks the classical/deep methods sit at F1 0.75–0.82, with PySceneDetect below 0.6
where gradual transitions are involved; newer transformer work (OmniShotCut, TransVLM) reaches
range-F1 0.883 and much better boundary localisation (transition IoU 0.632 vs 0.18–0.25).

For our purposes this is all overkill: concert films are almost entirely hard cuts, so
PySceneDetect is sufficient. The point of running it is **calibration** — point it at
professionally directed concert films and extract their cutting statistics to compare against
ours.

**2. Cut plausibility** — "is this a good frame to cut on".
[Learning to Cut by Watching Movies](https://arxiv.org/abs/2108.04294) (ICCV 2021, KAUST +
Adobe) mines **255K cuts from 10K+ already-edited videos** and learns, by contrastive learning,
to tell real cuts from artificial ones. This is precisely the "when to cut" ranker, trained on
professional editing rather than hand-written rules.

**3. Cut type recognition** — "what kind of cut is this".
[MovieCuts](https://link.springer.com/chapter/10.1007/978-3-031-20071-7_39) (ECCV 2022):
173,967 clips labelled with **ten professional cut types**, multi-modal. Useful as a vocabulary
and as a pretrained feature source.

**4. Match cutting** — finding pairs of shots with smooth visual transitions.
[Netflix's write-up](https://netflixtechblog.com/match-cutting-at-netflix-finding-cuts-with-smooth-visual-transitions-31c3fc14ae59)
is the practical industry account.

## Craft guidelines for cutting to music

**Average Shot Length (ASL)** is the standard pacing metric — total duration ÷ number of cuts.
Rules of thumb from the editing literature: ASL 2–3 s reads as energy and urgency; 10 s+ reads
as calm, tension or importance; fast cutting at 1–3 s pairs naturally with 120–140+ BPM.

**Our actual numbers** (Jumbo set, 203 shots over 28.3 min):

|                 |                |
| --------------- | -------------: |
| ASL (mean)      |         8.37 s |
| median shot     |         4.76 s |
| p10 / p90       | 1.1 s / 19.3 s |
| shots under 2 s |             44 |
| shots over 15 s |             35 |

That mean is 4–5 bars at typical rock tempos. Note the distribution is strongly **bimodal** —
a fast body plus long held wides — so the mean of 8.37 s badly misrepresents it, and the median
of 4.76 s is much closer to the 3.61 s professional-concert average from the TMM paper than the
mean suggests.

**Correction to an earlier reading in this document**: the Chelsea Dagger comparison showed 0
shots under 2 s in the rough cut against SmartSwitch's 10, which implied short shots are not
part of our grammar. Across the whole Jumbo set we have **44 shots under 2 s**. Chelsea Dagger
simply happens to be cut slowly. Do not generalise pace from one song.

**Beat and bar rules that come up consistently:**

- Cut on the **downbeat** (beat 1 of the bar); beat 3 is the usual secondary emphasis.
- **Do not cut on every beat** — it is exhausting to watch. Group cuts (two bars on, two off;
  four on, pause), and break the pattern deliberately so the edit is not predictable.
- **Cut slightly early.** A hard cut on the 1/16-note lift _just before_ the downbeat reads as
  more interesting than landing exactly on it. This matters for us: naive beat quantisation
  should snap to a small negative offset from the beat, not to the beat itself, and that offset
  is worth treating as a tunable.
- Avoid straight-cutting (and especially dissolving) between **similar framings on different
  cameras** — it reads as a jump or as a melt. On locked-off B and C this is a real risk.

**Murch's Rule of Six** — the priority ordering for an ideal cut, most to least important:
emotion, story, **rhythm**, eye-trace, planarity, spatial continuity. Murch weights emotion
overwhelmingly and is explicit that you sacrifice down the list, never up.

This is the strongest argument for assistant-not-autonomous. An automated cutter can only see
items 3–6 — rhythm, eye-trace, planarity, continuity. Emotion and story, the two that outrank
everything, are exactly what it cannot perceive. It can propose rhythmically and spatially
competent cuts; only the editor knows that the singer is about to lose it in the last chorus.

Karen Pearlman's _Cutting Rhythms_ is the book-length treatment of rhythm as shaped movement
and energy, and is the better reference than any online guide if this gets built.

### Concrete next step this suggests

Run PySceneDetect over two or three professionally directed concert films of comparable
material, extract ASL, shot-length distribution and — where the music is known — cut-to-beat
offsets. That gives an empirical target to calibrate against, costs an evening, and needs
nothing from Resolve. It would also settle whether the "cut just before the downbeat" rule is
actually observable in practice or is folklore.

Sources: [Learning to Cut by Watching Movies](https://arxiv.org/abs/2108.04294) ·
[MovieCuts](https://link.springer.com/chapter/10.1007/978-3-031-20071-7_39) ·
[TransNet V2](https://dl.acm.org/doi/10.1145/3664647.3685517) ·
[AutoShot](https://ar5iv.labs.arxiv.org/html/2304.06116) ·
[PySceneDetect benchmarks](https://github.com/Breakthrough/PySceneDetect/blob/main/benchmark/README.md) ·
[Netflix match cutting](https://netflixtechblog.com/match-cutting-at-netflix-finding-cuts-with-smooth-visual-transitions-31c3fc14ae59) ·
[Murch's Rule of Six](https://www.studiobinder.com/blog/walter-murch-rule-of-six/) ·
[BPM and picture](https://www.toolsforfilm.com/blog/bpm-and-picture-editors-guide)

## Murch's Rule of Six, in detail — and how to use it in the adjustment pass

From _In the Blink of an Eye_. Murch weights the six criteria for a cut, and the weights are the
whole point:

|   # | Criterion                  |  Weight | What it actually means                                                    |
| --: | -------------------------- | ------: | ------------------------------------------------------------------------- |
|   1 | **Emotion**                | **51%** | Does the cut preserve what the audience should be feeling at this moment? |
|   2 | **Story**                  |     23% | Does it advance the narrative — is the right thing on screen?             |
|   3 | **Rhythm**                 |     10% | Is the cut at a moment that is rhythmically interesting and _right_?      |
|   4 | **Eye-trace**              |      7% | Does it respect where the audience's focus already is in the frame?       |
|   5 | **2D plane of the screen** |      5% | Screen direction and framing grammar — the 180° line.                     |
|   6 | **3D space of action**     |      4% | Continuity of the real physical geography.                                |

Emotion alone outweighs the other five combined. Emotion plus story is 74%. The rule for
conflict is **give up from the bottom** — never sacrifice a higher criterion to preserve a lower
one. A cut that breaks screen direction but lands the emotional moment is the right cut.

### Why this matters for an automated cut, specifically

Map the six onto what a machine can actually perceive on this material:

| Criterion | Weight | Machine?                                                                                                                                                                                      |
| --------- | -----: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Emotion   |    51% | **No.** Cannot perceive it at all.                                                                                                                                                            |
| Story     |    23% | **Partly** — the desk stems say _who is live_ (lead vocal, solo, harmony). They do not say whether this is the moment that matters.                                                           |
| Rhythm    |    10% | **Yes** — tempo map, ASL, pattern-breaking are all computable.                                                                                                                                |
| Eye-trace |     7% | **Yes** — gigstills already computes subject centroid per frame; compare outgoing vs incoming position.                                                                                       |
| 2D plane  |     5% | **Yes, and deterministically.** Cameras are locked off, so screen direction per angle is a constant. The legal/illegal angle-pair matrix can be written once per set and enforced absolutely. |
| 3D space  |     4% | **Yes** — stage geography is fixed for the whole show.                                                                                                                                        |

So roughly **26% of Murch's weight is fully automatable** here, another 23% can only be partly assisted, and
the dominant 51% is not automatable even in principle. That is the architecture argument stated
numerically: the machine should own 3–6 and propose on 2; the editor owns 1.

It also says something useful about where to spend effort. Items 4–6 are only 16% combined, but
they are the cheapest to enforce and the most embarrassing to get wrong — and with locked-off
cameras they are essentially free. Enforce them as hard constraints and stop thinking about
them.

### The adjustment pass — how to review a generated or rough cut

Work **top-down through the six**, because fixing a higher criterion routinely breaks a lower
one and that is the correct trade. Doing it bottom-up means redoing work.

1. **Watch it through once for emotion only.** Do not touch anything. Mark — do not fix — every
   place where the cut is on the wrong thing for what the music is doing. Markers, not edits.
2. **Fix those marks, and accept the collateral damage.** If landing the moment costs screen
   direction or an odd shot length, take it. This is the 51%.
3. **Second pass for story / subject.** Is the right performer on screen when they matter — the
   solo, the lead-vocal handover, the drummer's fill, the moment the crowd takes over? The
   audio stems tell you who _was_ live; you decide who _should_ be seen.
4. **Third pass for rhythm.** Shot lengths, cutting on the beat, has the pattern become
   predictable, are there short shots that are not earned. Check ASL against the reference
   figures above rather than by feel.
5. **Only then check geometry**, and only where you overrode in steps 2–3 — the generator got
   items 4–6 right everywhere it was left alone.

### Feed the adjustment back — but record _why_

Every manual override in that pass is a labelled preference, and this is the honest version of
the "reinforce from manual adjustments" idea. One critical subtlety:

**Log which Murch criterion drove each override.** An override made for _emotion_ must not be
used to train the geometry or rhythm terms. If it is, the model learns that breaking the 180°
line and holding odd shot lengths is desirable in general, when in fact it was a deliberate
sacrifice made from the bottom of the list for a reason the model cannot see. Unlabelled
override data would actively degrade the constraints that are currently free and correct.

So the minimum useful log per change is: timecode, old angle, new angle, and which of the six
motivated it. That is a marker note, and it can be written in Resolve by hand or via
`TimelineItem.AddMarker` with `customData`.

Sources: [Murch's Rule of Six](https://www.studiobinder.com/blog/walter-murch-rule-of-six/) ·
[eye-trace and the rule of six](https://artlist.io/blog/eye-trace-and-rule-of-six-editing/) ·
[Is the Rule of Six incorrect?](https://nofilmschool.com/2018/08/editing-eye-trace-mind-rule-six-incorrect)

## Tested: face-driven 9:16 reframing (2026-09-11)

A real job rather than a study — a sub-60s vertical reel from the Covered in Chrome finale —
used to test the "face-detection driven framing" idea above. Result: **it works, and it fails in
one specific way that matters.**

### Method (reusable)

1. `DuplicateTimeline` the release timeline. This is not optional: **there is no set-multicam-angle
   API**, so a fresh timeline cannot reproduce the angle decisions. Duplicating preserves them.
2. `SetSetting("useCustomSettings","1")` then `timelineResolutionWidth/Height` to 1080×1920 —
   **per-timeline resolution override works via the API** and reverts cleanly.
3. For each shot, park the playhead at its midpoint on the Colour page and `GrabStill`, then
   `ExportStills` to disk. **Grab the frames from Resolve, do not resolve the multicam back to
   source files** — Resolve already knows which angle is live and hands over graded frames.
   Export one still per call with a prefix you control (`shot00`, `shot01`, …); the default
   export names encode gallery numbering, not grab order, and silently mis-map.
4. Run YuNet over the stills, take the **area-weighted centroid of faces above a size floor**
   (0.3% of frame worked), fall back to frame centre when none qualify.
5. Compute and set `ZoomX`/`ZoomY`/`Pan` per item. With `timelineInputResMismatchBehavior` =
   `scaleToFit`, zoom to fill height from 3840×2160 into 1080×1920 is
   `(1920/2160) / min(1080/3840, 1920/2160)` = **3.16049**, and
   `Pan = -(cx - 0.5) × 3840 × (1920/2160)`.
6. Verify on stills grabbed from the _reframed_ timeline, not on the numbers.

Resolution is not a constraint: a full-height 9:16 crop of 3840×2160 is 1215 px wide going into
a 1080-wide frame — a slight downscale, so no Super Scale and no quality loss.

### Result

**14 of 17 shots framed correctly unattended.** Three needed a human:

- Two CAM C shots where the weighted centroid was dragged right by a cluster of smaller faces,
  excluding both the singer and the guitarist. Hand-set to cx 0.32.
- The head shot, which is the instructive one.

### The failure mode: the size floor cannot tell a performer from the audience

On the opening CAM A shot the singer is on a barrier at frame-left (cx ≈ 0.22) facing the crowd.
YuNet found 9 faces; the only one above the size floor was a **front-row audience member at
cx 0.954**, simply because they were nearest the lens. Biggest-face is not just noisy here, it is
**actively wrong**, and it is wrong most often on CAM A — the roaming camera, which shoots from
and into the crowd.

The wides behaved well (crowd faces fall below the floor, so it defaults to centre) but that is
geometry being lucky, not the rule working.

**No threshold fixes this.** Face size does not encode "is on stage". The fix is knowing where
the stage is:

- **CAM B / C / D are locked off** — the stage is a fixed region per camera per set. A one-time
  mask makes performer-vs-audience deterministic, and would have caught all three failures.
- **CAM A roams**, so it needs a different signal — stage lighting, or the vocal/instrument stem
  gating proposed earlier in this document.

This is direct evidence for the earlier claim that the audio stems are the better subject
signal. It also lowers confidence in any purely visual "who is the subject" approach on this
material, SmartSwitch's included — SmartSwitch's active-speaker model is solving the same
problem with the same blind spot.

### Practical notes

- A duplicate carries the whole 3h39m. Everything outside the reframed window letterboxes in a
  9:16 timeline; set in/out before reviewing or rendering.
- The End Card runs 01:57:53:09–01:58:03:04. A "last 60 seconds" window silently spends ~12 s on
  the outro card — check V2 before choosing a reel window.

## Vertical reels and seamless loops (2026-09-11/12)

### The loop is a rotation, not a join

To make a reel that plays twice, do not try to make its end meet its beginning.
Take a continuous section `[start … T … end]` and output `[T…end] + [start…T]`.
The join at the **file boundary**, which is where the platform loops, is then
`T → T` — original continuous performance, so it is seamless by construction.
The discontinuity moves to the middle of the reel, where a cut is expected
anyway and can be hidden on a shot change and a downbeat.

It needs no re-cutting: render the section once, then split and concatenate
with ffmpeg. That matters because **there is no set-multicam-angle API**, so a
rebuilt timeline cannot reproduce the angle decisions — anything that would
require re-cutting a multicam range has to be done by duplicating the timeline
instead.

### Seamless loop and big finale are mutually exclusive

Measured on Covered in Chrome: per-second RMS holds at −21/−22 dB for 47 s then
drops to −25/−26/−27 — the song _ends_ inside any "last 60 seconds" window, and
the End Card runs 01:57:53:09–01:58:03:04 on top of that. Rotating a section
that contains the ending puts the final chord in the middle of the reel. So:
keep the finish and accept a hard loop, or rotate constant-energy material from
before the ending and lose the resolution. Pick one deliberately.

### Tempo: measure off a close mic, never the desk feed

Onset autocorrelation on `BOTTB_reference_48k.wav` (the FOH desk feed) is
worthless on this material — every candidate tempo from 107.75 to 108.75 BPM
scored an identical **0.091**, a flat peak, i.e. no periodicity found. The same
method on `01 Kick In.wav` from the band's stems, band-limited 35–160 Hz with
peak picking and a circular phase fit, gives **R = 0.474** and a usable grid.

Covered in Chrome finale, for the record: 16th pulse **0.18714 s**, quarter
**0.74856 s = 80.15 BPM** (160.3 double-time), **bar 2.99424 s = 74.856
frames**, first downbeat at **01:57:03:15**. Stems start picture-true at
5497.340 s, so the offset into the kick file is `show_seconds − 5497.340`.

Two practical notes. Bars are not whole frames (74.856), so a 15-bar loop is
1122.84 frames and rounding to 1123 leaves ~6 ms of error at the seam. And
because the loop length is a whole number of bars, the _internal_ join is
bar-aligned too — rhythmically correct, even though the musical content jumps.

**Status: designed and measured, not yet rendered.** The `ShipRex CIC finale
9x16` timeline exists and is reframed; the `CIC_loop_src` render was cancelled
before it ran, so the rotation has never been made or watched.

### Reviewing a sheet on a phone

`cut_recipe.html` references `preview/*.jpg` relatively, so it is useless when
sent on its own. Inline the thumbnails as base64 data URIs (158 files, 3.7 MB →
a 5.0 MB self-contained page, well inside the 16 MB artifact limit) and publish
it as an artifact. The sheet's own filter bar — "all remedies", "all changes" —
then works on the phone, which is how you look at only the rows a change
touched.
