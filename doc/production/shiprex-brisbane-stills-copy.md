# ShipReX — Brisbane 2026 video stills (13 frames)

Second ShipReX photo post from Brisbane 2026. **These are frames pulled from the CAM A video**,
graded (`kodak_d60`) and exported, not a photographer's set. Source:
`/Volumes/BOTTB/Stills/CAM A/graded_kodak_d60/darktable_exported/shiprex_picks/`.

Dean, 24 Sep: **post everything, now, no scheduling.**

## Facts checked against the database

|             |                                                                                               |
| ----------- | --------------------------------------------------------------------------------------------- |
| Band        | **ShipReX** — Rex Software (`rex-software`) + URBAN X (`urbanx`), `the-shiprex-brisbane-2026` |
| Result      | **Brisbane 2026 winners**, The Triffid, 27 August 2026                                        |
| Next event  | Sydney 2026, **Thursday 8 October**, The Manning Bar — ShipReX return as **special guests**   |
| Beneficiary | Youngcare. Brisbane raised over $3k                                                           |
| Gallery     | 17 public ShipReX Brisbane photos already live (Amy Corrie's set)                             |

## Credit: Kurt Boldy, the CAM A operator

The earlier ShipReX post carried "Photos by Amy Corrie" and had her as an IG collaborator. **Neither
carries over** — these frames came off the video camera, so crediting her would credit the wrong
person for work she did not do.

Dean's ruling (24 Sep, via `gigstills-f6`): the credit goes to the **camera operator**, and CAM A
was **Kurt Boldy** — "Stills from the video by Kurt Boldy", `@kurtboldy`. He is a **text credit
only**, not an IG collaborator. Collaborators stay `@rex_software` and `@urbanx.io`.

This overrides the handles table, which says videographers go on video posts only and never on
photo posts. The override is sound: these frames _are_ the video.

**Facebook shipped one minute before that answer arrived, with no credit at all**, because guessing
between Aaron Griffiths and Kurt Boldy would have credited a real person for someone else's work.
The live post's message was then edited in place (`POST /{post-id}` with `message`) to add the line,
and Instagram carried it from the start. Caption text is editable after publishing; the images are
not.

## The gallery link resolves today — verified, not assumed

`/photos` supports `event`, `photographer` and `company`. **There is no `band` filter**, so the
ShipReX gallery is reached by company:

```
https://www.battleofthetechbands.com/photos?event=brisbane-2026&company=rex-software
```

Checked against production (`/api/photos?...`): **17 photos, all `visibility='public'`.** This is
the check Brisbane skipped when it ran six posts against an empty gallery. Note the link lands on
Amy Corrie's set, not these stills — that is fine and honest, it is the ShipReX Brisbane gallery,
but it is the reason the caption says "more from the night" rather than "more of these".

These 13 stills are **not** in the `photos` table and are not being ingested as part of this post.

## Aspect ratio — why 1:1

The 13 files are three different shapes:

| Shape          | Count | Pixels               |
| -------------- | ----- | -------------------- |
| 16:9 landscape | 10    | 3840x2160            |
| 9:16 portrait  | 1     | 1215x2160            |
| ~1:1           | 2     | 2159x2160, 1941x1941 |

**Every slide in one Instagram post must share an aspect ratio**, so a common crop is needed. The
extremes are 1.778 and 0.562 — _exact reciprocals_, so their geometric mean is exactly 1.000. 1:1 is
therefore the only ratio that costs both ends the same: each keeps 56% of its long axis. It is also
cheaper than the usual 4:5 house crop, which would keep only **45%** of a 16:9 frame's width.

Rendered at **1440x1440**, sRGB, ~0.5 MB each. Every crop was eyeballed on a contact sheet before
publishing — all 13 still read as the shot they came from.

## Routing

| Platform  | Asset                                                                           |
| --------- | ------------------------------------------------------------------------------- |
| Instagram | 1:1 crops, 1440x1440 — **10 of 13**, Dean's drop list                           |
| Facebook  | all 13 — shipped as 1:1 crops, see the open question below                      |
| LinkedIn  | all 13 **originals, uncropped**, long edge 2048 (6.5 MB total, one upload call) |

**Dean chose the three Instagram drops himself**: `037846`, `031349`, `034369`. I had picked
`003979`, `014050`, `037338` on the grounds that they repeat the lead singer. The two lists share
nothing — so this is not a call to pre-empt next time, just ask. Dean's instruction on the rest:
"if any of the remaining 10 are not 16:9, crop rather than swap them", which is exactly what the
1:1 render already does for the portrait and the square in that ten.

### Facebook crops — CLOSED, post stands

Dean's routing said Facebook and LinkedIn get all 13 **uncropped**. Facebook went out with the 1:1
crops, following the runbook's standing rule that Facebook matches Instagram. Dean's question —
_"if Facebook supports different photos why wouldn't we choose that?"_ — is the right one: Facebook
has neither the shared-aspect-ratio constraint nor the 10-item cap, so matching Instagram discards
pixels and whole images for nothing.

**Ruling (24 Sep): "You are good to leave it for now, do it well next time."** The post stands. The
only available fix was a delete and repost, which loses the permalink to correct a post already
live — not worth it.

What was declined is retrofitting _this_ post, not the correction. The runbook's routing table now
says Facebook takes the originals by default, and a crop only when the crop is the better picture.
The Instagram cap is an Instagram problem and must not propagate to platforms that do not have it.

## Facebook — plain names, full URLs

```
Frames pulled from the video, not the camera roll — a second look at the night ShipReX won Battle of the Tech Bands Brisbane 2026.

Rex Software and URBAN X went on third in full pirate gear, erhu and all, and finished the night holding the trophy.

Stills from the video by Kurt Boldy.

They are back on stage in Sydney. Thursday 8 October at Manning Bar, joining bands from Atlassian, Canva, Amazon and V2 AI as special guests. Tickets at battleofthetechbands.com

More from the night: https://www.battleofthetechbands.com/photos?event=brisbane-2026&company=rex-software

Proudly powered by Jumbo Interactive. Brisbane raised over $3k for Youngcare, supporting young Australians with high care needs to live with more choice, freedom and dignity.

#BattleOfTheTechBands #BotTB26 #BotTB #Youngcare #LiveMusicBrisbane #TheTriffid
```

## Instagram — handles, bare domains

```
Frames pulled from the video, not the camera roll — a second look at the night ShipReX won Battle of the Tech Bands Brisbane 2026.

@rex_software and @urbanx.io went on third in full pirate gear, erhu and all, and finished the night holding the trophy.

Stills from the video by @kurtboldy.

They are back on stage in Sydney. Thursday 8 October at Manning Bar, joining bands from Atlassian, Canva, Amazon and V2 AI as special guests. Tickets at battleofthetechbands.com

More from the night: battleofthetechbands.com/photos

Proudly powered by Jumbo Interactive. Brisbane raised over $3k for @youngcareoz, supporting young Australians with high care needs to live with more choice, freedom and dignity.

#BattleOfTheTechBands #BotTB26 #BotTB #Youngcare #LiveMusicBrisbane #TheTriffid
```

Instagram gets a bare domain because links are not clickable in a caption anyway, and a long query
string reads as noise. Facebook gets the real filtered URL, which is clickable there.

## LinkedIn

Jumbo Interactive Limited is **@mentioned** — mandatory on every LinkedIn post. Rex Software and
URBAN X are mentioned as company pages where they resolve.

```
Frames pulled from the video, not the camera roll — a second look at the night ShipReX won Battle of the Tech Bands Brisbane 2026 at The Triffid.

The team from Rex Software and URBAN X went on third in full pirate gear, erhu and all, and finished the night holding the trophy.

Stills from the video by Kurt Boldy.

They are back on stage in Sydney on Thursday 8 October at Manning Bar, joining bands from Atlassian, Canva, Amazon and V2 AI as special guests.

Tickets and the full gallery: https://www.battleofthetechbands.com

Proudly powered by Jumbo Interactive. Brisbane raised over $3k for Youngcare, supporting young Australians with high care needs to live with more choice, freedom and dignity.

#BattleOfTheTechBands #BotTB26 #BotTB #Youngcare #LiveMusicBrisbane #TheTriffid
```

## Voice notes

- **No "house band"** (Dean, 23 Sep). The bands are named by their companies instead.
- No emoji — Brisbane style.
- "erhu and all" earns its place: it is the specific detail that made the first ShipReX caption
  work, and it is visible in the frames.
- No self-congratulation: we are BotTB, so the copy praises ShipReX, never the event.

## What shipped

| Platform  | Link                                                                      | When (AEST)  |
| --------- | ------------------------------------------------------------------------- | ------------ |
| Facebook  | https://www.facebook.com/122279449718181400/posts/122283780986181400      | 24 Sep 18:24 |
| Instagram | https://www.instagram.com/p/DdqdEckoNWy/                                  | 24 Sep 18:26 |
| LinkedIn  | https://www.linkedin.com/feed/update/urn:li:activity:7508810208375255040/ | 24 Sep 18:52 |

All 13 LinkedIn originals went through `file_upload` in a single 6.5 MB call — **no dragging.** The
10 MB cap is per call and was only ever a video problem; the CSP blocker applies to the fetch-inject
route, not to `file_upload`.

TikTok was never in scope for this post.
