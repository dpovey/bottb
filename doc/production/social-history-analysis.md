# Social history: what we have actually published, and which of it is any good

Written 8–9 September 2026 from a full read of the harvested corpus: **466 rows** across Facebook,
Instagram and YouTube, 2023-08-24 to 2026-09-08. Every quote below is verbatim from a live post.
Reproduce the corpus with `pnpm bottb harvest --json` (dry run, read-only).

This is not a neutral description of house style. **Roughly a third of the corpus was drafted by a
model, and some of it contains exactly the tropes Dean has repeatedly cut.** Describing the corpus
neutrally would codify that as the standard. So the corpus is graded here, against Dean's own rules,
and the good is separated from the merely published.

One caveat that applies to the whole document: **authorship is inferred, never known.** No platform
records who typed a caption. The evidence used is style, timing, and the runbook's own record of
which runs were model-assisted. Where the inference is weak, it says so.

---

## 0. What is in the corpus, and what is missing

| Platform     | Rows  | Earliest   | Text field    | Engagement available                     |
| ------------ | ----- | ---------- | ------------- | ---------------------------------------- |
| Facebook     | 210   | 2024-01-25 | `message`     | `shares`, video `views`                  |
| Instagram    | 179   | 2023-08-24 | `caption`     | `like_count`, `comments_count`           |
| YouTube      | 77    | 2025-09-15 | `description` | `viewCount`, `likeCount`, `commentCount` |
| **LinkedIn** | **0** | —          | —             | —                                        |
| **TikTok**   | **0** | —          | —             | —                                        |

Facebook's 210 rows are 177 `published_posts` plus 33 videos that exist only on the `/videos` edge
(reels that never surfaced as posts). The other 69 videos were folded into their posts, which is
where the view counts come from.

**LinkedIn and TikTok are unrecoverable by API and are a real hole in this analysis**, not a
rounding error: the runbook shows every Brisbane 2026 reel went to five platforms, and the Brisbane
log records 10 LinkedIn and 10 TikTok publications that nothing here can see. LinkedIn in particular
is where the longest-form captions go and where the sponsor tagging matters most — so the LinkedIn
voice is entirely unexamined below. Two of the strongest voice signals we have (a LinkedIn post Dean
edited by hand on 8 Sep to add the sponsor mentions the model omitted) survive only in the runbook's
incident table.

Reach and impressions are unavailable everywhere: the Meta token has neither `read_insights` nor
`instagram_manage_insights`. Every engagement number below is likes, views or shares — a weak proxy
for distribution, and a lifetime total captured on one day, so older posts have had longer to
accumulate. Treat all of them as directional.

---

## 1. Five eras, and who probably wrote them

The corpus is not one voice. It is at least five, and they do not map cleanly onto "human" and
"AI" — the model-assisted work appears in two separate bursts with very different quality.

| Era                              | Span                    | n   | Character                                                                     | Inferred authorship                                                                             |
| -------------------------------- | ----------------------- | --- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **A. Social-manager era**        | 2024-01 → 2024-09       | 49  | Short, hype-forward, heavy hashtags, typos left in                            | Human, agency/social-manager register. High confidence.                                         |
| **B. Campaign-template era**     | 2025-03 → 2025-08       | 32  | Slogan cards on a daily cadence, identical body, no facts                     | Human, template-driven. High confidence.                                                        |
| **C. Sydney recap era**          | 2025-09 → 2026-04       | 164 | Long band write-ups with named musicians, plus a parallel run of purple prose | **Mixed.** Two distinguishable hands. Medium confidence.                                        |
| **D. Melbourne era**             | 2026-05 → 2026-08-19    | 88  | Setlist-led recaps, playful metaphor, some factual slips                      | **Likely model-assisted, edited.** Medium confidence.                                           |
| **E. Brisbane 2026 reel series** | 2026-08-20 → 2026-09-08 | 28  | Concrete, rubric-compliant, fact-dense                                        | **Model-drafted under the rubric, human-reviewed.** High confidence (the runbook documents it). |

The provenance signal that actually separates C from D and E is not the date. It is the **em dash**:

```
em dashes present, by era
2024                    2 posts
2025 (to Oct)          14 posts
2025-11 → 2026-04      23 posts    <- the peak
2026 Melbourne          0 posts
2026-08-20 onward       0 posts
```

The em dash was banned during the Brisbane 2026 run and the ban held perfectly from 2026-05 onward.
The 23 em-dash posts of Nov 2025 – Apr 2026 are the densest cluster of model tells in the whole
corpus, and they predate the rule.

---

## 2. Grading the corpus against Dean's rubric

The rules, from `social-reel-posting-runbook.md` §Copy process and the incident tables: no em dashes;
no "the moment when"; no rule-of-three; no "it's not X, it's Y"; no emoji bookending a sentence or
paragraph; first-person "we"; lead with a concrete detail someone in the room would recognise; never
invent crowd reactions; never self-mention or congratulate from the brand account; no formulaic
"a kind of X that Y"; credit the sponsor and charity properly; get band facts right.

### 2.1 Where the corpus fails, with the actual sentences

**Invented crowd reactions — 12 posts, all Sep 2025 to Dec 2025.** This is the single worst class of
failure, because it is fabrication presented as reporting. Nobody counted the room.

