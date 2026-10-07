# Off the Record — "It's All Coming Back to Me Now" — social copy

Battle of the Tech Bands Brisbane 2026, The Triffid, 27 August 2026. Set 1, song 3.
Band: Off the Record (For The Record / FTR house band). Two lead vocalists, Becca and Fay.
**Fay sings this one** — that is the hook Dean asked for.

Publication: Mon 21 Sep 2026. YouTube 07:30 (peer session deapovey-eb).
Facebook 18:00, Instagram 18:00 (this session).

Dean's steer, verbatim: "we particularly want to say Fay was very nervous taking on this power
ballad in front of a big crowd, but it was her moment to shine, and she killed it."

Format is lifted from the two shipped precedents (Sultans of Swing, Bring Me to Life) read back
from the Graph API, not from memory. Do not improvise the structure.

## Dependency — UNRESOLVED, DO NOT POST

**`https://youtu.be/AUjRxVFrMnc` is a placeholder and both captions are UNPUBLISHABLE until it is replaced.**

**`zgtbqLOIOBU` must NEVER be used again.** It is permanently UNLISTED and carries the v6 audio
with the guitar 1090.8 ms out. Dean's decision is that it stays unlisted rather than being deleted,
so the id continues to resolve — a caption referencing it would link a video the public cannot open,
carrying a mix that was withdrawn. The privacyStatus gate refuses it (verified: returns `unlisted`),
but do not rely on the gate to catch a mistake that should not be made.

v7 needs a FRESH upload and a new id because YouTube cannot replace a video file. Dean is uploading
it by hand — there is no upload OAuth, only the read-only key, and the browser tool caps at 10 MB
against 1.19 GB.

When the new id exists, substitute it everywhere `https://youtu.be/AUjRxVFrMnc` appears and verify BEFORE posting:

```bash
K=$(grep '^YOUTUBE_API_KEY=' .env.local | cut -d= -f2- | tr -d '"')
curl -s "https://www.googleapis.com/youtube/v3/videos?part=status,contentDetails&id=<NEW_ID>&key=$K"
```

Require `status.privacyStatus == "public"` AND `contentDetails.regionRestriction` either absent, or
with AU outside `blocked` / inside `allowed`. **oEmbed is NOT a visibility check** — it returns 200
for unlisted videos too (verified: public `8YIPtpb5-0s` 200, unlisted `zgtbqLOIOBU` 200, deleted
`Fof1cfAv_g0` 404). It only separates exists from deleted.

Title stays "Celine Dion - It's All Coming Back to Me Now - Off the Record - BoTTB Brisbane 2026"
(83 chars, inside the 100 cap).

Facebook takes the full `https://youtu.be/...` URL; Instagram takes the bare `youtu.be/...`, matching
the shipped precedents (nothing is clickable in an IG caption either way).

## Facebook (18:00 AEST) — names only, no @handles

The Graph API cannot @-tag other Pages, so every handle is written as a plain name. Full URLs here,
unlike Instagram.

```
Off the Record — For The Record's house band — play Celine Dion's "It's All Coming Back to Me Now" live at Battle of the Tech Bands Brisbane 2026, The Triffid.

Off the Record have two lead singers and this one is Fay's. She was nervous about taking on a Celine Dion power ballad in front of a room that full, and she killed it.

Watch it on YouTube: https://youtu.be/AUjRxVFrMnc
Every photo from the night: https://www.battleofthetechbands.com/photos?event=brisbane-2026

Video shot by Aaron Griffiths and Kurt Boldy. Live audio by Nick Forrester.
Proudly powered by Jumbo Interactive. Brisbane raised over $3k for Youngcare.

Sydney is next. Thursday 8 October at Manning Bar, with bands from Atlassian, Canva, Amazon and V2 AI, and Brisbane champions ShipReX joining as special guests. Tickets at battleofthetechbands.com

#BattleOfTheTechBands #BotTB26 #BotTB #Youngcare #LiveMusicBrisbane #TheTriffid
```

## Instagram (18:00 AEST) — handles, bare domains

```
Off the Record — For The Record's house band — play Celine Dion's "It's All Coming Back to Me Now" live at Battle of the Tech Bands Brisbane 2026, The Triffid.

Off the Record have two lead singers and this one is Fay's. She was nervous about taking on a Celine Dion power ballad in front of a room that full, and she killed it.

Full video on YouTube: youtu.be/AUjRxVFrMnc
Every photo from the night: battleofthetechbands.com/photos?event=brisbane-2026

Video shot by @quirkylikethat and @kurtboldy. Live audio by Nick Forrester.
Proudly powered by Jumbo Interactive. Brisbane raised over $3k for @youngcareoz.

Sydney is next. Thursday 8 October at Manning Bar, with bands from Atlassian, Canva, Amazon and V2 AI, and Brisbane champions ShipReX joining as special guests. Tickets at battleofthetechbands.com

#BattleOfTheTechBands #BotTB26 #BotTB #Youngcare #LiveMusicBrisbane #TheTriffid
```

