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
4. Per-song passes via automation (§8). Save song projects with _Save As_ if a song needs a
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

## 4. Drums

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
4:1, attack 10–15 ms (lets the click through), release 100–120 ms, ~3 dB GR.

## 5. Bass

- DI is clean and bleed-free — it's the one source you can process freely.
- HPF 30, compress 4:1 / 20 ms / 200 ms for ~4 dB; if it sounds like a DI (it will), add a
  parallel amp sim (Logic: Bass Amp Designer) blended under it, or a little saturation.
- Lock to the kick: if kick and bass fight around 60–100 Hz, cut one there, boost neither.

## 6. Vocals (the part that matters most)

- **Ride faders, go easy on compression.** Heavy compression brings the wedge/drum bleed up
  in the gaps. Start 3:1, ~3–4 dB GR; use Auto-Level/fader automation for the rest.
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

## 7. Guitars, keys, DIs, the odd instruments

- Cab mics: HPF 90, LPF ~10 k; they're mid-range instruments. Subtractive around 300–500 if
  boxy.
- DI'd/piezo sources (keys, acoustic, erhu pickups) sound isolated and unnaturally dry. Give
  them the shared venue reverb (100 % wet send) and tame piezo harshness (cut 2–4 k, transient
  shaper). Match their tone to the miked instruments by ear, not the other way round.
- Re-amping a DI (Amp Designer) is the only way to change a guitar tone without bleed — but
  the miked cab still contains the old tone in every other mic, so re-amp only to _add_.

## 8. Automation and per-song rides

- Static structure once; then per song: vocal rides (the bulk of the work), solos up, crowd
  up between songs, mutes on silent instruments.
- Latch for the first pass while listening, Touch for corrections. Automate faders, sends,
  mutes — not plugin parameters unless needed.
- **Crowd/ambience**: automate down in verses, keep a little always — it's what says "live".
  Between songs bring it up smoothly; hard cuts read as edits on the video.
- **Master-bus EQ automation** for the "honky mids" problem (multiple open mics + room + PA
  colouration): a gentle dynamic EQ / multiband on the mix bus keyed to 1–3 kHz, or automate
  a 1–2 dB cut where the set gets harsh. A little spiky mid-range is the sound of a gig.

## 9. Crowd and ambience

- Real audience mics beat anything; align them to the band (bleed means they'll be a few ms
  late — check transients against the OH) or leave them late for depth, but not both across
  different songs.
- No crowd mics? Repurpose a quiet stage mic (a backing vocal that's idle, the room pair) with
  HPF and level automation.

## 10. Stereo image

Pan to the stage as the audience saw it; note the layout (photo or stage plot) before you
start. Lead vocal centre regardless of where they stood; backing vocals to their positions.
Drums from the audience side (a right-handed kit: hat audience-right, floor audience-left).
OH/keys/room stereo as recorded; narrow keys if they swamp the guitars.

## 11. Deliverable for video

- Rough bounce early, no master limiter, so the editor's levels are representative.
- Final: −14 LUFS integrated (YouTube), true peak ≤ −1 dBTP; a limiter (Adaptive Limiter /
  Ozone Maximizer) as the _last_ step, doing ≤ 2–3 dB. Louder concert masters are legitimate
  — say so in the filename.
- Verify offline: `ffprobe` (48 k / 24-bit / exact length) and
  `ffmpeg -af ebur128=peak=true` (I, LRA, TP). Never trust a meter you didn't read after the
  bounce.
- Balance before loudness: chasing LUFS with the vocal buried gives loud mud.

## 12. Common mistakes

- Close mics only → sounds like a demo, not a gig. Use the OH/room.
- Perfecting tracks in solo, then they clash in the mix.
- Heavy vocal compression pumping the bleed.
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
