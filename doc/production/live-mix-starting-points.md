# Mixing a live multitrack — starting points and guidance

For mixing BOTTB desk multitracks in Logic Pro after the show. Written for someone who has
mixed on a desk but not post-produced a live recording. Numbers are _starting points with a
reason_; every one is expected to move once heard. Companion to
`live-mix-logic-learnings.md` (what we learned) and the per-band setup in the mix session.

Sources drawn on: Sound On Sound's _Mixing A Live Recording_ (Mike Senior), Waves' _14 Tips
to Mix a Better Live Recording_, Sonnox on drum phase alignment; plus what the stems measured.
Links at the end.

---

## 1. How post-desk mixing differs from mixing the desk

| On the desk                     | In post                                                    |
| ------------------------------- | ---------------------------------------------------------- |
| You fight feedback and the room | Neither exists. Only the bleed remains.                    |
| One pass, one balance           | Per-song balances via automation; unlimited retries        |
| Loud PA masks spill             | Headphones/monitors reveal _everything_ in every mic       |
| EQ for the PA + room            | EQ for the recording only; the room is already in the mics |
| Compression for control         | Compression for tone; control comes from fader rides       |

The central fact: **every mic contains the whole band**. Everything you do to one track also
does it to the bleed in that track. That drives most of what follows.

## 2. Order of work

1. **Structure first, whole set**: routing, HPFs, gates, polarity, pans, one static balance.
2. **Start in the middle of the set**, not song 1 (openers have gain changes and nerves).
3. **Gain variations**: the desk engineer moved preamps during the show. Fix with region gain
   or clip-based level automation _before_ you mix, so the compressors see a steady input.
4. Per-song passes via automation (§9). Save song projects with _Save As_ if a song needs a
   structurally different mix; the bounce project stays untouched.
5. Bounce, QA offline (ffprobe / ebur128), check against picture.

## 3. Bleed: work with it, don't fight it

- **Subtractive EQ beats additive.** Boosting 5 kHz on a vocal also boosts the hi-hat in the
  vocal mic. Cut what's wrong instead of adding what's missing.
- **HPF everything that isn't bass or kick** — "bass gets everywhere". LPF (6–10 kHz) on
  mics that only need their mids: kick-out, guitar cabs, toms.
- **Gates lightly, mutes surgically.** Reduction −15…−25 dB, not full; a gate opening on the
  wrong thing is worse than a little bleed. For tracks that are silent for whole songs (Erhu,
  Acoustic, keytar) use _mute automation_ — off when not playing — rather than a gate.
- **Don't mix in solo.** The bleed in solo sounds terrible; in the mix it's the glue that
  makes it sound like a room. Judge everything with the full band playing.
- **A good tone in the "wrong" mic is still a good tone** — the bass in the kick-out mic,
  the snare in the vocal mic. If it helps, use it.