IG collaborators: `quirkylikethat`, `kurtboldy`, `youngcareoz`.
For The Record has **no Instagram** (handles table: "LinkedIn only"), so the band's company cannot
take the third slot. Never `jumbointeractive` (no IG, refused 14 Sep, killed the whole container)
and never `thetriffid` (never accepts). Probe each handle with a throwaway container first — a
single bad handle fails the entire create, and error 2207066 names only the first one.

## Notes on the copy

- **"Video shot by", not "Filmed by".** The runbook rule is explicit: they shot the full videos and
  edited the reels, so it is "shot by", never "video by". The shipped Sultans caption gets this
  right; the shipped Bring Me to Life caption says "Filmed by" and is the odd one out. The peer's
  YouTube draft also says "Filmed by" — worth fixing there.
- **"Live audio by Nick Forrester" is on both shipped reels** and is missing from the peer's
  YouTube draft. It should be on every video post.
- **No full-set line.** Dean confirmed there is no full set video for this band.
- The draft handed over asserted Fay "had never taken on a power ballad in front of a crowd this
  size". Dean did not say that — he said she was nervous taking on this one. Invented detail is
  exactly what the runbook's copy rules forbid, so the caption stays inside what Dean actually said.

## LinkedIn — MINE TO POST. Dean drops the file, I do the rest

**File: `1080p endcard v3`, 321,511,143 bytes** — NOT the IG file. LinkedIn has no 300 MB cap.
**Dean must drop it into THIS session's tab group (1188498002), not another session's** — tabs in a
different Claude group are invisible here and Chrome refuses to drag a tab across groups.

Verified this session: logged in as Battle of the Tech Bands page admin (104393733).

### Caption

```
Off the Record are the house band at For The Record (FTR), and this is them playing Celine Dion's "It's All Coming Back to Me Now" at Battle of the Tech Bands Brisbane 2026.

Two lead singers in that band, and this one is Fay's. She was nervous about taking on a Celine Dion power ballad in front of a room that full, and she killed it.

Watch it on YouTube: https://youtu.be/AUjRxVFrMnc

Battle of the Tech Bands is Australia's tech-industry band competition: house bands from six companies played The Triffid on 27 August, and the night raised over $3k for Youngcare.

Video shot by Aaron Griffiths and Kurt Boldy. Live audio by Nick Forrester.
Proudly powered by Jumbo Interactive Limited.

Sydney is next: Thursday 8 October at Manning Bar, with bands from Atlassian, Canva, Amazon and V2 AI, and Brisbane champions ShipReX joining as special guests. Tickets at battleofthetechbands.com

#BattleOfTheTechBands #BotTB26 #Youngcare
```

### The three mandatory chips, each appearing exactly ONCE, in typing order

Deliberate: one occurrence each keeps the chip count at the minimum, because every chip is a chance
for the caret trap to eat something.

| order | query to type     | pick                                                                        | expected `data-entity-urn` |
| ----- | ----------------- | --------------------------------------------------------------------------- | -------------------------- |
| 1     | `@For The Record` | For The Record (FTR)                                                        | `81140`                    |
| 2     | `@Youngcare`      | Youngcare                                                                   | `307122`                   |
| 3     | `@Jumbo`          | Jumbo Interactive Limited (NOT Jumbo Supermarkten / Jumbo Retail Groceries) | `1517297`                  |

Method, and it is the HARD RULE — the 8 Sep post shipped with the major sponsor in plain text
because this was not followed:

1. Type forward up to and including the short `@Query`. **Short** — `@Jumbo Interactive Limited`
   returns nothing, `@Jumbo` returns the list.
2. **MOUSE CLICK the row.** Down+Return inserts plain text instead of a chip.
3. **`cmd+Down` then `End`** before any other keystroke — the caret lands inside the chip.
4. **Never screenshot or run JS between taking a chip and the next keystroke** — the caret snaps
   back and a BackSpace eats the chip.

Verify before posting:
`document.querySelector('.ql-editor').querySelectorAll('[data-entity-urn]').length` must be **3**,
the urns must match the table, and `ed.innerHTML.match(/@<a/g)` must be null (no stray `@`).

**After posting, verify the link resolves to the NEW video id** — LinkedIn rewrites URLs to
`lnkd.in/<hash>` on save, so substring-matching `youtu.be` returns false and looks like a failed
edit. Follow the shortened link.

## TikTok — MINE TO POST, scheduled 20:00

