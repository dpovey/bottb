# The arc map, for the video cut (Auto cut BOTTB Sydney)

From mix-assist, 2026-10-19. Nothing here was played or opened in Resolve. Every time is **project /
timeline TC at 25 fps**, the same clock as the song maps (`video/song_maps/EVENTS-README.md`:
timeline frame = 90000 + (REF − 2.8025625) × 25).

## What it is

Dean: _"for a live performance we want to map the emotional arc of the song … It's also good to give
this to the auto cut so it understands how to story tell better in those moments."_

`mix-analyser arc-map` reads a song's stems and scores every second and every section for
**intensity** (0 to 1). The score combines:

- how loud the band is;
- how many instruments are playing;
- how busy the drums are and how much cymbal there is;
- how high and how strongly the lead is singing;
- how loud the crowd is.

It then marks the moments that tell the story. The mix uses the same map to place its rides (crowd,
room, guitar width, vocal), so picture and sound lift together.

The file is `songs/fullmix/good_4_u/arc_map.json` in the mix-assist worktree
`~/src/personal/mix-assist-arcmap` (branch `arc-map`). The `video` key holds one entry
per section: `tc_start`, `tc_end`, `intensity`, `pace`, `shots` and `events` (each with a TC).

## How to read it

- **Peak**: a section in the song's top quarter of intensity. **Top** is the single biggest one.
- **Build**: intensity rising into a section at least as big (pre-choruses, fills, the climb).
- **Drop**: the band falls 8 dB or more inside a second, or two instruments stop. Drops come in three
  kinds. Dean: _"Sometimes a drop is a big moment."_
  - **impact**: sudden, and something answers it (the crowd, a held note, the singer into the gap,
    a full stop). It is a peak in its own right: cut on it.
  - **build-launch**: the quiet before the last push (a breakdown before the final chorus). Hold on
    what is left, then open out as it builds.
  - **valley**: the arc rests.
- **Exposed peak note / exposed vocal**: a big, high or long note while the band is thin or quiet.
  Loudness alone misses it. Hold on the singer, with no cut inside the note.
- **Crowd peak**: the crowd rising 6 dB or more over its own floor. A crowd shot goes here.
- **End lift**: whether the last third is bigger than the rest. The mix rides the last peak as the
  climax, so the cut can treat it that way too.

## Storytelling: what the evidence supports, and Dean's own style

- **Pace follows intensity, not tempo.** Cut faster in peaks and slower in valleys and exposed
  stretches. The studies found no firm tempo-to-cut-rate law: one in five music videos cut on the
  bar, and a 21-video study found pace tracks intensity and era but not tempo. Treat this as guidance.
- **Crowd shots at crowd peaks, and use them sparingly.** Demme saved the crowd for the end of _Stop
  Making Sense_. One concert editor singled out the moment the crowd sang back. Both are single
  sources.
- **Wide shots in builds; close-ups later in the song.** Hold a shot 5–10 s before moving (one
  multicam guide).
- **Hold on the singer at exposed notes and in the emotional peak.**
- **Dean's stated style:** _"how I handle big moments in video, I tend to go to wide shots zooming
  out, not always but it feels like it's expanding the moment."_ At big moments (peaks, impact drops,
  the final lift), cut to a wide shot or zoom out to expand the moment. It is a tendency, not a rule
  for every peak. **Not checked against his finished UP/BP edits:** no cut list for those edits is
  recorded in the video runbook, the learnings or memory, and the Resolve project is not mine to open.

## good 4 u (Bandlassian): the map in project TC

Stem t = 0 is take #02 file 2446.0 s = BWF 290073477 = **01:40:43:04.94**, so TC seconds =
t + 6043.1974375. Two checks agree: 290073477 / 48000 = 6043.1974375, and the song-map formula
gives 3600 + 2446.0 − 2.8025625 = 6043.1974375. Bars are the retime review's page bars (bar 1 =
stem 11.39 s). PREP.md's bar numbers sit two beats late against these.