- **Pitch correction and quantising**: on a bleed-heavy source the correction only applies to
  _that_ mic while the same note sits uncorrected in six others → chorusing/phasing. Use
  pitch correction gently on _lead vocals only_ (the strongest single-source signal) and skip
  it on backing vocals unless a part is exposed. Same logic for timing edits: only on the
  per-song copy, and only where the bleed is low (DI'd sources).

## 4. Compression: makeup gain and the Mix knob

Two controls this project has never set, and each changes what the compressor is _for_. Added
2026-09-20, after an audit of the ShipRex set found all 13 compressors at Mix 100 % with no manual
makeup on any of them.

### 4.1 Makeup gain — so the A/B is honest

A compressor only ever turns things **down**. Engage one and the strip gets quieter, so comparing
it against bypass compares "compressed and quieter" with "uncompressed and louder" — and louder
wins every time, for reasons that have nothing to do with the compressor. **Makeup gain puts the
level back so the comparison is about the dynamics alone.** Without it you cannot hear what the
compressor did; you can only hear that something got smaller.

- Set it against bypass: engage, then raise makeup until the loudest moments sit where they did
  before. Roughly **half to two-thirds of the gain reduction** you are getting is a decent first
  guess.
- **Logic's Auto Gain (−12 dB / −18 dB) is a formula from threshold and ratio, not a measurement of
  your signal.** It is a convenience, not a substitute, and because it is a fixed guess it can
  leave a strip several dB out. Prefer manual makeup. If Auto Gain is on, at least _know_ it is on
  — a strip with Auto Gain reads louder with the compressor in, and one without reads quieter, so
  two strips can mislead you in opposite directions.
- **The trap**: with no makeup, the strip is quieter with the compressor in, so you push the
  fader — and every send from that strip goes up with it. The reverb gets louder because you
  compressed the vocal.

### 4.2 Parallel compression — density without losing the hit

What a compressor does to a drum is **reduce the difference between the stick and everything
after it**. That difference _is_ the punch. So compressing a snare to make it bigger makes it
louder and less punchy at the same time: you get the level you wanted and lose the reason you
wanted it.

**Parallel compression blends the compressed signal with the untouched one.** The dry path keeps
the transient at full size; the wet path — crushed far harder than you would dare in series —
brings up everything _between_ the hits: shell ring, room, ghost notes, tails. The result is the
quiet parts louder without the loud parts flatter, which is what "bigger" actually means.

**Logic's Compressor has a Mix knob, so this needs no bus routing at all.**

- **How to set it**: Mix to 100 %, then set the compressor much harder than you would in series —
  high ratio, low threshold, 6–10 dB of GR. Then back Mix off until the transients return. It
  usually lands **40–70 %**.
- **Where it helps**: drum bus (60–70 %), snare (70 %), overheads/room if you want the kit to
  breathe, vocal group for presence without squash.
- **Where it does not**: kick, usually — you want that tight, not ringing. Anything whose transient
  you do not care about gains nothing from the dry path.
- **Why it is forgiving**: artefacts in the wet path are masked by the dry path, so a "wrong"
  setting is far less audible than the same setting in series. This is what makes high ratios
  usable — a bus at 4:1 that flattens the kit in series will glue it at Mix 65 %.
- **One caution**: it is a parallel path, so it sums with the dry. The stock Compressor's Mix knob
  is internal and therefore safe. Comb filtering is only a risk if you build parallel compression
  the old way, with a send, a bus and a separate plug-in whose latency Logic cannot compensate.

### 4.3 The two together

They solve different halves of the same problem. Makeup gain answers _"is this compressor helping,
or is it just quieter?"_. The Mix knob answers _"can I have the density without the flattening?"_.
Set makeup first, so the A/B is fair; then reach for Mix if the thing you gained in density you
lost in punch.

## 5. Drums

- **Polarity before anything.** Solo kick-in + kick-out, flip one — keep whichever has more
  low end. Same for snare top vs overheads. Logic: Gain plugin → Phase Invert. There is no
  "right" answer, only the fatter one.
- **Time-align close mics to the overheads? Test first.** OH ~1 m from the snare, close mic
  ~5 cm → ~2.5–3 ms (≈130–150 samples at 48 k) late on the close mic. Nudging the close mics
  _later_ to match can add clarity — or make the kit smaller. Test: pull the OH fader down; if
  the snare gets _louder_, it was cancelling. Mono-sum test: full in stereo, thin in mono =
  phase problem. On this project nothing moves — use Logic's **Sample Delay** plugin on the
  close mics instead of moving regions. Leave room mics alone: their delay _is_ the depth.
- **Overheads carry the kit.** In a live recording they are the sound; close mics add punch.
  Balance OH first, then bring close mics up to it, not the reverse.
- **Expect "splashy".** Cymbals live in every mic. HPF the OH if bass spill is heavy; accept
  some splash as the sound of a gig.
- **Reshape rather than replace**: transient shaper (Logic: Enveloper) on kick/snare close mics
  for attack; sample _doubling_ (Drum Replacer, mode Double) only if a mic is genuinely poor.

Starting points: HPF snare 80, toms 50–70, OH 100–120 (24 dB/oct if bass spill), hat 300.
Gate kick −30 thr / −25 dB reduction / detector HC 200 Hz; toms −25 / −20 dB / HC 500–800 Hz;
hold 150–250 ms, release 200–350 ms, lookahead 5 ms, attack ≤0.5 ms. Compressor on kick/snare
4:1, attack 10–15 ms (lets the click through), release 100–120 ms, ~3 dB GR, **makeup set against
bypass** (§4.1). **Snare at Mix ~70 %** and the **drum bus at Mix 60–70 %** (§4.2) — the bus is
where parallel earns the most, because it is the one place a high ratio is tempting and a high
ratio is exactly what flattens a kit. Toms usually want _no_ compressor at all: with a gate in
front, compression plus makeup mostly raises the bleed between hits.

## 6. Bass

- DI is clean and bleed-free — it's the one source you can process freely.
- HPF 30, compress 4:1 / 20 ms / 200 ms for ~4 dB, makeup against bypass (§4.1); one compressor,
  not two in series — a second one with a different attack undoes the first one's decision about
  the pick. If it sounds like a DI (it will), add a
  parallel amp sim (Logic: Bass Amp Designer) blended under it, or a little saturation.
- Lock to the kick: if kick and bass fight around 60–100 Hz, cut one there, boost neither.

## 7. Vocals (the part that matters most)

- **Ride faders, go easy on compression.** Heavy compression brings the wedge/drum bleed up
  in the gaps. Start 3:1, ~3–4 dB GR, makeup against bypass (§4.1); use Auto-Level/fader
  automation for the rest.
- **The vocal group bus is the place for parallel** (§4.2): it buys presence without the squashed
  quality that makes a live vocal sound small. A group bus compressed hard and blended at ~50 % is
  much safer than the same amount of compression in series, because the dry path keeps the
  consonants. Watch the threshold on a group bus especially — set too low it never releases, and
  with no makeup the whole group leaves the bus quieter _and_ flatter than it arrived.
- **Keep vocal mics partly open when not singing** (−10…−15 dB, not muted) so the room
  ambience doesn't jump when the singer comes back in.
- Live vocal mic EQ (SM58-type): HPF 100–120; nasal → cut ~2 kHz; muddy/"back of throat" →
  cut 300–500; presence +2 at 3–5 k (then watch sibilance). De-ess only when heard.
- **Plosives and sibilance**: clip-gain them down on the per-song copy or automate; a
  de-esser working hard on a live mic also chews the cymbals in the bleed.
- Pitch correction: lead vocals only, chromatic, slow response (60–80 ms). Consider none on
  backing vocals.
- Reverb/delay with restraint: the processing hits the bleed too. Find _one_ reverb that
  resembles the venue and send everything to it; it makes DIs sit in the same room.

## 8. Guitars, keys, DIs, the odd instruments

- Cab mics: HPF 90, LPF ~10 k; they're mid-range instruments. Subtractive around 300–500 if
  boxy.
- DI'd/piezo sources (keys, acoustic, erhu pickups) sound isolated and unnaturally dry. Give
  them the shared venue reverb (100 % wet send) and tame piezo harshness (cut 2–4 k, transient
  shaper). Match their tone to the miked instruments by ear, not the other way round.
- Re-amping a DI (Amp Designer) is the only way to change a guitar tone without bleed — but
  the miked cab still contains the old tone in every other mic, so re-amp only to _add_.

## 9. Automation and per-song rides

- Static structure once; then per song: vocal rides (the bulk of the work), solos up, crowd
  up between songs, mutes on silent instruments.
- Latch for the first pass while listening, Touch for corrections. Automate faders, sends,
  mutes — not plugin parameters unless needed.
- **Crowd/ambience**: automate down in verses, keep a little always — it's what says "live".
  Between songs bring it up smoothly; hard cuts read as edits on the video.
- **Master-bus EQ automation** for the "honky mids" problem (multiple open mics + room + PA
  colouration): a gentle dynamic EQ / multiband on the mix bus keyed to 1–3 kHz, or automate
  a 1–2 dB cut where the set gets harsh. A little spiky mid-range is the sound of a gig.

## 10. Crowd and ambience

- Real audience mics beat anything; align them to the band (bleed means they'll be a few ms
  late — check transients against the OH) or leave them late for depth, but not both across
  different songs.
- No crowd mics? Repurpose a quiet stage mic (a backing vocal that's idle, the room pair) with
  HPF and level automation.

### The crowd/room "stadium" recipe (2026-09-21)

The size a big live mix has is **the room and the crowd coming up**, not the close mics being
squashed. Put the compression where the size actually lives and the close mics keep their punch.
This is the deliberate replacement for the size you otherwise get by accident from over-compressing
everything (§4.3).

On the **CROWD stack** (Room + the vocal-mic copy for applause), or on the Room strip if there is
no stack yet:

| control   | value              | why                                                                                                                                                                                                                                                                                                                           |
| --------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Circuit   | **Vintage FET**    | Logic's 1176. The crushed-room sound is an 1176 with all buttons in: fastest attack of the seven models, and a coloured, aggressive gain reduction that adds density rather than only turning things down. Vintage VCA if FET is too much; Vintage Opto if the pumping is unwanted, but then most of the effect goes with it. |
| Ratio     | **10:1**           | High enough that the floor lift dominates. This is not a control-the-peaks job.                                                                                                                                                                                                                                               |
| Threshold | **for 8–12 dB GR** | Derive it, don't guess: `threshold = input − GR ÷ (1 − 1/ratio)`. Take the stem's median level, add the strip's Gain trim. On ShipRex's Room (p50 −34.3 dBFS, +3.0 dB trim) that put 10 dB of GR at **≈ −42 dB**.                                                                                                             |
| Attack    | **3–10 ms**        | Fast enough to clamp the direct sound so the tail is what blooms.                                                                                                                                                                                                                                                             |
| Release   | **50–100 ms**      | Tempo-referenced: shorter than the eighth note (190 ms at 158 bpm) so it recovers fully before the next backbeat and the tail blooms into every gap. At 200 ms+ it is still closing when the next hit lands and the bloom never arrives.                                                                                      |
| Mix       | **100 %**          | Blend with the fader, not the Mix knob — the whole strip _is_ the parallel path.                                                                                                                                                                                                                                              |

Then:

- **Ride the fader, not the threshold.** Sparse sections are where this earns its keep, and the
  room sits a few dB lower there (3 dB on ShipRex's Everlong), so it gets _less_ GR exactly where
  you want more size. Automate the fader up across those sections rather than chasing it with the
  threshold.
- **Check it against the dense sections.** The same setting that opens out a breakdown will wash a
  full chorus. If it does, that is a fader ride, not a reason to back the compressor off.
- **The crowd comes up with the room, and that is the point** — applause and shout-back are a large
  part of what reads as "big". It also means the recipe interacts with the crowd rides in the
  runbook's per-song step (crowd up in gaps, ducked −8 for speech): set the compressor first, then
  the rides against it.
- **Do not time-align the room to the band** for this — its delay _is_ the depth (§4).

## 11. Stereo image

Pan to the stage as the audience saw it; note the layout (photo or stage plot) before you
start. Lead vocal centre regardless of where they stood; backing vocals to their positions.
**Drums from the audience side** (a right-handed kit: hat audience-right, floor audience-left) —
confirmed as the standing rule for all live mixes, Dean 2026-09-21, because these mixes are cut to
picture and a crash the viewer _sees_ on the left has to be heard on the left.
OH/keys/room stereo as recorded; narrow keys if they swamp the guitars.

**Stating the target is not enough — verify it.** On ShipRex 2026 the overhead pair was recorded in
_drummer_ perspective and nobody noticed, because by ear a pair of overheads gives you no landmark
to check against. The method that settles it, from the stems and before Logic opens:

- Cross-correlate each **close mic** against **OH-L** and **OH-R** separately, band-limited to that
  drum (hats 6–10 kHz, rack toms 100–300 Hz, floor tom 60–200 Hz), and read the **lag**, not the
  level. Lag is the acoustic path delay, so it is immune to a channel gain mismatch; level
  differences are not, and on ShipRex the L channel ran 1.7 dB hot, which made every level reading
  useless.
- The hi-hat is the reliable landmark: it sits at the edge of the kit, so its path difference is
  large (77 cm on ShipRex, an unambiguous 2.25 ms). The toms sit near the centre line and differ by
  only 10–15 cm, so use them to confirm the _ordering_ (hats → rack toms → floor tom should be
  monotonic across the image), not to decide on their own.
- Discard the snare if it returns a negative lag — the overhead cannot precede the close mic, and
  a cross-correlation on a periodic signal will sometimes claim it does.

**Mirroring is all-or-nothing.** If the overheads need flipping, the mono close-mic pans must flip
with them. Flip one and not the other and the hi-hat is left in its close mic and right in the
overheads: the phantom image smears and collapses toward whichever is louder, and the kit ends up
_less_ defined than before the fix. Mirror the pan on every kit channel that is off centre, then
solo a close mic against the overheads and confirm they pull to the same side. `logic-cli` cannot
read pan values, so there is no offline check for this step — only the ear.

**The cheap mechanism**: the stock **Gain** plug-in has a **Swap L/R** control, and it is already in
slot 0 of every strip in the ShipRex template. Flipping a pair costs one checkbox, no new plug-in.
It does nothing while a strip is mono, which is its own trap — see §5 and the runbook's prep.

## 12. Deliverable for video

- Rough bounce early, no master limiter, so the editor's levels are representative.
- Final: −14 LUFS integrated (YouTube), true peak ≤ −1 dBTP; a limiter (Adaptive Limiter /
  Ozone Maximizer) as the _last_ step, doing ≤ 2–3 dB. Louder concert masters are legitimate
  — say so in the filename.
- Verify offline: `ffprobe` (48 k / 24-bit / exact length) and
  `ffmpeg -af ebur128=peak=true` (I, LRA, TP). Never trust a meter you didn't read after the
  bounce.
- Balance before loudness: chasing LUFS with the vocal buried gives loud mud.

## 13. Common mistakes

- Close mics only → sounds like a demo, not a gig. Use the OH/room.
- Perfecting tracks in solo, then they clash in the mix.
- Heavy vocal compression pumping the bleed.
- **Judging a compressor against bypass without setting makeup gain** — you are comparing loud
  against quiet, and loud always wins (§4.1).
- **Leaving Mix at 100 % everywhere.** Every stock Compressor has the knob; a kit bus at 4:1 in
  series flattens, and the same setting at Mix 65 % glues (§4.2).
- **Trusting Auto Gain as makeup.** It is computed from threshold and ratio, not measured from the
  signal, so it can leave a strip several dB out in either direction (§4.1).
- Gating for silence; every missed hit is a hole.
- Ignoring desk gain changes and mixing around them with the compressor.
- Detailed pitch/timing correction on spill-laden signals.
- Not automating EQ when the set's tonality shifts (drummer hits harder, singer tires).

## Sources

- Sound On Sound — _Mixing A Live Recording_: https://www.soundonsound.com/techniques/mixing-live-recording
- Sound On Sound — _Stage To Studio_: https://www.soundonsound.com/techniques/stage-studio
- Waves — _14 Tips to Mix a Better Live Recording_: https://www.waves.com/tips-to-mix-a-better-live-recording
- Sonnox — _Drum Phase Alignment: When to Nudge, When to Flip_: https://sonnox.com/articles/drum-phase-alignment-when-to-nudge-flip-or-leave-alone
- Puremix — _How to Mix Live Recordings_: https://www.puremix.com/blog/how-to-mix-live-recordings-the-complete-guide
- Audient — _5 Tips for Mixing Live Band Recordings_: https://audient.com/tutorial/5-tips-for-mixing-live-band-recordings/