> "Epsonics from Epsilon opened the night and **left the crowd in awe** — setting the bar sky-high
> from the very first song." (FB, 2025-09-17)

> "Along came the Agentics, and simply **blew the roof off the Factory Theatre**! ... **the crowd went
> from zero to eleven** from about the first 30 seconds." (FB/IG, 2025-11-02)

> "When the Canvanauts hit the stage, **the whole room lifted**." (FB/IG, 2025-12-02)

> "Every track landed like a spark in dry kindling. **The room lit up, the crowd moved as one**."
> (FB/IG, 2025-12-09)

Compare the same event described without invention, in the same corpus:

> "Crowd-vibe score second only to the winners." (FB, 2026-09-05)

That sentence is a fact from the scoring sheet. It does the same job and is checkable.

**Rule-of-three and "a kind of X that Y" — Nov/Dec 2025 and Melbourne.**

> "the kind of flair you'd expect from one of Australia's most creative companies" (FB/IG, 2025-12-02)

> "the kind of set that keeps the crowd guessing" (FB/IG, 2025-12-05)

> "Big vocals, big personality, and a setlist that swung from rock to pop to pure party" (2025-12-02)
> — rule of three, twice in one sentence.

> "It was part garage-rock party, part karaoke cathedral, part glitter inspection report."
> (FB/IG, 2026-06-16) — the most conspicuous rule-of-three in the corpus.

> "riffs, nostalgia, survival and group shouting" (FB/IG, 2026-06-18)

**"It's not X, it's Y" — the Sydney 2025 wrap.**

> "Battle of the Tech Bands **isn't just another corporate event** — it's about showing what happens
> when our industry turns up… and then turns up the volume. 🔊
>
> It's about real people playing real music for real audiences.
> **It's about anthems not algorithms, chords not code reviews, and basslines not burndown charts.**"
> (FB/IG, 2025-11-11)

That is the construction, the rule of three, and an em dash, in four consecutive lines. It is also
the most quotably wrong paragraph in the corpus — and note it was published under the brand account
about the brand.

**Emoji bookends.** Endemic in eras C and D:

> "🤘 From keyboard warriors to rock gods! 🤘" (2025-11-11)
> "🤘 The Incident Commanders (Google) — Sydney Battle of the Tech Bands 2025 🤘" (2025-12-08)
> "🎤 Epsonics – Battle of the Tech Bands 2025 🎤" (2025-09-21)
> "#bottb #canva #youngcare #sydneymusic #factorytheatre #techbands 🤘" (2025-12-02) — an emoji
> after the hashtags.

**Factual errors that shipped.** These matter more than any style rule.

| Published                             | Error                                                                                                                                    |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| FB + IG, 2026-06-24                   | "REA Group's band 'Hot Property' **from 'Mentorloop'**" — wrong company, twice, on both platforms                                        |
| YouTube ×3 (2026-06-08, 06-21, 07-07) | "recorded live at the Battle of the Tech Bands 2026 **in Sydney**" on Melbourne videos, immediately above "Venue: The Howler, Brunswick" |
| FB + IG, 2026-08-29                   | "Huge congratulations to **Total Loss Suncorp Group)**" — a broken parenthesis in the champions post, on both platforms                  |
| FB, 2026-08-29                        | "raised $3,000 for **Youngcare Youngcare**" — the mention substitution ran twice                                                         |
| IG, 2025-09-21 and 2025-09-23         | "Supporting **@@youngcareoz**" and `hashtag#BotTB25 hashtag#BattleOfTheTechBands` — a LinkedIn copy pasted into Instagram unmodified     |
| YouTube, 2026-08-20                   | Description ends "…bottb.com/event/brisbane-2026 **See less**" — UI text captured into the description                                   |
| FB + IG, 2024-02-01                   | "**there** aptly named band SoundU" (FB only; the Instagram version says "their")                                                        |

