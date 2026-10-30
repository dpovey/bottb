# Canvanauts — Sydney 2026 winners photo post (Eddy Hill)

First of the Sydney 2026 photo posts, in results order. Dean (via bottb-a4, ~15:00 AEST 12 Oct):
"Canvanauts is selected 10 photos, can you get social agent to put up an ASAP post for the
canvanauts? We will schedule the rest."

Opening line is Dean's (12 Oct, this session): 'Winners of the 2026 Sydney Battle of the Tech
Bands, "The Canvanauts" from @Canva blowing up the stage at the Manning bar.'

## Facts (DB, 12 Oct)

- `finalized_results` sydney-2026: Canvanauts 1st (84.20), Amakazaam! 2nd, V2 Voyagers 3rd,
  Bandlassian 4th. Canvanauts crowd votes 168 of 428 rows, the most on the night, but from ~110 devices (109
  FingerprintJS ids, 111 IPs; one fingerprint has 29 rows). Dean doubted the number: copy no longer quotes it.
- Sydney 2025: Canvanauts 4th; crowd votes Bandlassian 77, Canvanauts 72.
- `setlist_songs` (status pending, unverified): The Joker and the Thief (Wolfmother), Thnks fr th
  Mmrs, So Easy (To Fall in Love), Beggin', Smooth Criminal, Welcome to the Black Parade.
- Photographer Eddy Hill (@eddyhill_gigphotography); V2 AI is the event's "Official Photo and
  Video Partner" (`events.info.sponsors`).

## Assets

`/Volumes/BOTTB/Sydney - 2026/photos/eddy-hill/social/canvanauts/`: `fb/` originals, `ig/` 1080x1080
(set spans 0.667 to 1.566, geometric mean ~1.0), `li/` 2048 long edge, `sheet/` contact sheets.
Final 10, capture order, trophy shot last: 180, 206, 203, 198, 192, 193, -174, 189, -170, -113.
-176 (same frame as 193, darker grade) swapped out on Dean's "Swap one out"; 198 (hat-wearing
frontman close-up) was bottb-a4's pick, not Dean's.

## Facebook

```
Winners of the 2026 Sydney Battle of the Tech Bands, "The Canvanauts" from Canva blowing up the stage at the Manning Bar.

Last year they finished fourth, just behind the crowd favourite. This year the crowd vote was theirs, on a set that opened with Wolfmother's The Joker and the Thief and closed on Welcome to the Black Parade.

Photos by Eddy Hill for V2 AI, our official photo and video partner.

More from the night: https://www.battleofthetechbands.com/photos?event=sydney-2026&company=canva&utm_campaign=sydney-2026&utm_source=facebook&utm_medium=social&utm_content=sydney-2026-photos-canvanauts-facebook

Proudly powered by Jumbo Interactive. All proceeds to Youngcare, supporting young Australians with high care needs to live with more choice, freedom and dignity.

#BattleOfTheTechBands #BotTB26 #BotTB #Youngcare #sydneymusic #livemusicsydney #Canva
```

## Instagram

Collaborators (pending Dean): youngcareoz, eddyhill_gigphotography.

```
Winners of the 2026 Sydney Battle of the Tech Bands, "The Canvanauts" from @canva blowing up the stage at the Manning Bar.

Last year they finished fourth, just behind the crowd favourite. This year the crowd vote was theirs, on a set that opened with Wolfmother's The Joker and the Thief and closed on Welcome to the Black Parade.

Photos by @eddyhill_gigphotography for V2 AI, our official photo and video partner.

Full gallery: battleofthetechbands.com/photos

Proudly powered by Jumbo Interactive. All proceeds to @youngcareoz, supporting young Australians with high care needs to live with more choice, freedom and dignity.

#BattleOfTheTechBands #BotTB26 #BotTB #Youngcare #sydneymusic #livemusicsydney #Canva
```

## LinkedIn

Chips: Canva, V2 AI, Jumbo Interactive Limited (1517297), Youngcare (307122). Verify every urn.

```
Winners of the 2026 Sydney Battle of the Tech Bands, "The Canvanauts" from @Canva blowing up the stage at the Manning Bar.

Last year they finished fourth, just behind the crowd favourite. This year the crowd vote was theirs, on a set that opened with Wolfmother's The Joker and the Thief and closed on Welcome to the Black Parade.

Photos by Eddy Hill for @V2 AI, our official photo and video partner.

More from the night: https://www.battleofthetechbands.com/photos?event=sydney-2026&company=canva&utm_campaign=sydney-2026&utm_source=linkedin&utm_medium=social&utm_content=sydney-2026-photos-canvanauts-linkedin

Proudly powered by @Jumbo Interactive Limited. All proceeds to @Youngcare, supporting young Australians with high care needs to live with more choice, freedom and dignity.

#BattleOfTheTechBands #BotTB26 #BotTB #Youngcare #sydneymusic #livemusicsydney #Canva
```

## Open

- Dean to approve copy; confirm opener/closer songs, Eddy as IG collaborator, V2 AI credit wording.
- Release rule (Dean ~15:15 AEST 12 Oct, via bottb-a4): "The social agent should release the photos only once
  they social post has gone out." Release via admin `POST /api/admin/photos/visibility` (revalidates caches).
  Scope (all 206 Sydney 2026 Eddy Hill, or Canvanauts only) to confirm with Dean.
- No upcoming event in `events`, so no next-event plug.

## What shipped

| Platform  | Link                                                                                                             | When (AEDT)  |
| --------- | ---------------------------------------------------------------------------------------------------------------- | ------------ |
| Facebook  | https://www.facebook.com/122279449718181400/posts/122286345560181400                                             | 12 Oct 16:23 |
| Instagram | https://www.instagram.com/p/DeYegMEml9x/ (collab invites youngcareoz, eddyhill_gigphotography)                   | 12 Oct 16:24 |
| LinkedIn  | https://www.linkedin.com/feed/update/urn:li:activity:7515282245658501120/ (chips Canva, V2 AI, Jumbo, Youngcare) | 12 Oct 16:28 |
| TikTok    | https://www.tiktok.com/@bottb0/video/7695649531031063828 (id from Studio HTML; location Manning Bar)             | 12 Oct 16:30 |

Site: 47 Canvanauts photos released (`visibility='public'`) at 16:26, after FB and IG were live; the
other bands stay private until their posts go out.
