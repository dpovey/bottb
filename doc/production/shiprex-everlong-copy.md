# ShipReX — "Everlong" (Foo Fighters) — Brisbane 2026

Song 4 of ShipReX's winning set. Battle of the Tech Bands **Brisbane 2026**, The Triffid, Newstead,
**27 August 2026**. Cut and graded by the `Davinci Agent` session.

Dean's instruction (26 Sep, relayed): **unlisted YouTube upload first, for his QC.** Nothing else
goes anywhere until he gives a thumbs-up; when he does, it is publish-now on every platform, no
scheduling.

## Deliverables

| Use               | File                                                              | Bytes                              |
| ----------------- | ----------------------------------------------------------------- | ---------------------------------- |
| YouTube, Facebook | `release/brisbane-2026/ShipRex_S4_Everlong_4K_endcard.mp4` (Blob) | 1,607,114,457                      |
| Instagram         | `release/brisbane-2026/ShipRex_S4_Everlong_1080p_IG.mp4` (Blob)   | 275,852,101 = 275.9 MB / 263.1 MiB |
| LinkedIn, TikTok  | `/Volumes/BOTTB/Renders/ShipRex_S4_Everlong_1080p_endcard.mp4`    | 415.1 MB                           |

**The LinkedIn/TikTok 1080p is deliberately over the Instagram cap.** It is the file whose name you
reach for; Instagram must use the `_IG` one. Flagged by the cutting session, recorded here so the
trap is written down rather than remembered.

All four: 284.56 s, 7114 frames, A/V delta 0.025–0.026 s, end card over the last 3.92 s, audio
`Final_v9`.

## Facts checked against the database

|            |                                                                                         |
| ---------- | --------------------------------------------------------------------------------------- |
| Band       | **ShipReX** (`the-shiprex-brisbane-2026`) — Rex Software + URBAN X                      |
| Result     | **Brisbane 2026 winners**                                                               |
| Venue      | The Triffid, Newstead — 27 August 2026                                                  |
| Crew       | Filmed by **Aaron Griffiths** and **Kurt Boldy**; live audio by **Nick Forrester**      |
| Next event | Sydney 2026, Thursday 8 October, The Manning Bar — ShipReX return as **special guests** |

**Nick Forrester's `videographers` row has `role = 'Audio Engineer'`, not Videographer.** The table
mixes roles, so "all three shot it" would be wrong — he recorded the multitrack that every one of
these videos is cut against. The house credit line already gets this right: _"Video shot by Aaron
Griffiths and Kurt Boldy. Live audio by Nick Forrester."_

## Title — two candidates, Dean's call at QC

A YouTube title is editable at any time at no cost, which is exactly why this is worth raising now
rather than after.

**A. Dean's proposed new general format** (his message, 23 Sep) — 61 chars:

```
ShipReX - Everlong (Foo Fighters Cover) - BotTB Brisbane 2026
```

**B. The shipped precedent**, matching Covered in Chrome and Sultans of Swing — 83 chars:

```
Foo Fighters - Everlong (Live Cover) - Rex Software / URBAN X - BoTTB Brisbane 2026
```

The trade: **A** is cleaner and leads with the band, but drops the company names, which are the
sponsors' visible return. **B** keeps them and matches the other 2026 song uploads, but is the
format Dean said he was moving away from.

Going up as **A**, because Dean named it as the general format and QC is the moment to look at it.

**Spelling:** A uses `BotTB`, which is how Dean writes it; the channel is split 7 `BoTTB` / 5
`BotTB`. Still unsettled, still an open item.

## Description

```
ShipReX — the band from Rex Software and URBAN X — play Foo Fighters' "Everlong" live at Battle of the Tech Bands Brisbane 2026, The Triffid.

They went on in full pirate gear, erhu and all, and finished the night as Brisbane 2026 winners.

Every photo from the night: https://www.battleofthetechbands.com/photos?event=brisbane-2026

Video shot by Aaron Griffiths and Kurt Boldy. Live audio by Nick Forrester.
Proudly powered by Jumbo Interactive. Brisbane raised over $3k for Youngcare, supporting young Australians with high care needs to live with more choice, freedom and dignity.

Sydney is next. Thursday 8 October at Manning Bar, with bands from Atlassian, Canva, Amazon and V2 AI, and Brisbane champions ShipReX joining as special guests. Tickets at battleofthetechbands.com

#BattleOfTheTechBands #BotTB26 #BotTB #Youngcare #LiveMusicBrisbane #TheTriffid #FooFighters #Everlong
```

**No "house band"** (Dean, 23 Sep). Note the Sultans of Swing description, currently live, still
carries the phrase — it shipped before the ruling and Dean scoped the instruction to future copy.

## Checks before it goes public

- Verify `privacyStatus` via the **Data API**, not the Studio UI — Studio reported uncommitted
  visibility as saved on the last song.
- Expect a **Content ID claim** on a Foo Fighters cover, as on the Darkness cover. A claim is not a
  strike and does not affect reach; revenue routes to the rights holder. Check for a region block,
  which is the part that would actually matter.
- The website `videos` row goes in **only once the video is public** — the display query does not
  filter on `published_at`, so a scheduled or unlisted id renders a broken embed.