The Melbourne "from Mentorloop" error and the Brisbane "Total Loss Suncorp Group)" error are the same
failure mode: a caption assembled by substitution, published without a read-through. The runbook
already has the fix for this ("**Always `--dry` first** and read the rendered caption for both
platforms") — it was written after this exact class of bug, and these are its evidence.

### 2.2 Where the corpus holds up

**The Brisbane 2026 reel series (2026-08-31 → 2026-09-08, 28 posts) passes the rubric cleanly.**
Zero em dashes, zero invented crowd reactions, zero "it's not X it's Y", no emoji bookends, no
self-mention. It is the best-written run in the corpus and it is model-drafted. The rubric works.

The strongest single post:

> "Total Loss (Suncorp), first time on a BotTB stage after twelve years of playing together.
>
> Back in the U.S.S.R., Gold on the Ceiling, Message in a Bottle, We Can Get Together, Sultans of
> Swing, Paint It Black with a sax, and Gen-X TV on the screen behind them. And a 16-year-old drummer
> (the bass player's son) who is the youngest person ever to play a BotTB. Top song-choice score of
> the night." (FB, 2026-09-04)

Everything in it is checkable: a setlist, an instrument, a backdrop, a relationship, a record, a
score. No adjective is doing work a fact could do.

And the best opening line in the corpus, from the same run:

> "An erhu in the line-up and bubble wands out over the floor. ShipReX went on third in full pirate
> gear and finished the night holding the trophy." (FB/IG, 2026-09-07)

That is the "lead with a detail someone in the room would recognise" rule executed exactly.

**The best human writing predates all of it.** The Sydney 2025 backstage series (late Oct 2025) is
specific, funny and observed, and one post contains something no model could have invented:

> "Earlier in the night while we were stressing through the inevitably late soundcheck, 'The Special
> Guests' nailed theirs in about 5 minutes and put us back on track. Thanks guys. You were total
> pros!" (FB/IG/YT, 2025-10-30)

That is first-person "we", a detail only an organiser has, and a genuine thank-you. It is the single
best paragraph in 466 posts.

Also strong, and characteristically human in its willingness to have an opinion:

> "Canva's set opened hard with 'Are You Gonna Be My Girl' by Jet, and the follow up promise from
> this next song — 'We're going to take it down a notch' — proved to be one of the least honest
> statements made in the whole Sydney gig." (IG/FB, 2025-11-09)

> "Despite an early SEV1 incident with an uncooperative keyboard, they recovered in time to deliver
> this outstanding performance." (FB/IG, 2025-11-03)

> "one cheeky sound engineer had them as a write-in on the voting form - with full marks!"
> (FB/IG, 2026-06-15)

### 2.3 Where the rules are wrong, versus where they were not followed

Worth separating, because the fixes differ.

**Not followed (the rule is right):** em dashes, invented crowd reactions, rule-of-three, "it's not
X it's Y", emoji bookends, factual accuracy. All of these are real defects and all are avoidable.
The Brisbane 2026 run proves compliance is achievable at speed.

**The rule is under-specified:** "no emoji bookends" is stated as a sentence-level rule, but the
corpus's actual working pattern is a _labelled line_ — `📅 Thursday 27 August`, `📍 The Triffid`,
`🎟️ Tickets:`, `⚡ Powered by Jumbo Interactive Limited`, `💛 All proceeds to Youngcare`. Those are
not bookends, they are icons in a key, they appear in the best posts as well as the worst, and they
should be explicitly blessed rather than left to be argued about each time.

**The rule may be too strict:** "first-person 'we'" is honoured in about a third of posts. The
dominant register across the whole corpus is third-person reportage of the bands ("Epsonics opened
the night", "Their set moved from indie-rock swagger to 80s polish") with "we/our" reserved for the
organisation's own actions ("our national sponsor", "we were stressing through the soundcheck",
"still one of our favourite moments"). That split is good practice and is what actually happens.
The rule should say so: **third person for the bands, first person for us.**

---

## 3. House style as it should be written

Distilled from the posts that hold up, not from the average.

### 3.1 Structure

The strongest shape, used by every good post in the corpus:

1. **A concrete detail from the room, in the first sentence.** An instrument, a costume, an object, a
   number. "An erhu in the line-up and bubble wands out over the floor." "On as chanting monks in LED
   masks." "Ten members. Two companies. One erhu."
2. **The band, its company, and one hard fact.** Placing, score, debut, streak, years together.
3. **The setlist**, as a run-on sentence for a reel, or a plain list for a photo post. Never
   emoji-bulleted (see below).
4. **Sponsor and charity**, in fixed wording, at the bottom.
5. **Hashtags**, last, on their own line.

Caption length that works: **300–600 characters on Facebook and Instagram**. Median by era: 2024
229, 2025 199, Melbourne 352, Brisbane 2026 **520**. The longest era is also the best-performing one.
Below ~150 characters the post says nothing ("Rosanna - Toto - Live cover performed by Atlassian",
FB+IG 2025-11-28, 3 likes). Above ~800 it is a press release.

### 3.2 The fixed blocks

These are stable across 2025 and 2026 and should not be reinvented per post.

**Sponsor.** The correct form, and the only one to use:

> Proudly powered by Jumbo Interactive.

The legal name **Jumbo Interactive Limited** is required when the Facebook or LinkedIn page is being
tagged (the runbook confirms `@Jumbo Interactive` does not resolve). Earlier variants that drifted
and should not be revived: "Powered by Jumbo Interactive", "our major sponsors Jumbo Interactive",
"⚡ Battle of the Tech Bands is powered by Jumbo Interactive Limited", "National Sponsors".

**Charity.** The full line, which is the version Dean has settled on:

> All proceeds to Youngcare, supporting young Australians with high care needs to live with more
> choice, freedom and dignity.

Short form when space is tight: "All proceeds to Youngcare." Instagram uses `@youngcareoz`. The
YouTube form is "Youngcare (@YoungcareOz)". Older drifted variants: "empowering young Australians
with high care needs to live with choice and independence", "helping young adults with high physical
support needs", "high physical support needs (youngcare.com.au)" — all mean the same thing, all
should be retired in favour of the choice/freedom/dignity wording.

**Credits.** Photographers and videographers are credited by name, in the caption:

> Photos by Amy Corrie. / Photos by Ella Hasdell. / Video shot by Aaron Griffiths and Kurt Boldy.

On Instagram, handles: `@quirkylikethat`, `@kurtboldy`, `@eddyhill_gigphotography`,
`@rodhuntphotog`. "Shot by", never "video by" — that distinction is in the runbook and is honoured
in the corpus.

### 3.3 Hashtags

The set has narrowed sharply and correctly. Per-post average: 2024 **5.0** → 2025 **3.7** →
Melbourne **1.7** → Brisbane 2026 **4.2**.

The current base. `#BattleOfTheTechBands`, `#BotTB26` and `#Youngcare` appear on all 29 hashtagged
posts since 20 August 2026; `#BotTB` on 22 of them (the YouTube descriptions drop it).

```
#BattleOfTheTechBands #BotTB26 #BotTB #Youngcare
```

Plus location: `#LiveMusicBrisbane #TheTriffid` (Brisbane), `#MelbourneLiveMusic #TheHowler`
(Melbourne), `#LiveMusicSydney` (Sydney). Plus, on a single-song post, the song and artist:
`#ViolentSoho #CoveredInChrome`, `#FleetwoodMac #TheChain`.

What has been abandoned and should stay abandoned: the 2024/2025 long tails —
`#rockstarenergy #InnerRockstar #RockstarsInDisguise #UnforgettableNights #MusicMemories
#BePartOfTheCrowd #EpicPerformances #BrisbaneNightlife #factorytheatremarrickville #RockAndCode`.
Fifteen hashtags on a post with three sentences (IG, 2024-08-27) is the low point.

### 3.4 Emoji

Dropped from 2.4 per post in Melbourne to **0.9** in the Brisbane 2026 run. The Brisbane level is
right. Emoji earn their place in exactly two positions:

- **As line labels** in an event block: `📅 📍 🎟️ ⚡ 💛 📸`.
- **A single 🏆 or 🎸** where it carries meaning.

Not: bookending a headline, not decorating every setlist line (`🎶 Shiver – Coldplay`), not trailing
a hashtag block.

### 3.5 Calls to action

The corpus's CTAs, best to worst:

- **"Watch it loud."** / **"Press play. 👀"** — short, imperative, used in 2026. Best.
- **The event block** — `📅 Thursday 27 August / 📍 The Triffid / 🎟️ Tickets: <url>`. Standard
  and correct for anything pre-event.
- **"Also on YouTube: https://youtu.be/…"** — every full-video post carries it.
- "Tickets in the comments" / "Link to tickets in bio" — Instagram workarounds, still necessary.
- **"Don't believe us? Turn it up and check it out."** (2025-11-09) — over-worked; the pattern
  "Don't believe us?" appears three times and should not appear a fourth.

Note: **captions currently link to a bare URL with no UTMs**, so nothing joins back to PostHog. The
`posts` table has `utm_campaign/source/medium/content` columns and `bottb post link` builds the
tagged URL. Use it from Sydney 2026 on.

---

## 4. Per company and per band: what has been said, and what is true

Reference material for writing the next post about a returning band. Facts are preferred from
human-era posts and from the scoring sheet; **facts asserted only in a model-drafted post are marked
⚠ unverified**, because that era demonstrably shipped errors.

### Jumbo Interactive — "Jumbo Band" (Brisbane 2022–2026), "Jumbo" (Melbourne 2026)

The most-covered entity in the corpus. Both a competing band and the national sponsor, which every
caption has to hold in mind at once.

- **Inaugural 2022 champions.** Stated consistently since 2024-02-13 and never contradicted.
- **Five straight Brisbane appearances** as of 2026 (2026-07-27).
- Band formed around **2014** — "From their first jams in 2014" (IG, 2025-08-29). "You don't often
  see bands last over a decade… let alone a corporate band."
- **Third at Brisbane 2026 with the top performance score of the night** (2026-09-03).
- Recurring visual: themes. **Día de Muertos** at Brisbane 2025 (2025-10-13), **chanting monks in
  LED masks** at Brisbane 2026 (2026-09-03).
- **Guest set at Melbourne 2026**, flown in at the last minute: "agreed to jump on a plane and fill
  in a guest slot at the last minute. While not technically eligible for the competition, one cheeky
  sound engineer had them as a write-in on the voting form - with full marks!" (2026-06-15)
- Signature move: **"Take the Power Back" retooled as an anti-AI anthem, chanting "No AI, No AI"**
  (2026-06-20).
- Repertoire across years: Smoko (The Chats), Beer (Reel Big Fish), Chelsea Dagger, Mr Brightside,
  I Believe in a Thing Called Love, Take the Power Back, Bring Me to Life, Never Had So Much Fun,
  Say It Ain't So, Beat It, Chop Suey, Break Stuff, Zombie, I'll Be There for You, "Team 'Straya".
- **Four singers** at Brisbane 2026.
- How it is described: "veterans", "the original champions", "consistently delivers high-energy
  performances", "pure pub-rock velocity".
- **Sponsor handling:** name Jumbo as the band, then credit the sponsorship separately — "our
  national sponsor's own crew" (2026-09-03) is the neatest solution the corpus has found.

### Rex Software (+ URBAN X from 2026) — "The ShipRex" / "ShipReX"

- **Founding band, present at every Brisbane event since 2022.** "One of the founding bands"
  (2025-09-02).
- **Brisbane 2026 champions**, biggest crowd vote of the night (2026-09-01).
- **2026 line-up is ten people from two companies**: Rex Software plus the **Autopilot software team
  from URBAN X**. "Ten members. Two companies. One erhu."
- The **erhu** is the standing detail — no other band on any bill has one.
- **Pirate gear** in 2026; **bubble wands out over the floor**; went on **third**.
- Themed sets are their trademark: **"Night at the Movies"** at Brisbane 2025 — entrance to Eye of
  the Tiger, Danger Zone, Bang Bang, Mustang Sally, Holiday Road, and **a full choir on stage for
  Bohemian Rhapsody** (2025-09-23).
- 2023 opener: Florence and the Machine "Dog Days Are Over" and Hilltop Hoods "Nosebleed Section"
  (2024-04-15).
- 2026 set: Careless Whisper into Uprising, Espresso, Dumb Things, Everlong, **Covered in Chrome**
  (Violent Soho, a Brisbane band, closing a Brisbane gig).
- **Name and id trap:** the band is now written **ShipReX**; earlier posts say "The ShipRex". The
  database id is frozen as `the-shiprex-brisbane-2026`. Also `shiprex-sydney-2026` — they are
  returning as **special guests at Sydney 2026**.
- Organiser **Scott Warren** drums for them and sang Mustang Sally at Brisbane 2025: "Battle of the
  Tech Bands Organiser and spiritual leader Scott Warren blew the roof off when he stepped out from
  behind the drums for the first time" (2025-10-11). ⚠ "blew the roof off" is an invented crowd
  reaction; the fact underneath (he stepped out from behind the drums) is good.
- Handles: `@rex_software`, `@urbanx.io`.

### Epsilon — "The Epsilon Band" (2024), "Epsonics" (2025, 2026)

- **Debuted 2024**; the band name changed to Epsonics for 2025.
- Brisbane 2024 set: Lonely Boy (Black Keys), Take Me Out (Franz Ferdinand), I Will Wait (Mumford &
  Sons), What Was I Made For? (Billie Eilish). "The lead singer's vocal range was off the chain."
- Brisbane 2025: **opened the night**, three vocalists trading leads. Shiver, Everybody Wants to Rule
  the World, The Less I Know the Better, Southern Sun, Sweet Disposition, Knights of Cydonia.
- Brisbane 2026: **full Severance theme**, walking on out of a blackout to the show's title music.
  **Highest judges' score of the night, second overall by two points.** Keytar. Closed on **The Chain
  in three-part harmony**.
- Standing descriptor: **vocals**. "Powerhouse vocals", "three powerhouse vocalists", "a wide range
  of vocal talent". This is the true through-line and should stay.
- Handle: `@epsilonmarketing`. Note the trap from the runbook — a bare `@epsilonmarketing` on its own
  line renders as an orphan "Epsilon" on Facebook; fold it into a sentence.

### For The Record (FTR) — "Off the Record"

- **Won Brisbane 2025 on debut.** "Newcomers from For the Record took out the 2025 crown."
- Returned to defend at Brisbane 2026: **60s dress, two lead singers up front**. Just a Girl,
  Immigrant Song, It's All Coming Back to Me Now, Barracuda, It's My Life, Never Miss a Beat.
  **Crowd-vibe score second only to the winners.**
- "**Fay's turn on the Celine Dion** was the one everyone was talking about" (2026-09-05).
- 2025 signature song: **"Off My Face" (Måneskin)**, and I Love Rock n Roll.
- The company line, used to good effect: "**Thirty years of putting courtroom testimony on the
  record. One night a year going off it - no transcripts, no timestamps, no objections.**"
  (2026-08-14) — the best company-pun in the corpus.
- ⚠ **The decade theme was published wrong once.** The runbook records "70s theme (NOT 60s — got
  this wrong once)"; the 2026-09-05 caption says "full 60s dress". Check with Dean before repeating
  either.

### Suncorp — "Total Loss" (Brisbane 2026, debut)

- **Twelve years playing together before their first BotTB.**
- **Top song-choice score of the night.**
- **16-year-old drummer, the bass player's son — the youngest person ever to play a BotTB.**
- Set: Back in the U.S.S.R., Gold on the Ceiling, Message in a Bottle, We Can Get Together, Sultans
  of Swing, Paint It Black **with a sax**, over **Gen-X TV on the screen behind them**.
- Pre-event framing: "the great unknown of this year's Brisbane line-up".
- Handle: `@suncorp`. The champions post rendered them as "Total Loss Suncorp Group)" — the correct
  parenthetical is "Total Loss (Suncorp)".

### foundU — "SoundU" (2022, 2023), "The Fuggles" (2024)

- **2023 champions** with a **Beastie Boys set that included a dancing robot** (2024-02-01).
- **2024 champions** as The Fuggles, with an "**absolutely unhinged**" cover of The Wiggles'
  "Wake Up Jeff!" (2026-01-25) — still one of the best-performing archive videos, 1,174 YouTube views.
- Handle: `@foundu_hq`. Not on the bill since 2024.

### Felix Software — "Felix Band" (Brisbane 2024, debut)

- Powderfinger "(Baby I Got You) On My Mind", Sex on Fire, and "their crowd masterpiece", Shania
  Twain's "I Feel Like A Woman!" (as published). "They were newbies… and boy did they nail the vibe."
- Handle: `@felix.marketplace`.

### Salesforce — "The Agentics" (Sydney 2025)

- **Sydney 2025 champions**, from the closing slot: "By the time The Agentics hit the stage, it was
  late and the crowd was starting to fade." Won "by the barest of margins".
- Named players: **Harrison Stewart-Weeks** (drums), **Larry Samuels** (guitar), **Holly Dean**
  (vocals). Naming individuals is a good habit from this era and worth reviving.
- Set: Seven Nation Army, One Way or Another, Dumb Things, Just Like Heaven, Hit Me With Your Best
  Shot, Just a Girl.

### Amazon — "Jamazon" (Sydney 2025), "Amakazaam!" (Sydney 2026)

- **Sydney 2025 runners-up**, second overall.
- Put the set together **in about four weeks**.
- **Confetti cannons**, multimedia backdrops, choreographed moves, **an Alexa voice intro**.
- **"an early SEV1 incident with an uncooperative keyboard"** — the best tech joke in the corpus.
- Named players: **Keira Daley** (lead vocal), **Jeanna Manifold**, **Jack Lin** (backing),
  **Joey Pangilinan** (drums), **Sam Matthews** (bass), **Mark Chamberlain** (keys).
- Set: Jump medley (Van Halen / Kris Kross / House of Pain), Tainted Love, If You Were the Rain →
  Umbrella mashup, APT, Stand By Me, Somebody to Love.

### Atlassian — "Bandlassian" (Sydney 2025, Sydney 2026)

- **Opened Sydney 2025. Third overall, first in the crowd vote.**
- **One of the largest line-ups in the competition**; horns.
- **Two Toto songs** — Rosanna and Africa. "tight grooves that would make Jeff Porcaro proud."
- Also Learn to Fly, Somewhere Only We Know, September.

### Canva — "The Canvanauts" (Sydney 2025, Sydney 2026)

- **Second in the popular vote, five votes behind Bandlassian.** The corpus openly asks whether they
  should have placed higher: "Should they have ranked higher in the overall placings? If the post-gig
  chatter is anything to go by, plenty thought so."
- Set: Are You Gonna Be My Girl (Jet), Anti-Hero (**the Pendulum arrangement**, "a surprisingly heavy
  take"), Valerie, I'm Still Standing, Don't Stop Me Now.
- ⚠ One post credits "Are You Gonna **Go** My Way – Jet" (2025-12-02). The song is "Are You Gonna
  **Be My Girl**"; "Are You Gonna Go My Way" is Lenny Kravitz, played by Mentorloop at Melbourne.
  Two errors in one line.

### Google — "The Incident Commanders" (Sydney 2025)

- **Made up largely of SREs.** Wore **high-vis**. Played the **second-last slot**.
- The framing is excellent and reusable: "a set that doubled as a **love/hate ode to SRE life**",
  "a love/hate letter to life holding the pager", "an on-call rotation in musical form".
- Set: Bohemian Like You, Song 2, Don't Start Now, Call Me Maybe, Dumb Things, Used to Be in Love.

### Banjo – Business Loans — "The Special Guests" (Sydney 2025)

- **Hair-metal costumes, 80s/90s set.** "big hair and big riffs", "a touch of dad-band magic".
- Named: **Joe Purcell** (drums), plus Joe, Mark, Justin, B.J. and Dave backstage.
- The soundcheck story (§2.2) is the definitive Special Guests fact.
- Set: Mr Brightside, Boys in Town, Hot Chilli Woman, Rebel Yell, The Boys of Summer.

### SEEK — "Fully SEEK" (Melbourne 2026)

- **Melbourne 2026 champions.** Played the **penultimate** slot.
- **Singer-led, R&B and late-night pop rather than guitars.** "This was not a setlist anyone could
  hide inside."
- Set: Where Is My Husband (Raye), Lose Control (Teddy Swims), Michael Jackson medley
  (P.Y.T. / Billie Jean / Thriller), **Cry Me a River** as the closer — "it sealed the deal for the
  judges".
- The MJ medley is the single best-performing Facebook video in the corpus (**949 views**).

### REA Group — "Hot Property" (Melbourne 2026)

- **Third set of the night.** Backdrops, **costume changes and bubble machines**.
- Set: Sk8er Boi, Are You Gonna Be My Girl, Murder on the Dancefloor (**Royel Otis version**),
  What's My Scene, **Golden (Huntr/x)**, Livin' on a Prayer as the closer.
- The property puns are the house joke: "serious curb appeal", "they absolutely moved in",
  "glitter inspection report", "🏡".
- ⚠ Published once as "REA Group's band 'Hot Property' **from 'Mentorloop'**" (2026-06-24). Wrong.

### Mentorloop — "Loop, There It Is" (Melbourne 2026)

- **Melbourne 2026 runners-up. Closed the night.**
- Concept: the set is **a love story told in covers**. "the mentoring framework we all deserved".
- Set: Are You Gonna Go My Way (Lenny Kravitz), Fell in Love With a Girl, Torn (**the
  Kontrollverlust arrangement**), You Give Love a Bad Name, I Will Survive (**Me First and the
  Gimme Gimmes version**), Am I Ever Gonna See Your Face Again.
- Best-performing YouTube video in the corpus (1,697 views, You Give Love a Bad Name).
- **Punctuation trap:** the band row says "Loop There It Is"; every caption writes "Loop, There it
  is". Both spellings appear in published posts.

### Open Universities Australia — "Continuously Groovin'" (Melbourne 2026)

- **Opened Melbourne 2026.** Twin guitars **plus violin**.
- "showcased their **dancefloor syllabus**" — the education pun is the house joke here.
- Set: Take Me Out, Everybody Wants to Rule the World, Superstition, Dancing in the Moonlight,
  When You Were Young, Murder on the Dancefloor.
- Handle: `@openunisau`. The apostrophe in "Groovin'" is dropped as often as it is used.

### CitrusAd / Citrus Band (Brisbane 2023)

- Debuted 2023 with "incredible vocal harmonies and mesmerising guitar work"; **"Running Up That
  Hill"**. Announced for 2024 (2024-04-17) but appears in the DB only under Brisbane 2023 as
  "Citrus Band", company `epsilon`.

### Recurring non-band people

- **Matt Hunt** — MC/"skipper" at Brisbane 2024: "He doesn't stop. He keeps the energy alive all
  night long." `@matthew__hunt`
- **Scott Bimrose** — MC, Melbourne 2026: "for keeping the night moving, the energy up, and the chaos
  just organised enough to feel intentional".
- **Scott Warren** — organiser, drums for ShipReX.
- **Lisa Blair OAM** — 8× world-record solo sailor; donated a **$12,000, 3-hour, 10-person Sydney
  Harbour sailing experience** raffled at Sydney 2025. Won by **Anthony Hackett**. Vessel:
  _Climate Action Now_.
- Photographers: **Amy Corrie** (Brisbane 2026), **Ella Hasdell** (Melbourne 2026), **Eddy Hill**
  `@eddyhill_gigphotography` and **Rod Hunt** `@rodhuntphotog` (Sydney 2025), **Renee Andrews**
  `@reneeandrewsphotography` (Brisbane 2024).
- Videographers: **Aaron Griffiths** `@quirkylikethat`, **Kurt Boldy** `@kurtboldy`.

### Venues

- **The Triffid**, Newstead — Brisbane, every year. `@thetriffid`
- **The Factory Theatre**, Marrickville — Sydney 2025. `@factory_theatre`
- **Howler**, Brunswick — Melbourne 2026. `@howlermelbourne`
- **Manning Bar** — Sydney 2026, 8 October.

### Attendance and money

- Brisbane 2024: "**Record Crowds with close to 400 people**".
- Sydney 2025: "**our biggest event ever, with just shy of 500 attendees**".
- Brisbane 2026: "a full room at The Triffid"; **the raffle alone raised over $3,000 for Youngcare**.
- Mane Consulting supported 2024 (`@maneconsulting`); Jumbo Interactive has been the national sponsor
  since 2025.

---

## 5. Per event: cadence and volume

| Event          | Matched posts | Window                  | FB / IG / YT | Shape                                                    |
| -------------- | ------------- | ----------------------- | ------------ | -------------------------------------------------------- |
| Brisbane 2023  | 3             | 2023-08-24 → 2024-02-01 | 1 / 2 / 0    | One post on the night; the rest are 2024 retrospectives  |
| Brisbane 2024  | 53            | 2024-01-25 → 2026-01-25 | 28 / 24 / 1  | Slow drip Jan–Aug, burst in the week after               |
| Brisbane 2025  | 68            | 2025-05-27 → 2025-12-17 | 29 / 27 / 12 | Long tail; content still going out 3 months later        |
| Sydney 2025    | **141**       | 2025-10-02 → 2026-07-08 | 62 / 60 / 19 | The biggest campaign by far; nine months of tail         |
| Melbourne 2026 | 102           | 2026-05-17 → 2026-09-03 | 37 / 33 / 32 | Tight: 3 weeks of promo, 6 weeks of recap, heavy YouTube |
| Brisbane 2026  | 59            | 2026-07-27 → 2026-09-08 | 26 / 20 / 13 | Most compressed; 5 band announcements, then a reel a day |
| **Unmatched**  | 40            | 2024-01-25 → 2026-08-31 | 27 / 13 / 0  | Brand posts, dual-city teasers, image-only posts         |

**Cadence patterns that recur:**

- **Band announcements**, one per day, numbered, in the month before. Brisbane 2026 ran
  `🚨 BAND ANNOUNCEMENT #1…#5 🚨` on 27–31 July. Melbourne ran the same pattern unnumbered
  ("Meet…", "Introducing…") on 17–21 May.
- **A reel per band, one per day, in the week after.** Brisbane 2026: night highlights 31 Aug, then
  ShipReX / Epsonics / Jumbo / Total Loss / Off the Record on 1–5 Sep. Melbourne ran the equivalent
  as photo posts on 14–18 June.
- **Then single-song videos, slowly, for months.** Sydney 2025 was still publishing performance
  clips in July 2026, nine months after the event.
- **A cross-post pattern that is now fixed:** YouTube first (07:00 UTC), then Facebook and Instagram
  within 1–2 minutes of each other (08:00 UTC / 18:00 AEST). Facebook and Instagram carry the same
  caption with company names swapped for handles on Instagram.
- **A daily-slogan filler campaign** (May–June 2025, 18 posts) with no facts in it —
  "Dare to dream. Be the rockstar.", "Hit hard. Shine louder." Those posts are the corpus's lowest
  engagement and lowest information. Do not repeat that format.

---

## 6. What changed, what stayed

**Changed, for the better:**

- Hashtags: 5.0 → 4.2 per post, and the tail of generic tags is gone.
- Emoji: 2.4 → 0.9 per post.
- Facts per post: from "they put on an amazing show" (2024) to a setlist, a score and a placing (2026).
- Em dashes: 23 posts in the Nov-2025 peak, zero since May 2026.
- Caption length: median 199 (2025) → 520 (Brisbane 2026).
- Setlists moved from emoji-bulleted lists to prose or plain lists.

**Changed, for the worse or sideways:**

- Named individuals disappeared. Sydney 2025 named twelve musicians by name; Brisbane 2026 names two
  (Fay, and the 16-year-old drummer, unnamed). Naming people is the highest-value thing the corpus
  ever did and it got dropped.
- "Backstage with…" interviews (Sydney 2025) were a distinct, well-performing format and have not
  recurred.
- Publishing times narrowed to a single scheduled burst, which is better for consistency but destroys
  the natural experiment that the older, scattered posting gave us.

**Consistent throughout:**

- Every post credits the sponsor and the charity. No exceptions in 466 rows.
- Band = company. The band's name and its company are always in the same breath: "Epsonics
  (Epsilon)", "Total Loss from Suncorp", "The Agentics (Salesforce)".
- Facebook gets plain company names, Instagram gets handles. Same caption otherwise.
- The event block (`📅 📍 🎟️`) for anything pre-event.
- Warmth toward every band, winners and not. There is no post in the corpus that is unkind about a
  performance, and several that go out of their way ("Should they have ranked higher? plenty thought
  so"). That is the brand's actual voice and it has never wavered.

---

## 7. A template that would have passed review

Assembled from the parts that work, for a returning band's post-event reel:

```
[Concrete detail from the room, first sentence. Instrument, costume, object, or number.]

[Band] ([Company]), [one hard fact: placing, score, streak, debut, years together].
[Setlist as a run-on sentence.] [One more checkable detail.]

Watch it loud. Also on YouTube: https://youtu.be/XXXX

[Photos by NAME. / Video shot by NAME and NAME.]
Proudly powered by Jumbo Interactive. All proceeds to Youngcare, supporting young Australians
with high care needs to live with more choice, freedom and dignity.

#BattleOfTheTechBands #BotTB26 #BotTB #Youngcare #LiveMusicBrisbane #TheTriffid
```

Checks before it goes out, every one of which has caught a real defect in this corpus:

1. Read the rendered caption for **both** platforms. The `@handle` swap has produced an orphan line
   and a doubled "Youngcare Youngcare".
2. Count the parentheses.
3. Confirm the company is the right one. "Hot Property from Mentorloop" shipped to two platforms.
4. Confirm the city. Three YouTube descriptions call a Melbourne gig Sydney.
5. Search for `—`, "the moment", "the room erupted", "isn't just", "the kind of".
6. Every claim about the room is either from the scoring sheet or was seen. If neither, cut it.

---

## Appendix — how the harvest matched posts to events

`bottb harvest` scores every event against each post and requires a clear winner. Slug in a URL is
worth 5, "City <year>" in proximity 3, a year that identifies a sole event that year 3 (dropping to 1
when the year is named more than 200 days from the event, so a retrospective aside cannot outrank the
subject), a band name 2, a company that plays only one event 1, and date proximity 1.5. High
confidence needs a score of 5 and a margin of 2.

Result: **303 high, 76 medium, 47 low, 40 unmatched.** The unmatched are almost entirely brand posts
with no event in them ("Season's greetings", the website launch) and the May 2025 dual-city teasers
that advertise Brisbane and Sydney equally — correctly refused rather than guessed. Bands are
assigned only when exactly one band from the winning event is named: **317 of 466**.

Two things the matcher gets right that a simpler rule would not: the Brisbane 2026 champions post,
which names four Sydney 2026 companies and a Sydney date in its closing paragraph, and the
2025-09-02 ShipRex promo, which opens "From the very first Battle of the Tech Bands in 2022".

Where the harvest and the Brisbane 2026 log backfill overlap (14 rows), the times agree to within 90
seconds on 11 of 13 comparable rows. Three differ: two Instagram posts by 2 and 6 minutes, and the
Epsonics "The Chain" YouTube upload by 41 minutes (log 15:47 AEST, platform 15:06 AEST). **Prefer the
harvest in all three cases** — the log's times are marked `posted_at_estimated`, the harvest's are
read back from the platform. The backfill's LinkedIn and TikTok rows (10 each) are the only record of
those platforms and must not be dropped.