| TC in       | section                          | bars    | intensity | marks                           | pace            | events                                                                                                                  |
| ----------- | -------------------------------- | ------- | --------- | ------------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 01:40:43:04 | pre-song talk                    | –       | 0.08      |                                 | slow            | 01:40:43:14 crowd                                                                                                       |
| 01:40:53:04 | guitar intro (GTR SL alone)      | 0–1     | 0.09      | build                           | accelerating    |                                                                                                                         |
| 01:40:56:00 | drum pickup                      | 2–3     | 0.38      | build                           | accelerating    |                                                                                                                         |
| 01:40:58:20 | verse 1 (low, half-time)         | 4–19    | 0.47      |                                 | slow            |                                                                                                                         |
| 01:41:21:12 | **chorus 1**                     | 20–35   | 0.76      | **peak, top**                   | fast            |                                                                                                                         |
| 01:41:43:20 | **post-chorus stop**             | 36–39   | 0.55      | **impact drop**                 | cut on the drop | 01:41:44:02 stop + F#5 held 0.5 s (hold on the singer); 01:41:46:07 crowd                                               |
| 01:41:49:13 | verse 2                          | 40–50   | 0.54      |                                 | medium          |                                                                                                                         |
| 01:42:05:04 | pre-chorus 2                     | 51–55   | 0.69      | build                           | accelerating    |                                                                                                                         |
| 01:42:12:01 | **chorus 2**                     | 56–71   | 0.76      | **peak**                        | fast            |                                                                                                                         |
| 01:42:34:15 | **break (keys and snare out)**   | 72–79   | 0.37      | **impact drop**                 | cut on the drop | 01:42:34:22 drop; 01:42:37:22 crowd                                                                                     |
| 01:42:46:07 | bridge                           | 80–98   | 0.55      | build                           | accelerating    |                                                                                                                         |
| 01:43:13:05 | tom fill                         | 99      | 0.73      | lift                            | medium          |                                                                                                                         |
| 01:43:14:15 | **breakdown (no drums or bass)** | 100–107 | 0.53      | **exposed vocal, build-launch** | slow            | 01:43:15:04 drums and bass out; the singer carries it in the upper register (C#5 median, up to D#5): hold on the singer |
| 01:43:26:00 | **final chorus**                 | 108–116 | 0.70      | **peak, the climax**            | fast            | 01:43:25:07 drum pickup back in; 01:43:37:07 stop at bar 116                                                            |
| 01:43:38:19 | instrumental outro               | 117–124 | 0.58      |                                 | medium          | 01:43:48:24 stop                                                                                                        |
| 01:43:50:03 | ending (shouts)                  | 125–127 | 0.55      |                                 | medium          | 01:43:54:18 final hit                                                                                                   |
| 01:43:54:19 | ring-out                         | –       | 0.39      |                                 | slow            | 01:43:56:22 crowd peak (applause)                                                                                       |
| 01:43:58:18 | post-song applause, talk         | –       | 0.10      |                                 | slow            |                                                                                                                         |

**The story in one line:** two equal choruses with a stop between them. The crowd answers the stop
at 01:41:44 and the break at 01:42:35. Then the bridge climbs, and the drums and bass drop out for a
vocal breakdown at 01:43:15. The drums come back in at 01:43:25 for the final chorus, and the
applause follows the last hit at 01:43:54.

As the band played it, the final chorus is no bigger than the first two (end lift +0.01). The mix
will ride it as the climax: crowd up, guitars +2.5, room +2, vocal +3. Those wide, zoom-out big
moments fit best at 01:43:25 (the re-entry) and at 01:43:54 (the last hit and the applause).

**Caveats**

- The crowd moments inside the song are estimates. Bandlassian has no crowd bed. The crowd is what
  is left in four open vocal mics (RX1, RX4, RX5, SM58) after the band is predicted from the close
  mics. The applause after the song is the likeliest reading: those mics read −52 to −59 dBFS for 20 s
  after the last hit, against −58 to −63 during the talk before the song, but talk through the PA
  may be part of it (RX2 reads −44 dBFS then). The cheers at 01:41:46 and 01:42:37 have not been
  confirmed by ear.
- The section names are hypotheses: rename them by ear.
- The map is built from the raw stems, not the final mix. The TCs do not change when the mix does.

## Checked against the Under Pressure edit (2026-10-19)

Dean's stated style ("big moments: wide shots, zooming out") against his own cut of Under Pressure
(`gigstills/runs/sydney26_amakazaam_underpressure/cut_list.json`, 56 V1 shots, 25 fps; 50 start inside
the music, 16.1–224.1 s of the master). Read-only; nothing was played or opened. Arc from `arc-map` on
the r9 bus exports (`peaks: C2, rise, last`, climb at bars 3397–3402 = t 140.1–150.1, end impact at
t 209.0). Record frame = 256296.875 + 25 t.

**Angle classes.** Static Desk = wide (the grade scripts treat it as "wides: many small faces").
Photo Pit, Desk Tracking and Drum = close (the same scripts' `CLOSE` set). Stage Right = **unknown**
framing (a side camera; no description found), so it is counted separately. `zoom_x` 1.3–1.5 on a
shot is tighter than its native frame (Static Desk at 1.4/1.5 is a tightened wide). `dynamic_zoom`
marks a move, but **the cut list does not record its direction**: zoom-outs and zoom-ins cannot be
counted from it (BRIEF.md says only "static 1.3–1.5 or Dynamic Zoom").

**Big moments** = the three peak sections (C2 89.9–122.1, rise 138.1–150.1, last 150.1–208.1;
102 s) against everything else in the music (106 s).

|                               | big moments   | everything else |
| ----------------------------- | ------------- | --------------- |
| wide (Static Desk at 1.0)     | 22 %          | 34 %            |
| wide incl. zoomed Static Desk | 31 %          | 40 %            |
| close (Pit, Tracking, Drum)   | 62 %          | 50 %            |
| Stage Right (unknown)         | 7 %           | 10 %            |
| cuts per 10 s                 | 2.8 (29 cuts) | 2.0 (21 cuts)   |
| time in a Dynamic Zoom shot   | 29 %          | 29 %            |

**The 2 s after each peak onset (n = 4: C2 89.9, rise 138.1, last 150.1, end impact 209.0).** Every
onset lands inside a close shot (Photo Pit each time). A cut follows within 2 s at 2 of 4 (last: to
Static Desk with Dynamic Zoom at +0.5 s; end impact: Static Desk with Dynamic Zoom at +1.7 s). C2 gets
the same wide-with-move shot at +2.1 s, just outside the window. The rise onset gets Drum at +3.6 s
and Desk Tracking after, with no wide. Also: the climb start at 140.1 meets a cut to Drum at +1.6 s;
the in-song cheer at 180.6 meets a cut to Drum at +1.3 s.

**Verdict: not supported as stated; the zoom-out half cannot be tested.** Dean's cut has _fewer_ wide
shots at the big moments than elsewhere (22 % vs 34 %), and more close-ups and faster cutting. What
does show is a pattern _after_ the onset: a Static Desk wide with a Dynamic Zoom move arrives
0.5–2.1 s after three of four peak onsets. That is consistent with "expanding the moment" only if
those moves are zoom-outs, and the cut list cannot say. Static Desk comes up 16 times in the song, so
three of four is weak evidence (n = 4). To settle it, read the direction of the Dynamic Zoom on shots
35, 20, 52 (the three above) and the rest in Resolve, or by eye on the measure render. The Black
Parade cut was not checked.

## Dean's refinement (2026-10-19)

After seeing the check above, Dean described the timing more precisely: the wide shot and the zoom-out come **after a big peak, as it recedes, while the music is still in the moment**. They don't come on the peak itself.

- **On the peak:** cut faster and closer. In the UP edit that's 2.8 cuts per 10 s, against 2.0 elsewhere. Every peak onset lands on a close Photo Pit shot.
- **In the release just after it:** open out wide, or zoom out. In the arc map, that's the stretch where intensity falls from a peak but stays above the section baseline. In UP, 3 of 4 peaks open out to the Static Desk wide with a dynamic zoom 0.5–2.1 s after the onset.
- **Still open:** the zoom direction on UP V1 shots 20, 35 and 52, and how Stage Right is framed.

## Guidelines from the research (2026-10-19)

Full write-up with quotes, links and evidence levels: `CONCERT-SHOT-RESEARCH.md` (next to this file).

- **Tight intensifies and wide relaxes** (Zettl's broadcast textbook; documented). Land each peak onset on a close, cut on or just before the downbeat, and cut faster inside peaks. Dean's UP cut already does this.
- **Open out in the release, not on the hit.** No source names a "pull back after the peak" move. The parts are documented: a wide lowers the impact, shot lengths grow after a climax (Cutting 2016, 180 films), and outros slow their cutting in 85 % of music videos (Pohl 2025, small sample). Dean's refined style fits, but it is his own house move. Place the wide in the decay after a hit or at the fall out of a section, not at a fixed offset from every onset.
- **Builds: push in or cut faster** (zoom-in intensifies, and pre-choruses are mostly cut faster). This replaces the unverified "wide shots in builds" line above.
- **Hold wides at least 4 s** (Static Desk most of all, since a crowded wide reads slowly: Cutting & Armstrong 2016). Do not use Static Desk as the fallback shot.
- **Cut in rhythm, not on every beat.** Performance and rock videos rarely lock cuts to downbeats (Prétet & Richard 2021, 548 videos).
- **Exposed notes: no cut inside the note.** Hold the close, or zoom slowly across the phrase (Demme; Brian Large).
- **Ration crowd shots** to visible reactions, applause and the end (Demme, Scorsese, Dugdale).
- Still open: the zoom direction on UP V1 shots 20, 35 and 52. If they are zoom-ins, the release reading of Dean's pattern does not hold.

## Crowd shots: BOTTB is different (Dean, 2026-10-19)

"BOTTB is partly about the community and the audience, we want to see the crowd react, but particularly only unique shots on roving cameras."

This overrides the concert-film advice to save crowd shots for the end (Demme, Scorsese). For BOTTB:

- **Show the crowd reacting.** Use the arc map's crowd moments: cheers, sing-alongs, the response to an impact drop or an exposed high note, and the end lift.
- **Use only unique crowd shots from the roving cameras:** a specific reaction, a face, a group moment. No generic or repeated crowd wides from the fixed cameras, and no reuse of the same crowd moment.
- If no unique roving shot exists for a moment, stay on the band.

**Correction (Dean, same day): "Don't only use those, still be sparing."** Crowd shots stay sparing overall. Prefer unique reactions on the roving cameras, but they are not the only crowd shots allowed. Use other crowd shots occasionally where they serve the moment, and keep the band the main subject.
