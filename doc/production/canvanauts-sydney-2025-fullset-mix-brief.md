# Brief for the mixdown session: Canvanauts (Canva) full set, Sydney 2025

From bottb-b2 (video editor), 2026-10-03. Dean wants a finished 4K full-set video for YouTube, the same
job as Google / The Incident Commanders (`google-sydney-2025-fullset-mix-brief.md`). Audio is yours;
placement, render and QC are mine.

## Dean's words (2026-10-03)

- Part of the set exists only on the "ambient mics": those sections must at least be level-matched to the
  desk sections, ideally tone-matched, with crossfades at the joins.
- "anti-hero is an as covered by version. It's the only song that's been fully mixed and mastered."
  (It is a Taylor Swift cover; "different version" did not mean a different take.)
- "There are 4 ambient mics, those two are the ones that will do the best as a desk replacement."
  (Dean, later: "I was meaning the MixL and MixR". He had also asked "Maybe we combine all of them?",
  thinking Mkh417/Mkh50 were for speech. Measured: **MixL = 0.58 × Mkh417 (−4.7 dB), MixR = 0.55 × Mkh50
  (−5.2 dB)**, cross terms ≤ 0.01, residual −13 to −16 dB on three 20 s windows (music and talk). So the
  Mix tracks are the MixPre's mix bus of the two mics: four tracks, two independent signals. Combining
  all four adds level, not pickup.)
- On where the Anti-Hero mix lives: "Should be a logic project somewhere."

## Sources (all under `/Volumes/Extreme SSD/bottb/_TO_SORT_Audio/Sydney/` unless stated)

| What                               | Path                                                                                                           | Facts (measured 2026-10-03 by bottb-b2)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2025 Logic project                 | `Canvanauts/Project.logicx` (also possible: `Bottb - Sydney.logicx`, a whole-night session, same folder level) | Media: DLIVE003.WAV, BotB-001_01–04.wav, Canvanauts.wav. The only Canvanauts `.logicx` found. Very likely the Anti-Hero mix session (below). Please open it with logic-cli and say what it holds.                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2025 full-set bounce               | `Canvanauts/Canvanauts.wav`                                                                                    | 48k/24, 1292.743 s, BWF time_reference 172800000 (= 01:00:00:00, the multicam start; what the video is synced to). Bounced 2025-11-07. **Sample-locked to BotB-001: bounce t=0 = BotB-001 3784.000 s** (5 points, 0.25 ms resolution). −14.3 LUFS for 0–621 s, −14.4 LUFS for 621 s–end, LRA 9.5–9.6. **(Corrected 2026-10-03 by mixdown: the bounce contains no desk at all; it is MixL/MixR through the mastering chain for the whole set. It stays at −0.01 ms against BotB-001 across the second half while DLIVE003 wanders −5.3 → +2.9 ms with its drift. My own first scan showed the same lock at 800/1100/1250 s and I missed what it meant.)** |
| Desk 2-track                       | `DLIVE003.WAV`                                                                                                 | dLive, 96k/24, 671.84 s. **Covers only bounce 621.18 s → end** (timeline ≈ 00:10:21 → end). Drifts −13.5 ppm against the MixPre (621.1852 → 621.1775 s over 570 s, ≈ 7.7 ms across the half).                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| MixPre-6 recorder                  | `/Volumes/Battle Of Band 2025/Stereo Audio/BotB-001.WAV`                                                       | 4 ch 48k/24, 7443.7 s, BWF 18:00:11.7. Track names MixL, MixR, Mkh417, Mkh50. **All four lock to the desk at 0 ms** (−0.1 ms, r 0.93–0.98 below 1 kHz), so no acoustic delay to correct at a join. **Mkh417 ≈ MixL (r 0.98) and Mkh50 ≈ MixR (r 0.98)**, ~4.7 dB hotter; against the desk L the residual is about −6 dB, so a different signal from the desk 2-track, not a copy. The first half of the set (bounce 0–621 s) exists only here.                                                                                                                                                                                                           |
| Anti-Hero, mixed + mastered (2025) | only inside `_TO_SORT_Video/Canvanauts/Canvanauts - Anti-hero (4k).mp4` (AAC 320)                              | `align-mix` vs Canvanauts.wav: **placed at 239.241 s** (timeline 01:03:59:06), peak r 0.9986, **gain −0.01 dB**, residual −25.7 dB (worst 250/315 Hz; last 10 s −5 dB = the delivery's fade-out); −14.4 LUFS vs −14.3 for the same span of the bounce. So Canvanauts.wav already carries (essentially) this Anti-Hero mix. Inside the MixPre-only half.                                                                                                                                                                                                                                                                                                  |

~~Tone, octave levels re 1 kHz (bounce): the MixPre half is ~2 dB brighter at 2–4 kHz and ~1–2 dB duller at
8–12 kHz than the desk half~~ (corrected 2026-10-03: both halves of the bounce are MixPre, so that row compares
songs, not sources).

## Played order

DB setlist: Are You Gonna Be My Girl, Anti-Hero, Valerie, I'm Still Standing, Don't Stop Me Now. The DB
order was wrong for Google; I will confirm order and first notes with Dean by ear and send them on.
Anti-Hero starts near timeline 00:03:59 (the 2025 cut's start), so it was played second.

## Target and what I need back

One stereo WAV of the whole set (48k/24), **~−14 LUFS integrated / −1.0 dBTP**, MixPre-only sections
level- and ideally tone-matched to the desk sections with crossfades at the joins, Anti-Hero as mixed.
**Same clock as Canvanauts.wav** (BWF 172800000, or state the offset), so it lands at 01:00:00:00. Tell
me the LUFS / true peak you measured and whether Dean has listened. I place it on its own named audio
track, verify with a short render, and hand to the Social agent.
