# Brief for the mixdown session: Google / The Incident Commanders full set (Sydney 2025)

From bottb-48 (video editor), 2026-10-02. Dean wants a mastered full-set mix for a full-set video,
on a tight schedule.

## Dean's plan (his words, paraphrased, 2026-10-02)

New Logic project; per-song mix settings for the songs not yet mixed; crossfade with the desk to keep
the talking segments; re-bounce Used to Be in Love and Don't Start Now with headroom (no master);
master the whole set as one file; the video editor drops it into Resolve. He asked how much can be
automated.

## Sources (all under `/Volumes/Extreme SSD/bottb/`)

| What                                          | Path                                                                                | Facts                                                                                                                                                                                                                                                                                    |
| --------------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Desk 2-track                                  | `_TO_SORT_Audio/Sydney/DLIVE006.WAV`                                                | dLive, 96k/24 stereo, 1333.98 s (128062542 samples), −27.6 LUFS, LRA 10.7, no BWF                                                                                                                                                                                                        |
| Oct-2025 full-set bounce                      | `_TO_SORT_Audio/Sydney/Incident Commanders/Incident Commanders - Full Set.wav`      | Logic bounce of the desk, **sample-aligned with DLIVE006 (lag 0)**, BWF time_reference **359222450** @ 96k, −22.0 LUFS, r 0.92 vs desk. What the Resolve timeline plays now.                                                                                                             |
| Don't Start Now (mixed + mastered 2026-07-06) | `events/2025/Sydney/02_Production/Google/Google - Don't Stop Now.wav` (+ `.logicx`) | −11.2 LUFS, LRA 3.6 (too hot for the set). Wav t=0 = desk 528.177 s. Dean will re-bounce pre-master with headroom.                                                                                                                                                                       |
| Used to Be in Love                            | `events/2025/Sydney/02_Production/Google/Google - Used to be in Love.logicx`        | ~~DLIVE006 + separated stems + room mics, never bounced~~ (corrected by mixdown 2026-10-02: it is the DSN session under another name; **UTBIL has never been mixed**; BotB-002 files are desk copies, not room mics). Needs a pre-master bounce covering desk 268.0–530.0 s (4:28–8:50). |
| Desk segments for the unmixed songs           | `events/2025/Sydney/02_Production/Google/Segments/`                                 | Sample-exact from DLIVE006, 96k/24, BWF = 359222450 + start sample, ≥ 2 s overlaps. 01 Dumb Things desk 0–269.96 s · 04 Call Me Maybe 714.0–949.96 · 05 Bohemian Like You 945.96–1189.96 · 06 Song 2 1185.96–end. Use them or ignore them.                                               |

Clock basis: desk sample N ↔ BWF time_reference 359222450 + N. Resolve timeline seconds = desk
seconds + 22.04.

## Played order and first notes (Dean, by ear; Resolve timeline TC, 25 fps)

1 Dumb Things 00:01:26:06 · 2 Used to Be in Love 00:05:04:11 · 3 Don't Start Now 00:09:14:13 ·
4 Call Me Maybe 00:12:47:24 · 5 Bohemian Like You 00:16:30:04 · 6 Song 2 00:20:18:09.
Music ends ≈ 00:22:22. **The bottb DB setlist order is wrong for this set.**

## Target

The live-mix runbook's: chorus ≈ −12 LUFS short-term, integrated ≈ −14, true peak −1.0. Ozone 12 is
installed. Nothing is on Resolve's bus (Dean checked), so the master happens in Logic.

## What the video editor needs back

One stereo WAV of the whole set (96k or 48k, 24-bit), BWF time_reference on the 359222450 basis (or
its offset into DLIVE006), plus the LUFS / true peak you measured. Say whether Dean has listened to it.
bottb-48 places it, renders, QCs and hands to the Social agent.

If any song needs a vocal pitch pass, that goes to the repitch session (mix-assist-17 on 2026-10-02).