**File: `1080p endcard v3`, 321,511,143 bytes.** Same tab-group rule as LinkedIn.
Verified this session: logged in as `@bottb0`, Upload present in the sidebar.

**20:00 is Dean's standing preference, not a drift.** The runbook records 19:00 as the Sultans
precedent and warns that a 20:00 slot was once inferred wrongly — but Dean has now chosen 20:00
twice, explicitly overriding 19:00 once. Schedule 20:00 and do not re-litigate it.

Navigate via `tiktok.com/explore` then click **Upload** in the sidebar — direct navigation to
`/upload` or `/tiktokstudio/*` hits a bot check that never resolves. Location: **The Triffid**.
Both Music copyright check and Content check lite are **ON by default**; confirm each reads
"No issues found" rather than hunting for a switch. **Confirm the character counter** before
scheduling — on 10 Sep a post published with no description because the text never registered.
**Scheduled TikTok posts cannot be edited**, so the time must be right first go.

```
Off the Record — For The Record's house band — play Celine Dion's "It's All Coming Back to Me Now" live at Battle of the Tech Bands Brisbane 2026, The Triffid.

Two lead singers in that band, and this one is Fay's. She was nervous about taking on a Celine Dion power ballad in front of a room that full, and she killed it.

Full video on YouTube: youtu.be/AUjRxVFrMnc

Video shot by Aaron Griffiths and Kurt Boldy. Live audio by Nick Forrester. Proudly powered by Jumbo Interactive. Brisbane raised over $3k for Youngcare.

Sydney next: Thursday 8 October, Manning Bar. Tickets at battleofthetechbands.com

#BattleOfTheTechBands #BotTB26 #BotTB #Youngcare #LiveMusicBrisbane #TheTriffid #brisbanemusic #livemusic #techbands
```

Videographer credits are **plain text, not handles** — the handles table has no TikTok entries for
Aaron Griffiths or Kurt Boldy, and a guessed handle renders as dead text that credits nobody.

## FOR DEAN, MONDAY MORNING — one decision needed on Instagram

**Facebook is safe.** Scheduled natively through the Graph API, fires at 18:00 whether or not any
Claude session is alive. Nothing needed from you.

**Instagram cannot be guaranteed, and you should know that before 18:00 rather than at 18:05.**
There is no Instagram scheduling API. Publishing has to be triggered by something alive at the slot,
and a session cron dies with its session. It is also _late_ even when it works: Sultans of Swing was
set for 17:28 on 16 Sep and actually published at 21:28 — four hours late, and nobody noticed for
five days.

Three ways to close it, your call:

| Option                                                   | Timing                                                                                | Collaborator tags                                                                                                          | Effort                |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| **A. Business Suite** — you schedule the IG post by hand | Guaranteed 18:00                                                                      | **Probably lost.** Reported not to survive scheduling; you would re-invite after it publishes (Edit → Invite collaborator) | ~2 min in the morning |
| **B. Session cron** — left armed, best effort            | Fires whenever a session is next idle. Could be 18:00, could be 21:00, could be never | Kept                                                                                                                       | none                  |
| **C. You run one command at 18:00**                      | Exact, if you are at a keyboard                                                       | Kept                                                                                                                       | 10 seconds            |

For C, from the repo root:

```bash
node doc/production/scripts/ig-publish-now.mjs doc/production/otr-ig-manifest.json
```

It probes each collaborator handle alone first (one bad handle kills the whole container), builds
the container from the Blob URL, polls to FINISHED, publishes, and prints the permalink. `--dry`
prints the caption without building anything; `--probe-only` checks the handles and stops.

B is armed regardless, so C is a backstop rather than a requirement. A is the only option that
actually guarantees the slot, at the cost of the videographer tags.

**Thumbnails are yours** — you said so on Sunday night. Note YouTube's cap is 2 MB and a straight
1920x1080 PNG export runs 2.5–3 MB and gets rejected at upload; JPEG q92 lands ~0.36 MB with no
visible artefacts.

**LinkedIn and TikTok are not scheduled.** You did not ask for them and neither can be done without
you — both block the fetch-inject and the browser tool caps at 10 MB, so the file has to be dragged
in by hand. Copy and the mention plan are above if you want them.

**Facebook copyright check:** this is a Celine Dion cover and Sony holds the catalogue.
`copyright_check_status` reads `in_progress` at schedule time and that is _not_ a pass — Sultans
took ~8 h to settle to `matches_found: false`. Re-read it before 18:00:

```bash
TOK=$(grep '^META_PAGE_ACCESS_TOKEN=' .env.local | cut -d= -f2- | tr -d '"')
curl -s "https://graph.facebook.com/v21.0/<VIDEO_ID>?fields=copyright_check_status,published,scheduled_publish_time&access_token=$TOK"
```
