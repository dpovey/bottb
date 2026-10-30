# Social reel posting runbook

How the Brisbane 2026 post-event reels were scheduled across five platforms (30–31 Aug 2026), with
everything that went wrong and the workarounds that stuck. Follow this for Sydney 2026 and later.
Copy + schedule for the Brisbane run: `brisbane-2026-reel-posts.md` and
`brisbane-2026-reel-schedule-log.jsonl` in this directory. The working Blob+FB+IG script is
`scripts/social-fbig.mjs` (run from repo root: `S=<state dir> node scripts/social-fbig.mjs <postKey>
<video path> <ISO time> <collab1,collab2>`; it reads captions from `posts.json` in `$S`).

## Per-platform files

Platform mechanics were split out of this runbook on 2026-10-30. Read the one file for the platform you are posting to; shared rules (copy, handles, scheduling, ledger) stay here.

- [`social/youtube.md`](social/youtube.md): YouTube via Studio, thumbnails, deleting a replaced video
- [`social/linkedin.md`](social/linkedin.md): LinkedIn composer, mandatory mentions, chips, photos
- [`social/tiktok.md`](social/tiktok.md): TikTok Studio, caption check, photo posts
- [`social/facebook-instagram.md`](social/facebook-instagram.md): Blob, Facebook and Instagram Graph API, Meta app publishing
- [`social/browser.md`](social/browser.md): Chrome extension quirks, thumbnails and covers, time pickers

For a video post, `scripts/publish-video.mjs <post.json> <command>` drives the API half from one
`post.json` (Blob uploads, Facebook, Instagram, every ledger row, the website `videos` row, the WhatsApp
text) and lints captions; YouTube, LinkedIn and TikTok are still posted in Chrome and then recorded with
`record youtube|linkedin|tiktok <id>`. Example: `v2-voyagers-starships-ufo/post.json` (30 Oct 2026).

## The pipeline per reel

1. **Brand the video** (ffmpeg): additive-blend the white-on-black `End Card.mov` logo over the first
   ~5 s, sped up 1.6×, scaled to ~150% width and cropped, sitting in the lower half, fade-out 0.8 s.
   Gotcha: `pad` silently clamps a y-offset that would overflow the frame — crop the logo canvas to fit
   _before_ padding, or the logo lands mid-frame. Keep output 1080×1920 H.264 + AAC, `+faststart`.
   On busy bright shots the additive logo washes out; acceptable, but check a frame.
2. **Upload the branded file to Vercel Blob**: Moved to `social/facebook-instagram.md` (2026-10-30).
3. **Facebook Reel via Graph API**: Moved to `social/facebook-instagram.md` (2026-10-30).
4. **Instagram Reel via Graph API**: Moved to `social/facebook-instagram.md` (2026-10-30).
5. **YouTube via Studio in Chrome**: Moved to `social/youtube.md` (2026-10-30).
6. **LinkedIn via the page composer in Chrome**: Moved to `social/linkedin.md` (2026-10-30).
7. **TikTok via TikTok Studio in Chrome**: Moved to `social/tiktok.md` (2026-10-30).

## Domains (get this right)

**The canonical site domain is `https://battleofthetechbands.com`** (bottb.com is a short redirect
to it). **`bottb.com.au` does not exist** — it was mistakenly used in the first round of YouTube
descriptions and every one had to be edited after the fact. Any site link in copy uses the
canonical domain, full stop.

Editing YouTube descriptions after the fact: coordinate clicks on Studio's edit page are
unreliable (the box silently doesn't focus and typing goes nowhere — verify, don't assume). What
works: `const d=[...document.querySelectorAll('#textbox')][1]; d.focus();
document.execCommand('selectAll'); document.execCommand('insertText', false, NEW_TEXT)` then click
the Save ytcp-button via JS and confirm it turns disabled; for public videos double-check via the
Data API (`part=snippet` description). Scheduled videos are editable the same way.

## Database access from Dean's machine

Direct Postgres (port 5432) to Neon times out from the home network in the evenings (observed
1–2 Sep, ~18:00 onward; fine earlier in the day; the Vercel-hosted site is unaffected). Fallback
that always works: **Neon's SQL-over-HTTP endpoint** — POST `https://<neon-host>/sql` with headers
`Neon-Connection-String: <POSTGRES_URL>` and JSON `{query, params}` (port 443). Two gotchas: don't
reuse one `$n` parameter in two differently-typed positions ("inconsistent types deduced"), and
cast ints (`$5::int`). Ready-made script: session scratchpad `insert-video-http.mjs`.

## Chrome extension quirks (apply to every browser platform above)

Moved to `social/browser.md` (2026-10-30).

### LinkedIn composer — the caret trap (learned the hard way, 7 Sep 2026)

Moved to `social/linkedin.md` (2026-10-30).

### TikTok — confirm the caption before you Post

Moved to `social/tiktok.md` (2026-10-30).

### TikTok photo posts

Moved to `social/tiktok.md` (2026-10-30).

### WhatsApp summaries — give them as plain text

Dean pastes these straight into WhatsApp. **Never format them as a markdown blockquote** (`> `) or
wrap them in a code fence — the quote bars come along and he can't use it. Plain lines, one link
per line, labelled by platform. Send one as each post goes live, and again consolidated when every
platform for that item is up.

## Setting thumbnails and covers without freezing the session

Moved to `social/browser.md` (2026-10-30).

## Time pickers: three platforms, three different lies

Moved to `social/browser.md` (2026-10-30).

## Scheduling doctrine (AU)

One burst per day so each band has a single moment to amplify: **LinkedIn 4:30 pm → YouTube 5:00 →
IG + FB 6:00 → TikTok 6:30** (AEST); weekend variant 10:30 am → 11:00 → 11:30 → 12:00. Order the week
Night-highlights first, then bands in winning order. Sources and per-platform research are in
`brisbane-2026-reel-posts.md`.

## HARD RULE — LinkedIn mentions are mandatory, not optional

Moved to `social/linkedin.md` (2026-10-30).

### The technique that works (corrected 11 Sep 2026 — read this, not the old advice)

Moved to `social/linkedin.md` (2026-10-30).

## Handles / tags (verified Aug 2026)

| Who                         | LinkedIn page                        | Instagram                  | Facebook             | Notes                                                                                                                                                                                                                                                             |
| --------------------------- | ------------------------------------ | -------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BotTB                       | battle-of-the-tech-bands             | @battleofthetechbands      | page 207312765803305 | TikTok @bottb0, YouTube @battleofthetechbands                                                                                                                                                                                                                     |
| Jumbo Interactive (sponsor) | jumbo-interactive-limited            | — none                     | /JumboInteractive    | name-only on IG/TikTok                                                                                                                                                                                                                                            |
| Youngcare                   | youngcareoz                          | @youngcareoz               | /YoungcareOz         | YouTube @YoungcareOz; no TikTok → use #youngcare                                                                                                                                                                                                                  |
| Rex Software                | rex-software                         | @rex_software              | /rexsoftware         |                                                                                                                                                                                                                                                                   |
| URBAN X                     | urbanx                               | @urbanx.io                 | /URBANX.IO           |                                                                                                                                                                                                                                                                   |
| Epsilon                     | epsilon                              | @epsilonmarketing (global) | /EpsilonMarketing    |                                                                                                                                                                                                                                                                   |
| Suncorp                     | suncorp ("Suncorp Group")            | @suncorp                   | /suncorpAUNZ         | /SunCorp is someone else                                                                                                                                                                                                                                          |
| For The Record              | ftr-limited ("For The Record (FTR)") | — none                     | — none found         | LinkedIn only                                                                                                                                                                                                                                                     |
| The Triffid                 | —                                    | @thetriffid                | /thetriffid          | TikTok location yes; **do NOT use as IG collaborator — they never accept invites**                                                                                                                                                                                |
| Amy Corrie (photographer)   | —                                    | @amyjuliaaaaa              | —                    | Brisbane 2026 stills. Credit "Photos by Amy Corrie"; IG collaborator (Dean approved 7 Sep)                                                                                                                                                                        |
| Aaron Griffiths (video)     | —                                    | @quirkylikethat            | —                    | Videographer — video posts only, never photo posts                                                                                                                                                                                                                |
| Kurt Boldy (video)          | —                                    | @kurtboldy                 | —                    | Videographer — video posts only, never photo posts                                                                                                                                                                                                                |
| Nicole Ainsworth (video)    | —                                    | @sailornicole              | —                    | YouTube @sailornicole (name matches). Sydney 2026 camera operator. IG collaborator + credit on every Sydney video (Dean, 13 Oct); credit line lists names without roles                                                                                           |
| Adam Davis-Powell (video)   | —                                    | @demonrace                 | —                    | YouTube: @ghostchant23 is his active channel (named Adam Davis-Powell, "DemonRaceProductions"); @demonrace exists but is empty. Sydney 2026 camera operator. IG collaborator + credit on every Sydney video (Dean, 13 Oct); credit line lists names without roles |
| Rory Maclean (video)        | —                                    | @sinnerxszn                | —                    | No YouTube channel found (13 Oct). Shot and cut the Sydney 2026 highlights reel. Credit him **only on that reel**, not on other Sydney video posts (Dean, 13 Oct)                                                                                                 |

**LinkedIn mentions: use the company's FULL registered name.** The typeahead matches on the name as
LinkedIn holds it, so a partial name silently returns nothing:

- `@Rex Software` resolves. `@Rex` alone returns _people_, not the company — too short.
- `@Jumbo Interactive Limited` resolves (Dean, 7 Sep). `@Jumbo Interactive` did not — the "Limited"
  is required.
- `@URBAN X` did not resolve for me, but see the caveat below; try `URBANX` / the full registered
  name before concluding it can't be tagged.

Caveat on the above, so nobody trusts it too far: on 7 Sep I "tested" `@Jumbo Interactive` and
`@URBAN X` in a composer where the caret was silently jumping (see the caret trap below), so those
two negatives are unreliable — the query may never have been contiguous. **Retest properly before
falling back to plain text.** The type-the-whole-caption-in-one-call rule below still stands as the
default; add a mention deliberately, as the last thing typed, and confirm the chip rendered.

Every post: "Proudly powered by Jumbo Interactive" (tag the page on LinkedIn) + Youngcare mention
with the choice/freedom/dignity line. Hashtag base: `#BattleOfTheTechBands #BotTB26 #BotTB
#Youngcare` (+ `#LiveMusicBrisbane #TheTriffid` socials, TikTok adds `#brisbanemusic #livemusic
#techbands`).

## Copy process

- Facts from the DB (`finalized_results`, recomputed against raw `votes`) and the **audio show pack**
  for set lists — the admin `setlist_songs` were stale; sync them back to the DB once corrected.
- **Do not use "house band".** Dean, 23 Sep 2026 — it is overused. The house opening
  `"<Band> — <Company>'s house band — play ..."` put it in effectively every band post across five
  platforms. Vary the apposition instead: "<Company>'s band", "the band from <Company>", or name the
  company after the band with a comma. The problem is the formula, so do not just substitute one new
  fixed phrase for the old one — check a new caption against the last few posts before shipping.
- Voice rules that survived review: no em dashes, no "the moment when", no rule-of-three, no
  "it's not X it's Y", no emoji bookends, first-person "we", lead with a detail someone in the room
  would recognise. Don't invent crowd reactions ("got its own cheer") — Dean cut every one; stick to
  facts and structure ("built around", "closed on").
- **Crowd vote counts are vote rows, not voters (12 Oct 2026).** Sydney 2026 Canvanauts: 168 approved
  rows from ~110 devices (109 FingerprintJS ids, 111 IPs); one iPhone fingerprint alone had 29 rows.
  Dean: "The number of votes does not look right". Don't quote raw vote counts in copy; say who topped
  the crowd vote, or check `count(distinct fingerprintjs_visitor_id)` and ask Dean first.
- Get Dean to fact-check themes/instruments per band (pirates/erhu, Severance, monks in LED masks,
  70s theme (NOT 60s — got this wrong once), Gen-X backdrops, guest sets, youngest-performer) — none of that is in the DB.

## Full-song (16:9) videos — Dean's preferences

- **Keep them landscape everywhere. Never crop, never blur-fill.** A blurred 9:16 canvas version was
  tried and rejected; on Instagram post the plain 16:9 file as a REELS container and accept the
  letterboxed player / cropped previews.
- **Ask Dean whether to schedule or post immediately** — he decides per video and won't always say
  up front. Don't assume "post now". Dean's own YouTube upload is the anchor either way
  (`youtu.be/...` link goes in every caption).
- Make a **~10 Mbps H.264 social master** (~250 MB for 3–4 min) from the multi-GB render: it feeds
  Blob→FB/IG and is what Dean drags into LinkedIn. **TikTok gets the original full-quality master**
  (30 GB cap) — expect a long browser upload; caption/location/settings can be filled while it runs,
  and the Post button activates at 100%.
- Credit the videographers (Aaron Griffiths @quirkylikethat, Kurt Boldy @kurtboldy) on **every**
  video post: IG collaborators everywhere; on full videos the caption line is
  **"Video shot by Aaron Griffiths and Kurt Boldy"** (they shot the full videos; they edited the
  reels — say "shot by", never "video by").
- **Add every published video to the bottb website** (see next section).

## Landscape (16:9) full-song videos — platform mechanics

- Facebook: post as a normal `/{page}/videos` `file_url` post, NOT a reel — plays landscape natively.
- Instagram: the API only accepts video as REELS, and the app letterboxes 16:9 in the player but
  centre-crops previews — looks "converted to vertical". **Post the plain 16:9 file anyway and
  accept that.** An earlier version of this bullet said to fix it by rendering a 9:16 canvas with
  the 16:9 frame over a blurred, darkened fill. **Do not do that** — Dean tried that version and
  rejected it, and his preference section above ("Keep them landscape everywhere. Never crop, never
  blur-fill") is the ruling. The two sections contradicted each other from Sep 2026 until this was
  corrected on 21 Sep; if they ever disagree again, Dean's stated preference wins over a platform
  workaround. There is no API delete — remove a bad IG post via instagram.com ⋯ → Manage post →
  Delete.
- Big masters exceed IG's limit: make a ~10 Mbps H.264 social master first; it also spares Dean the
  giant manual uploads for LinkedIn/TikTok. **The IG limit is 300 MB, not the "~1 GB" this bullet
  used to claim** — see the 300 MB table in step 4, which is read from Meta's `ig-user/media`
  reference rather than inferred from a rejection. At ~10 Mb/s that caps a social master at roughly
  four minutes, so check bytes against 300 MB rather than assuming the bitrate is safe: a 212 s song
  lands ~265 MB and fits, a 355 s song at the same bitrate does not.

## YouTube thumbnails (offline generator)

Moved to `social/youtube.md` (2026-10-30).

## What a render handover from the editor session must contain (28 Sep 2026)

The cutting session's `live-video-editor` skill now defines the handover as a contract (its step 6).
Expect every one of these, and **chase the missing ones before scheduling anything**:

- File paths, with **byte counts verified remotely**, not just locally. Encode the count into the
  injector as `blob.size === <bytes>` and abort on mismatch — v9 and v14 of Everlong differed by
  15 KB in 1.6 GB, and nothing else would have caught a stale fetch.
- The Instagram variant's size in **MB and MiB both**, against the 300 MB cap.
- Which files are **over the IG cap by design**. The editor flags this; **routing files to platforms
  is ours, not theirs** — an earlier handover said "4K master (YouTube, Facebook)" and nearly sent
  1.6 GB into a Facebook reel, which takes the same 1080p as Instagram.
- **Duration in seconds**, for the `videos` row.
- **What changed between versions.** "Audio only, video streams byte-identical" let a whole picture
  re-check be skipped.
- The **version in the Blob path** (`..._v14.mp4`), so a stale Blob URL cannot silently serve the
  superseded cut.
- Whether a **thumbnail exists yet** — not the editor's job, but it is the thing that blocks
  publishing.
- **Dean's instruction quoted verbatim, with a timestamp on the quote.** A relayed instruction can
  go stale between him saying it and us reading it; that happened twice in one week.
- Superseded renders **moved to `_superseded/`**. Everlong left two 1080p files at an identical
  415.1 MB one token apart in the name, and picking the wrong one is a silent failure: it publishes
  cleanly and carries the mix Dean rejected.

**A QC PASS is mechanical, not approval.** Frames, stream length, non-silent tail and bitrate all
passed on the cut Dean rejected for how it sounded. Never read PASS as "cleared to publish", and
never publish on the editor session's word — **only on Dean's**.

## Photo posts (stills) — settled Sep 2026, not yet exercised

First run: Amy Corrie's Brisbane 2026 stills, six posts (one per band + one audience/community),
prepared by the `cut-recipe-colour-correction` session under
`gigstills/runs/amy-labels/social/<post>/`.

- **Crops are for Instagram and Facebook only.** Dean's rule (7 Sep 2026), and I got this wrong on
  the ShipReX post by sending the 4:5 crops to LinkedIn too:
  | Platform | Asset |
  |---|---|
  | Instagram | 1080x1350 4:5 crop (hard aspect limits, and a carousel forces the first slide's ratio on the rest) |
  | Facebook | the same crop as Instagram — **but see below** |
  | LinkedIn | **the ORIGINAL photo, uncropped, native aspect** — LinkedIn happily mixes portrait and landscape in one post |

  **Facebook should usually get the originals too** (Dean, 24 Sep: "if Facebook supports different
  photos why wouldn't we choose that?"). Facebook has neither the shared-aspect-ratio constraint nor
  the 10-item cap, so making it match Instagram throws away pixels and whole images for nothing. Send
  Facebook the crops only when the crop is genuinely the better picture, not out of habit.
  | TikTok | the 4:5 crop (vertical feed; a landscape original would letterbox) |

- **LinkedIn assets**: Amy's originals are 2.6-9 MB each (57 MB for nine), far over `file_upload`'s
  10 MB per call. Downscale to a **long edge of 2048** preserving aspect — that is still larger than
  LinkedIn displays, and brings a whole post to 1.6-3.1 MB so it uploads in one call:
  `ffmpeg -i src.jpg -vf "scale='if(gt(iw,ih),min(2048,iw),-2)':'if(gt(iw,ih),-2,min(2048,ih))'" -q:v 3 out.jpg`
  Source filenames come from `post.json` `images[].source`, resolved against Amy's delivery folder.
- **Format for the crops: 1080x1350 (4:5)**, JPEG sRGB, under 8 MB. Not square — 4:5 is the tallest
  IG allows in feed. A post may be landscape 1080x566 instead, but **every slide in one IG post must
  share an aspect ratio**.
- **Carousel API**: a child container per image (`is_carousel_item=true`, no caption), then a
  `CAROUSEL` parent with `children=<ids>` + caption, then `media_publish`. Max 10 children.
  Single image is the normal `/{ig}/media` + publish. Images need a public URL, so they go through
  Vercel Blob the same way videos do. Set `alt_text` per image.
- **Division of labour**: Dean schedules the IG side by hand from Meta Business Suite (there is no
  IG scheduling API, and session cron jobs die with the session); this session schedules the
  **Facebook** side via the API. Each folder therefore needs the final caption as a plain `.txt`
  Dean can paste, not just a JSON field.
- **12 Oct 2026: Claude can schedule an IG photo carousel in Business Suite itself** (Dean: "Can't you
  automate it in Business suite?"). `business.facebook.com/latest/composer` → Post to: untick the Facebook
  Page so only `battleofthetechbands` is ticked (FB is already scheduled by API) → patch
  `HTMLInputElement.prototype.click` for file inputs, click "Add photo/video", `file_upload` the 1080
  crops to the captured input (photos only; reels still need Dean's drag) → type the caption in the Text
  box → Schedule toggle "Set date and time" → date via the calendar, time via the three spinbuttons
  (hours, minutes, meridiem: type into each) → Schedule → "Maybe later" on the boost offer. Times are in
  the **browser's zone** (Brisbane on 12 Oct, so a 09:00 Sydney slot is 08:00 AM). Check it in Planner
  (`/latest/content_calendar`). The per-photo tag button offers only "Tag people", **no collaborator
  invite**, so collaborators must be added after the post publishes (instagram.com Edit works, see below).
  Same day, three more: (a) clicking outside the caption box while the hashtag suggester is open
  **dropped the last hashtag** (Bandlassian lost #Atlassian) — end the caption with a trailing space and
  blur by clicking the "Post details" heading, then read the tail back; (b) `cmd+ArrowDown` does not move
  the caret to the end of the box, so to fix a caption select-all, Delete and retype; (c) the date field
  takes typed `mm/dd/yyyy`.
- **IG collaborators do not survive scheduling.** Business Suite has Tag People -> Invite
  Collaborator, but it is reported not to carry on a _scheduled_ post — the invite has to be added
  after it publishes (open post -> Edit -> Invite collaborator). Verify on the first post before
  queuing the rest. (Reported, not yet confirmed by us.)
- **Add collaborators after publish from instagram.com in Chrome (13 Oct 2026, Amakazaam!).** No app
  needed: open `instagram.com/p/<shortcode>/` (logged in as battleofthetechbands) → `⋯` → Edit → "Add
  collaborators" → type the handle → tick the row → repeat → the panel's Done → the dialog's Done (top
  right). The caption counter reads "0/2,200" in that dialog but the caption is intact; read the
  `contenteditable` length before saving. **Decoy: `eddyhill_.gigphotography` (fan page) sits right under
  the verified `eddyhill_gigphotography`** — zoom and pick the blue tick. **The web caps a post at 3
  collaborators** (a 4th search returns nothing); the IG app took a 4th (@youngcareoz on the Sydney highlights
  reel, 13 Oct 2026), so ask Dean to add any beyond three in the app. Verify with Graph
  `GET /{ig-media-id}/collaborators` (shows each `invite_status`) and re-read the caption length.
- **Credit the photographer** the way videos credit the videographers: "Photos by Amy Corrie",
  handle `@amyjuliaaaaa`, in the collaborator slot. The videographers do NOT go on photo posts.
  Dean confirmed 7 Sep 2026: Amy goes on as an IG collaborator on all six Brisbane photo posts.
  For a new photographer, check with Dean first — it puts the post on their grid.
- **Verify the exported JPEGs yourself before posting.** The picker's preview thumbnails showed a
  black band beside each image on 7 Sep and looked like the crops were broken. They were not: the
  renderer's crop window is `bw = min(w, h*r); bh = bw/r`, which can only produce the exact target
  ratio, and it exports via a real `im.crop(box)` with no padding step. The bars were the preview
  container pillarboxing a correct portrait crop. Confirm with cropdetect over every file rather
  than trusting or dismissing the preview:
  `for f in */*.jpg; do ffmpeg -v error -i "$f" -vf cropdetect=limit=12:round=2:reset=1 -frames:v 1 -f null - 2>&1 | grep -o "crop=[0-9:]*" | tail -1; done`
  Anything other than `crop=<W>:<H>:0:0` means content smaller than the frame. All 48 came back clean.
- **Every post carries a plug for the next event** at the bottom, under the Youngcare line and above
  the hashtags. Get the facts from the DB (`events` row: `location`, `date`, `description`,
  `info->>'ticket_url'`) rather than memory — Sydney 2026 is Thursday 8 October at Manning Bar with
  bands from Atlassian, Canva, Amazon and V2 AI, and ShipReX joining as **special guests** (not
  defending, which is what I would have assumed).
- Manifest per folder (`post.json`): `post`, `band`, `company`, `scheduled` (+10:00), `caption`,
  `images[]` (`file`, `alt`, `source`, `set_position`), `collaborators[]`, `credit`, `notes`.
- **The site DOES have full photo support** (I got this wrong on 7 Sep and told both Dean and the
  picker session otherwise). There is a `photos` table (`src/lib/schema.sql:161`) with
  `event_id`, `band_id`, `photographer`, `blob_url`, `labels`, `visibility`, plus `photo_hearts`,
  `photo_crops`, `photo_clusters`; a public gallery at `src/app/photos/`, per-photo pages, a
  slideshow, photographer pages, an admin UI under `src/app/admin/photos/`, and docs at
  `doc/arch/photos.md` / `doc/requirements/photos.md`.
  - Bulk ingest is a CLI: `pnpm bulk-upload-photos <dir> <event-id>` (there is no drag-and-drop
    uploader; `/api/upload/image` only handles band/event/user images).
  - Event photos are reached by filter, `/photos?event=<eventId>` — there is no
    `/event/[eventId]/photos` route. The event page's Photos button already points at the filter
    (`src/app/event/[eventId]/event-page-client.tsx:325`).
  - So a photo post CAN link to the gallery, but **only after the set is ingested** — as of 7 Sep,
    `brisbane-2026` had 1 photo in the table, so the link would have led to an empty gallery.

### Choosing the common aspect ratio when the sources are mixed (24 Sep 2026)

Every slide in one Instagram post must share an aspect ratio, so a mixed-shape set needs one crop
for all of them. **Pick the ratio by geometry, not by habit.** The ShipReX stills spanned 1.778
(16:9) and 0.562 (9:16) — exact reciprocals, so their geometric mean is exactly 1.000. At 1:1 each
extreme keeps 56% of its long axis; the house 4:5 crop would have kept only **45%** of a 16:9
frame's width while giving the single portrait frame a discount nothing else in the set needed.

So 4:5 is the right default when the sources are portrait or square, and the wrong one when the set
is mostly landscape. Compute `sqrt(widest x narrowest)` and check what each end actually loses.

**Always eyeball a contact sheet of the crops before publishing**, not the originals — a centre crop
can behead a subject who was framed to one side, and a spreadsheet of ratios will never show it:

```
magick in.jpg -gravity center -crop 1:1 +repage -resize 400x400 out.png
montage out/*.png -tile 5x -geometry +6+6 -background black sheet.jpg
```

### Deleting a video when another carries the same title (27 Sep 2026)

Moved to `social/youtube.md` (2026-10-30).

### A disabled button eats the click and reports nothing

Moved to `social/browser.md` (2026-10-30).

### A peer's state report is a fact about when it was written

"Resolve is closed" was true when the cutting session sent it and false by the time it was acted on,
because Dean reopened Resolve in between. Neither session was wrong; the message was simply stale.
**Re-measure anything time-varying yourself** — memory, disk, whether an app or job is running —
however recently and however confidently a peer reported it. Ask peers to send measurements with
the moment they were taken, and treat one as evidence about that moment only.

### LinkedIn photos do NOT need dragging — only video does

Moved to `social/linkedin.md` (2026-10-30).

### Verify LinkedIn mention chips by `data-entity-urn` before clicking Post

Moved to `social/linkedin.md` (2026-10-30).

### A caption can be fixed after publishing; the images cannot

Moved to `social/facebook-instagram.md` (2026-10-30).

## Photo visibility — the manual step that gets forgotten

Photos default to `visibility='private'` and are **admin-released**. Publishing the social post does
NOT release them. Someone who sees the post and comes to the site finds nothing until you run:

```sql
UPDATE photos SET visibility='public'
WHERE event_id='<event>' AND band_id='<band>' AND visibility <> 'public';
```

Brisbane 2026 ran five band posts plus an audience post before anyone noticed the photos were all
still private. Check the photographer's page afterwards — Amy Corrie's should read 79 public / 0
private.

**This is not automated and rides on a human or a session being alive.** On 12 Sep the audience
photos were released only because a one-shot reminder fired. The durable fix is to tie the release
to the post going out; until that exists, treat it as part of publishing, not as follow-up.

Related: photographers must exist in the `photographers` table for credit to render, and the
photographer pages join on `name`, **not slug** — `photos.photographer` holds the display name.

## Website: every published video goes into the site

The site renders videos from the `videos` table (YouTube-backed; see `src/lib/db/videos.ts` and
`doc/requirements/videos.md`). **The display query does NOT filter on `published_at`, so only
insert once the YouTube video is actually public** — a private/scheduled ID renders a broken embed.

Insert per video: `youtube_video_id`, `title` (the YouTube title), `event_id`, `band_id`
(null for night-highlights), `video_type` (`short` for the ≤60s reels, `video` for full songs),
`thumbnail_url` (`https://i.ytimg.com/vi/<id>/hqdefault.jpg`), `duration_seconds`, `sort_order 0`,
`published_at now()`. Skip if the id already exists. For the Brisbane week this is folded into the
daily 6 pm session jobs (each inserts that day's short after the 5 pm YouTube publish); for one-off
full videos do it right after posting.

## Threads (parked)

Env has `THREADS_APP_ID/SECRET` and the site has connect/callback routes, but the Threads app is in
dev mode: connecting fails with error 1349245 until the Threads account is added as a **Threads
Tester** (developers.facebook.com → App roles) and accepts the invite in Threads → Settings →
Account → Website permissions. Once a `threads` row exists in `social_accounts` (token decryptable
via `SOCIAL_ENCRYPTION_KEY`, AES-256-GCM, base64 IV+authTag+ciphertext), posting is the IG container
pattern against `graph.threads.net`. No native scheduling.

## Daily operating rhythm

Per band-day the job does: publish IG (build container → publish), then insert that day's YouTube
Short into the site, then collect permalinks. Dean wants a **WhatsApp list** he can paste into the
band chat once all five are live — one bold line of context, then `Platform: link` bullets, in the
order LinkedIn / YouTube / Facebook / Instagram / TikTok. TikTok is last (6:30 pm, noon Saturday),
so send the list right after it lands rather than posting a partial one; if he asks earlier, send it
with "TikTok: pending".

Artefacts: the session scratchpad **gets wiped by OS temp cleanup** (it vanished overnight mid-week).
Keep the source of truth in the repo — `brisbane-2026-posts.json` (captions),
`brisbane-2026-reel-schedule-log.jsonl` (every permalink), `scripts/social-fbig.mjs` — and re-copy
into the scratchpad at the start of a run. Web sessions also expire: TikTok logged itself out after
~5 days (scheduled posts still published; only link-fetching broke).

## Blob uploads (the public URL every API post needs)

Moved to `social/facebook-instagram.md` (2026-10-30).

## Verify, don't assume

Every failure this week came from reporting success without checking. Non-negotiable checks:

- **DB writes**: re-select the row. A "success" that never connected was reported as done once —
  the insert had silently failed and had to be redone days later.
- **Permalinks**: confirm the post text/caption matches the link (LinkedIn: fetch the activity URL
  and grep the opening line; TikTok: oEmbed caption). Never infer an id from list/grid position.
- **Browser typing**: after typing into any Studio/composer field, read the field back before
  saving; silent no-ops are common while pages hydrate.
- **Scheduling dialogs**: zoom in on the final date/time before clicking the confirm button.

## End-card treatment and QC (durable scripts)

- `doc/production/scripts/endcard-treat.sh <src.mp4> <out.mp4> [--4k]` — applies the card as an
  **additive overlay** (`blend=all_mode=addition` over a faded base), gates the SOURCE first, and
  runs the encode detached via `nohup` so a lost session or a reboot cannot leave a silent
  truncated file. Fade start 295.152 s, duration 3.92 s — recalculate if the song length changes.
- `doc/production/scripts/endcard-qc.sh <treated.mp4> [sheet.png]` — stream durations, decoded audio
  at 8 points across the whole file including the 240-299 s window a bad export silently dropped,
  and a tail contact sheet for a human to confirm the overlay.

**The gates are negative-tested — a gate nobody has seen fire is not a gate.** Three synthetic cases,
all exit 1: a 10 s video muxed with 4 s of audio ("audio/video length mismatch"); a file with no
audio in the checked window ("silent region found"); and a file that is **digitally silent** —
samples present but all zero. That third case was added 8 Sep after the first version of this check
was found to pass it: `n_samples > 0` is not enough on its own, because a silent stream still
decodes samples. The check now also requires `mean_volume > -80 dB`, exempting the deliberate fade
at the end. Positive control: the real treated master passes (exit 0) with -14.2 dB at 60 s and the
fade intact. Re-run all four cases if you change the checks.

Keep these in the repo, not the session scratchpad: `/private/tmp` was wiped by the 13:36 reboot on
7 Sep and took the originals with it.

## Incident log — what went wrong and what changed

Dated, so the fix is traceable to the failure that caused it. Add to this every time something
breaks or a rule changes; the sections above are the distilled rules, this is the evidence.

### 21 Sep 2026 — two withdrawals in one morning, both times the ears beat the instruments

Off the Record's "It's All Coming Back to Me Now" was scheduled across five platforms, published to
YouTube and LinkedIn, and withdrawn twice in four hours. Nothing defective reached Facebook,
Instagram or TikTok. Both holds came from Dean listening, and both times the measurements initially
said the file was clean.

| #   | What happened                                                                  | What the instruments said                                                                                                                             | What was actually true                                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Dean judged the guitar too loud and harsh after the video went public at 07:30 | No clipping anywhere, master peak -1.62 dBFS, zero flat-top runs, all stems clean                                                                     | A balance problem, not a defect. The guitar was driving the limiter — pulling it 2.1 dB moved crest 13.73 → 15.42 at the same Maximizer setting. One cause, two symptoms ("too loud" AND "limited")                |
| 2   | Dean then heard the two guitars as not tight                                   | `19 Gtr 2 DI` would not correlate against its own source on four methods, r=0.016–0.067. Read as "structurally right, cannot measure to ms precision" | **The search window never reached the true offset.** Widened to full file length, Gtr 2 locks at -1090.62 ms. Cause: **uncompensated RX De-hum latency**, ~1.09 s, past Logic's PDC. Confirmed by Dean on playback |

**A null result only covers the range you actually searched.** r=0.02 was not a precision limit and not
non-linear processing; it was the right answer sitting outside the window. A measurement's stated
limitation is a hypothesis about the measurement, not a fact about the audio.

**When a candidate offset looks like a musical interval, test for the comb before dismissing it as
an alias.** This number surfaced earlier as a 1.092 s "step" and was waved away as a two-beat alias
at ~110 bpm. What settles it is structural, not musical: an alias produces a _comb_ of comparable
peaks at beat multiples, a real displacement is a lone peak. Gtr 2's peak was r=+0.749 with the
next-best anywhere in 2335 s at r=+0.017 — a 44x margin, and nothing at all where the rest of the
band sits.

**Do not derive a tempo from an offset and then cite it as confirmation of that offset.** The
"exactly 2 beats at 110.03 bpm" reading was RETRACTED: the bpm had been derived _from_ the
1090.62 ms figure by assuming it was two beats, then quoted back as evidence the displacement was a
grid-snap nudge. Circular, and it would have sent Dean hunting through region positions for a fault
that was in a plugin. A coincidence with a musical interval is not evidence of a musical cause —
plugin latency lands wherever it lands.

**Latency that exceeds the host's PDC is never compensated, and it is silent.** The real cause was
uncompensated RX De-hum on that channel, ~1.09 s, past Logic's compensation limit. Dean guessed
De-hum first and was right; it was dismissed on the reasoning that "de-hum latency is milliseconds".
Check a plugin's actual reported latency against the host's limit rather than assuming a class of
plugin is low-latency.

**Correlating an export against its own source cannot be defeated by loose playing.** Looseness is a
relationship between two channels. When one channel returns 0.99 against its own source and its pair
returns 0.02 on identical chains, that asymmetry is a fault to be found, not a limit to be accepted.

**Also from this morning:** a plugin-latency theory was built from a screenshot in which a bus strip
was read as a channel strip, blaming two Neutron instances that sit on the _shared_ guitar bus and
therefore delay both guitars equally. Retracted. Check what a strip actually is before reasoning
about relative delay from it.

### 20 Sep 2026 — `pnpm format` in a tree three sessions were writing to

| #   | What happened                                                                                                                                                                                                                                                                   | Why it mattered                                                                                                                                                          | What changed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Ran `pnpm format` after editing this runbook. Prettier walks the whole repo, and second-precision mtimes show it also rewrote `live-mix-starting-points.md` three seconds later — another session's in-flight work on compressor makeup gain, nothing to do with social posting | Nothing was lost (prettier is semantic-preserving on markdown) but another session gets unexplained reflow churn in a diff it did not make, while its author is mid-edit | **Do not run repo-wide `pnpm format` mid-session.** Format only the paths you actually edited. The `pnpm format && pnpm typecheck && pnpm lint && pnpm test` line is a PRE-COMMIT gate; running it as a reflex after every edit is wrong when you are one of several writers in one working tree. **When you do touch another session's file, tell them with second-precision mtimes** (`stat -f "%Sm %N" -t "%H:%M:%S"`) — mix-assist-38 resolved this in one pass because it could separate my 23:47:05 write from its own 23:47:08; without them the honest answer is "I don't know", which usually ends in a needless revert |
| 2   | Assumed the pre-existing uncommitted changes belonged to the peer session I was talking to, and used that to justify not committing                                                                                                                                             | Right conclusion, wrong reason — the peer had written nothing in this repo. `brief/`, the videographer PDF and the live-mix docs were a third party's                    | Check `git status` mtimes and content before attributing uncommitted work to whoever you happen to be talking to. With several sessions live, "not mine" does not narrow to "theirs"                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 3   | Stamped a ledger entry `2026-09-21T00:05` while it was still 23:46 on the 20th                                                                                                                                                                                                  | A ledger whose purpose is recording accurate publication times had a future-dated, wrong-day entry in it                                                                 | Read the clock (`date`) rather than estimating it when writing a timestamp into the ledger                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

### 7 Sep 2026 — Epsonics "The Chain" full video

| #   | What happened                                                                                    | Why it mattered                                                                                                                                                                              | What changed                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | First treated masters had visible flicker                                                        | Would have shipped to 5 platforms                                                                                                                                                            | Video held; peer session root-caused it to the venue's 3LCD projector backdrop (30 Hz against 25p, aliasing to an exact 5-frame cycle)                                                                                                                                                                                                                                                                                                                                   |
| 2   | End card **replaced** the picture instead of overlaying it                                       | Dean caught it before I did                                                                                                                                                                  | Additive-blend recipe (`blend=all_mode=addition` over a faded base); tail contact sheet is now a required check                                                                                                                                                                                                                                                                                                                                                          |
| 3   | Replacement 1080p had **no audio for its last 56 s** (audio stream 243.285 s vs video 299.000 s) | Would have shipped a silent big finish to LinkedIn, TikTok, FB and IG                                                                                                                        | Audio gate added to the re-run script: stream duration compared to video AND a decoded tail check. Container metadata alone is not enough — but here metadata was the first clue and decoding confirmed it                                                                                                                                                                                                                                                               |
| 4   | Two tracked background encodes were killed mid-run                                               | Silent partial files (`moov atom not found`)                                                                                                                                                 | **Root cause found later: the machine froze and rebooted at ~13:36.** A mix-assist session ran `pytest -n auto` — 12 workers x 2.1 GB against 24 GB of RAM — and swap-thrashed the Mac to a standstill, twice. Not a harness kill, which is what I wrongly wrote here first. Long encodes still run detached (`nohup ffmpeg ... & disown`) since that also survives a session restart, and see the memory rule in `~/.claude/CLAUDE.md` before running anything parallel |
| 5   | Blob upload script copied into the scratchpad died instantly with `ERR_MODULE_NOT_FOUND`         | Invisible because the job was detached; the plan assumed the upload had happened                                                                                                             | `doc/production/scripts/blob-upload.mjs` must run with the **repo root as cwd**. Always read the log for `BLOB_URL` before proceeding                                                                                                                                                                                                                                                                                                                                    |
| 7   | `/private/tmp` scratchpad was wiped by the reboot, losing the built LinkedIn assets              | Rebuild artefacts that took real work into a **durable** path (here `social/<post>/linkedin/`), not the session scratchpad; copy to the scratchpad only at the moment `file_upload` needs it |
| 6   | The grade changed _after_ I had treated and installed a 4K master                                | The file at the canonical path was silently the wrong one                                                                                                                                    | Superseded files get renamed (`SUPERSEDED_oldgrade_*`, `OLD_flickery_*`), never deleted, and **the canonical path is left empty** so nothing can be dragged into a post by accident                                                                                                                                                                                                                                                                                      |

Net effect: nothing shipped. Every one of these was caught by a check that takes minutes, which is
the argument for moving a burst rather than compressing the checks.

### 7 Sep 2026 — Amy Corrie photo posts

| #   | What happened                                                                                                                                      | What changed                                                                                                                                       |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | I told Dean and the picker session that **stills have no website path**. Wrong — the site has a full photo pipeline (tables, gallery, admin, docs) | Corrected in the photo-posts section above. Check the schema before declaring a capability absent                                                  |
| 2   | Picker preview showed black bars beside each thumbnail                                                                                             | Cosmetic (container pillarboxing a correct crop), proven with cropdetect over all 48 exports. Verify the output, don't argue about the preview     |
| 3   | `social-photos.mjs` printed a permalink built from the page id                                                                                     | That URL 404s: the id in a post URL is not the page id. The script now reads `permalink_url` back from the API, which also confirms `is_published` |
| 4   | ShipReX `post.json` scheduled 13:00 with the folders delivered at 12:50                                                                            | Nothing was approved or written yet. Treat peer-supplied times as suggestions; the burst time is Dean's call                                       |
| 5   | Draft caption opened by announcing the win and signed off "Congratulations from all of us at @battleofthetechbands"                                | We _are_ BotTB. Never self-mention or congratulate from the brand account; lead with a detail from the room instead                                |

### 11–13 Sep 2026 — Off the Record, the roundup, and Jumbo Band

| #   | What went wrong                                                                                                                                                                                             | Why it mattered                                                                                                                       | Fixed by                                                                                                                                 |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Followed this runbook's "use the FULL registered name" advice for LinkedIn mentions. Three failed attempts: no dropdown at all, then a chip split in half, then a `BackSpace` ate a chip after a screenshot | ~20 wasted tool calls on a post that should have taken five                                                                           | Short query + mouse click + `cmd+Down End`. The section above is rewritten; the old advice was not merely incomplete, it was backwards   |
| 2   | Told Dean YouTube needed his manual upload because the file exceeded "the 10 MB cap"                                                                                                                        | Would have handed him work I could do. He challenged it and was right                                                                 | The 10 MB cap is the extension's `file_upload` tool only. The Studio fetch-inject has carried 1.69 GB. Corrected in the pipeline section |
| 3   | The log interpreter derived the band from the **action name**, so three bands' publications all filed under Epsonics                                                                                        | Jumbo Band's and Total Loss's posts were recorded against the wrong band                                                              | Read the band from the entry's `item` text; `scheduled_*` and `endcard*` now handled as production steps                                 |
| 4   | `endcard-treat.sh` had one song's constants hardcoded (299 s, probes at t=240/280/295)                                                                                                                      | Refused to run on a 230 s song — the gates fired on the wrong song, not on a bad master                                               | Derives fade from the card's own length, scales probes to the song, `--expect` optional                                                  |
| 5   | A fix to that script used `for t in $PROBES`                                                                                                                                                                | zsh does **not** word-split an unquoted scalar, so it iterated once over the whole string and reported a silent tail on a good master | Array. Failing closed was correct; the lesson is to distrust the error, not the file                                                     |
| 6   | Dean's thumbnail PNG was 2.71 MB                                                                                                                                                                            | YouTube's cap is 2 MB — it would have been rejected at upload                                                                         | JPEG q92, 0.36 MB                                                                                                                        |
| 7   | Photos stayed private through five band posts and the audience post                                                                                                                                         | Anyone arriving from a post found an empty gallery                                                                                    | Released 80/80. Still a manual step — see "Photo visibility"                                                                             |

### 15 Sep 2026 — Sultans of Swing masters

**Three failures in one night, all the same shape: the check was wrong, the artefact was fine.**
A probe run with `-v error` reported "NO AUDIO DECODED" on two good masters. A tail contact sheet
looked like a broken end card when the shipped Bring Me to Life does exactly the same thing. A
memory sampler hit its iteration limit and reported a still-running encode as finished, handing back
a half-written file that ffprobe called corrupt. In every case the instinct to trust the instrument
over the thing it measures was the error. **Before calling a master broken, open a known-good one
and run the identical check on it.**

| #   | What went wrong                                                                                              | Why it mattered                                                                                                                                                                                   | Fixed by                                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | A tail-probe script ran ffmpeg with `-v error` and reported "NO AUDIO DECODED" on two perfectly good masters | `volumedetect` prints its summary at **info** level, so `-v error` suppresses the very line the grep looks for — the check failed closed on a good file, same shape as the zsh word-splitting bug | Use `-hide_banner -nostats`, never `-v error`, whenever you need a filter's printed output. Diagnosis by the peer session; `endcard-treat.sh` line 77 already did this correctly |
| 2   | `endcard-treat.sh`'s header claimed the encode sits "well under 1 GB"                                        | A measured 1080p pass peaked at 1012 MB, and 4K is ~4x the pixels — the comment would have justified running a 4K pass unannounced on a 24 GB shared machine                                      | Measured and corrected in the script. Budget several GB for `--4k` and check first                                                                                               |
| 3   | Nearly called the end card broken because the final frame was near-black rather than logo-on-black           | It is not a fault: the shipped Bring Me to Life does the same (YAVG 39 -> 17 over its last 0.2 s; Sultans 45 -> 18). The card's own tail fades                                                    | Compare against a shipped master before declaring a regression                                                                                                                   |

### True peak: set the bounce ceiling 0.2 dB below the delivered target

**Dean set the ceiling on 15 Sep 2026** when he ordered the Sultans re-bounce: **true peak
<= -1.0 dBFS**. It was then missed on every delivery until v7 of It's All Coming Back to Me Now —
shipped Sultans **-0.3**, The Chain **-0.9**, v6 **-0.8**. None was flagged, and v6 was nearly waved
through because it was more conservative than the first two, i.e. using two unflagged breaches to
justify a third. A ceiling nobody enforces stops existing without anyone deciding it should.

**The cause was mundane: the bounce ceiling was set AT the target instead of below it.**

| stage                        | integrated | true peak     |
| ---------------------------- | ---------- | ------------- |
| v7 WAV bounce                | -13.1 LUFS | **-1.2 dBFS** |
| v7 -> AAC 320k, generation 1 | -13.2 LUFS | **-1.0 dBFS** |

**The first encode costs +0.2 dB. Later generations cost ~0.1 dB and do not compound** (measured
-0.8 -> -0.7 -> -0.8 across g2/g3/g4). The generation every delivery actually goes through is the
expensive one, so a bounce at exactly -1.0 delivers -0.8 — which is what v6 did.

**Set the bounce ceiling 0.2 dB below the true peak you want delivered.** -1.2 delivers -1.0,
measured end to end. **Then measure the delivered file anyway** — that is two measurements, not a
law, and the check costs seconds.

**The limiter is not the problem, and that was tested rather than assumed.** A theory that the
Maximizer's true-peak detection under-read against BS.1770 4x oversampling died against Dean's own
seven bounces: v1 -1.0, v2 -1.0, v3 -1.0, v4 -2.0, v5 -1.0, v6 -1.0, v7 -1.2. Every one lands exactly
on its set ceiling; his limiter agrees with BS.1770 to 0.0 dB. Do not reach for a calibration
explanation.

**Shipped Sultans at -0.3 is UNEXPLAINED.** That is 0.7 dB above a presumed -1.0 bounce and one
generation at +0.2 does not cover it. Its bounce WAV would settle it. Left unexplained on purpose
rather than attributed to a mechanism that does not fit — an explanation covering 0.2 of a 0.7 dB gap
is not an explanation.

**Two retractions produced this section.** The per-generation lift was first quoted from memory as
0.2, then retracted as "generations are near-free" on a test that decoded from an already-encoded
file and so could only see generations 2->4. The one generation that mattered was the one the test
could not reach, and a fixed "target -1.4" spec was built on that retraction and written in as
arithmetic. **A test that cannot reach the case you care about is not evidence about that case** —
and a correction can overshoot as easily as the error it corrects.

### 14 Sep 2026 — Bring Me to Life publication day

| #   | What went wrong                                                                                                                | Why it mattered                                                                                                                      | Fixed by                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| 1   | Sent the 4K master to Instagram because "one Blob URL feeds FB, IG and YouTube"                                                | ~50 s of processing, then a bare `2207076` that names neither the resolution nor the size                                            | IG caps at 1080p / 1 GB. Post the 1080p there; FB and YouTube keep the 4K. Step 2 now says upload both     |
| 2   | Used `jumbointeractive` as an IG collaborator, which the API refused outright — killing the whole container, not just that tag | The handles table already said Jumbo has **no Instagram**. The runbook was right and the brief's guess was wrong                     | Probe each handle alone with a throwaway container. Read the handles table before trusting a supplied list |
| 3   | This runbook's own advice — verify a handle by loading `instagram.com/<handle>` — is worthless                                 | A handle invented on the spot returns 200 exactly like a real one; it would have "confirmed" the bad handle                          | Deleted and replaced with the API-probe method                                                             |
| 4   | `ALL_PLATFORMS_LIVE` in the log interpreter had The Chain's group, band **and read-back times** hardcoded                      | Identical to incident 3 of 11–13 Sep, one layer down: it would have filed Jumbo Band under Epsonics and backdated the IG reel a week | Group and times now come from the entry. Five regression tests added                                       |
| 5   | Nearly recorded LinkedIn's and TikTok's times as exact                                                                         | Neither platform exposes one — only "2h ago". Writing them as measured would have made the ledger look precise where it is not       | `~` prefix on the `<platform>_at` key sets `posted_at_estimated`                                           |

### 8 Sep 2026 — Amy Corrie photo run

| #   | What happened                                                                                                                                                                                  | Why it mattered                                                                             | What changed                                                                                                                                                                                                                                                                                                                                     |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **The five photo posts were never scheduled.** I prepared captions, crops and LinkedIn assets on 7 Sep and stopped there. Epsonics was due 09:00 and had not gone out when Dean asked at 09:55 | A whole day's post silently missed. Nobody would have noticed until Dean asked              | Facebook is now scheduled **natively** for all four remaining posts, so they fire even if this session dies (it died twice on 7 Sep). Never rely on a session-only cron for a multi-day schedule: IG has no scheduling API, so only IG/LinkedIn/TikTok need a live session, and that limitation must be stated to Dean rather than left implicit |
| 2   | I posted the Epsonics LinkedIn caption with **plain-text company names**, no mentions, despite having proven the mention technique the day before                                              | Jumbo Interactive is the major sponsor and got no credit. Dean had to edit the post himself | See the HARD RULE section above. Root cause was mine: I reverted to the older "type it all in one block" workaround because it felt safer, after already learning the correct method. A proven fix supersedes the workaround it replaced                                                                                                         |
| 3   | A stale scheduled FB post would have **republished The Chain on Sat 12 Sep using the old flickery file**                                                                                       | A duplicate post with a known-bad video                                                     | Deleted with Dean's approval. Lesson: when a post is held and pushed to a later date, it stays on the schedule after the real post ships — always re-check `/{page}/scheduled_posts` after a held item is finally published                                                                                                                      |
| 4   | The FB handle-swap turned a standalone `@epsilonmarketing` line into a one-word paragraph reading "Epsilon"                                                                                    | Ugly orphan line, caught only by the `--dry` run                                            | **Always `--dry` first** and read the rendered caption for both platforms. Never leave a bare @handle on its own line — fold the company into a sentence                                                                                                                                                                                         |

## The app must be Published, or nothing you post is visible to anyone else

Moved to `social/facebook-instagram.md` (2026-10-30).

## Recording performance in the database

**Every post goes in `posts`, every metric capture goes in `post_metrics`.** Do this as part of
publishing, not as a separate project — the ledger went stale for two weeks (7 Sep to 22 Sep) simply
because nobody wrote the step down, and 25 posts had to be reconstructed from the platforms
afterwards.

### The two tables

- **`posts`** — one row per publication per platform. The publication ledger, however the post got
  there (Graph API, browser drag, native scheduler, human). NOT the same as `social_posts` /
  `social_post_results`, which are the admin UI's _queue_ and are barely used.
- **`post_metrics`** — one row per (post, capture). `post_id` references `posts.id`.

### Run the collection

```bash
node doc/production/scripts/collect-social-metrics.mjs --dry   # always dry first
node doc/production/scripts/collect-social-metrics.mjs
```

It upserts `posts` by `(platform, external_id)` and appends a `post_metrics` capture. Re-running is
safe: existing posts are skipped and the unique `(post_id, captured_at)` stops duplicate captures.

**Fixed 13 Oct 2026** (it had not been trusted since 22 Sep):

- Ledger match now tries every id a post can carry (FB page-post id and attachment video id, IG
  container id or shortcode) and the permalink's id. Before this, 17 already-ledgered posts showed as
  new because the posting route stored a different id than the read API returns.
- New rows take the event of the **first** city the caption names (Brisbane posts end "Sydney is
  next"); no city gives NULL. YouTube hidden counts are NULL, not 0. FB `shares` stays `?? 0` because
  Graph omits the field when a post has none.
- `--since <date>` (default: last 30 days); `source` is `collect-social-metrics`; `--dry` prints `NEW`
  for each post it would insert.

**Weekly job (13 Oct 2026, Dean: "Yes"):** launch agent
`~/Library/LaunchAgents/com.deapovey.bottb-social-metrics.plist` runs the collector Mondays 09:07
local (catches up on wake), logging to `~/Library/Logs/bottb-social-metrics.log`. FB/IG/YouTube only.
**LinkedIn and TikTok still need a session to scrape** them into `post_metrics` (source
`linkedin-scrape`, `tiktok-studio-scrape`; the `source` column is varchar(20)). TikTok ids encode the
creation time, not the publish time of a scheduled post: take `posted_at` from Studio's date column.
LinkedIn's Content engagement table ignores Next/page-2 clicks (13 Oct): read page 1, then narrow the
date range for older posts.

### Snapshots, not current values

`post_metrics` stores a capture per collection rather than overwriting a "latest" figure. **Age is
the dominant confound** — a post five days old beats one five hours old on volume alone — and a
history of captures is the only thing that lets age be modelled later. Overwriting throws that away
permanently and it cannot be reconstructed.

### NULL is not zero, and this is the part that matters

Platforms differ in what they will tell us, and the differences are not uniform:

| Platform  | reach                  | likes/reactions | comments | shares/reposts | How                                                             |
| --------- | ---------------------- | --------------- | -------- | -------------- | --------------------------------------------------------------- |
| LinkedIn  | **impressions** ✅     | ✅              | ✅       | ✅             | Page admin → Analytics → Content engagement. **Scrape, no API** |
| TikTok    | views ✅               | ✅              | ✅       | —              | Studio `/tiktokstudio/content` list. **Scrape, no API**         |
| YouTube   | views ✅               | ✅              | ✅       | —              | Data API, read-only key                                         |
| Instagram | —                      | ✅              | ✅       | —              | `/{ig-user}/media`                                              |
| Facebook  | views ✅ (videos only) | ❌              | ❌       | shares ✅      | `views` off `/videos`, `shares` off `/published_posts`          |

**LinkedIn is the richest source we have, and an earlier version of this table said it had nothing.**
Corrected 22 Sep 2026. The page admin's Content engagement table gives per-post impressions, views,
clicks, CTR, reactions, comments, reposts and engagement rate — more than any other platform, and the
only source of **impressions** anywhere. The feasibility doc rates LinkedIn "manual export, Medium
confidence"; that understates it. It is a DOM scrape of a table, not an export. Read `thead` for the
column order rather than assuming it — that is what makes the scrape stable.

**Linking LinkedIn rows to posts is the hard part, not reading the numbers.** The analytics table
carries no URN. URNs come from the page-posts admin's Boost links, and **only recent posts expose
one** — on 22 Sep, 10 posts had metrics but only 5 had a recoverable URN. Match a URN to a row by the
**publish date printed in the page-posts row** ("By <author> <date>"), never by decoding the
snowflake: an id's timestamp is when the post was COMPOSED, which for a scheduled post is a different
day. Rows without a URN get a deterministic `li-unlinked-<date>-<type>` external id and
`metadata.unlinked = true`, so re-runs stay idempotent and they can be reconciled rather than
silently duplicating.

LinkedIn's **Reactions** map to `likes` and **Reposts** to `shares` in `post_metrics`; the mapping is
written into each row's `notes` so nobody later reads `likes` as a literal like count.

TikTok's Studio list nests the counts as `Everyone <views> <likes> <comments>` in the row's second
child. **Reload the page before scraping** — a Studio tab left open overnight served a stale list
that was missing the four most recent posts entirely, and the scrape looked successful.

**Facebook reactions and comments are NOT available** — the token lacks `pages_read_user_content`
and the call returns error 10. Re-verified 22 Sep 2026, still blocked. Getting them needs an app
re-auth with `read_insights`, which requires App Review; start the lead time early if it is wanted.

**Write NULL, never 0, when a platform refuses to answer.** A zero silently turns "unknown" into
"nobody engaged", and every average computed afterwards is wrong in a direction nobody can see.
The columns are all nullable for exactly this reason.

### Joining Facebook posts to their view counts

`/published_posts` carries the real publish time and `shares`; `/videos` carries `views` but its
`created_time` is the **upload** time, not publication (a reel staged at midday and scheduled for
18:00 reports midday). Link them through `attachments{type,target}` on the post — `target.id` is the
video id. Pass `curl -g`, or curl's own URL globbing eats the `{}` and you get two concatenated JSON
documents and a confusing parse error.

### Traps already paid for

- `posts.status` must be one of `scheduled` / `published` / `withdrawn` / `deleted` / `failed`.
  `'posted'` fails the check constraint. It fails closed, which is correct — do not work around it.
- `posts.content_type`: `reel` / `short` / `video` / `photo` / `carousel` / `story` / `text` / `link`.
- `posts.posted_via`: `api` / `browser` / `manual` / `native_schedule`.
- **LinkedIn and TikTok are not in the automated collection at all.** Anything claiming to be an
  all-platform ranking while missing those two is a partial ranking — say so rather than presenting
  it as complete.

## Measuring what a post did (and what you cannot measure)

- **Instagram**: `like_count` and `comments_count` come off `/{ig-user}/media` on the current token.
- **TikTok**: views and likes are readable from the Studio content list. Nothing via API.
- **Facebook**: reactions/comments need `pages_read_user_content`, which this token does NOT have.
  `/{page}_{post}?fields=reactions.summary(total_count)` returns error 10. FB engagement is simply
  not available without a re-auth — do not promise a ranking that includes it.
- **Per-slide engagement inside a carousel does not exist on any platform.** "Which photo performed
  best" is unanswerable. The honest proxy is slide 1, the image that appeared in feed and therefore
  earned whatever the post earned.
- **`heart_count` on the site is a dead signal** — 17 hearts across 509 Sydney photos. Do not rank on it.
- **Age skews raw totals.** A post 5 days old beats one 5 hours old on volume alone; say so rather
  than presenting a leaderboard that is really an age ranking.
- **Reading a posting time back.** Facebook (`updated_time`), Instagram (the media `timestamp`) and
  YouTube (`datePublished` on the watch page) each hand back an exact instant. LinkedIn and TikTok
  do not — the UI shows a relative label ("2h ago", "2m ago") and nothing else, so their times are
  good to a few minutes. Record that difference rather than flattening it: the schedule log marks an
  inferred time with a leading `~` on the `<platform>_at` key and the interpreter sets
  `posted_at_estimated`.
- **An id's timestamp is the UPLOAD time, not the publication time.** A LinkedIn `ugcPost` URN
  (`id >> 22` = unix ms) and a TikTok item id (`id >> 32` = unix s) are both minted when the post is
  created. For a natively-scheduled post that is the night you staged it: Bring Me to Life decoded
  to 13 Sep 22:08 and 22:11 for posts that published 14 Sep 16:30 and 18:30. Use the id to find a
  post, never to date one.
- **You do not have to capture a LinkedIn URN at schedule time — it is recoverable.** Scheduling
  through the composer never shows you one, and the admin URL
  `/admin/page-posts/scheduled/` does not exist (it silently redirects to the dashboard; the
  scheduled list is only reachable via the composer's clock icon -> "View all scheduled posts").
  After it publishes, read the URN off the page-posts admin instead — every row carries a Boost
  link with the URN in its query string:

  ```js
  ;[...document.querySelectorAll('a[href*="content=urn"]')].map((a) =>
    decodeURIComponent(
      a.getAttribute('href').match(/content=(urn%3Ali%3A\w+%3A\d+)/)[1]
    )
  )
  ```

  Then **confirm which row is yours by decoding the snowflake** (`>> 22` = unix ms) against the time
  you built the post, not the time it published — that is what the bullet above means in practice.
  Sultans of Swing published 16 Sep 08:00 and its URN decoded to 16 Sep 00:25, the moment I typed
  the caption. The permalink is `linkedin.com/feed/update/<urn>/`.

- **Facebook's copyright check runs AFTER you schedule, and it is the one to re-read before the
  slot.** At `upload_phase=finish` the status comes back
  `copyright_check_status: {status: "in_progress"}` — that is not a pass, it is "not finished". Read
  it again nearer the publish time: Sultans of Swing (a Dire Straits cover) settled to
  `{status: "complete", matches_found: false}` about eight hours later. A cover that fails here is
  better known before the slot than after.
- **UTM-tag links that are meant to convert.** `src/lib/social/utm.ts` builds them and already treats
  Instagram as `social_bio` because captions are not clickable. First tagged post was the Brisbane
  gallery roundup, `utm_content=brisbane-2026-photos-roundup`.

## Connecting posts to the website (PostHog) — 30 Sep 2026

`node doc/production/scripts/social-site-attribution.mjs [--since YYYY-MM-DD] [--window-hours 48]
[--event sydney-2026] [--json]` joins the `posts` ledger to PostHog site sessions and
`tickets:clicked`. Read-only. A session's platform comes from `utm_source`, then the **in-app
browser user agent**, then `$referring_domain`; it is credited to the latest same-platform post in
the window before it, or exactly by `utm_content` when that matches a post.

- **The user agent is load-bearing.** The Facebook app strips the referrer: 156 of 218 Facebook
  sessions since 20 Aug (72%) were identifiable only by `FBAN`/`FBAV`/`FB_IAB` and would otherwise
  count as direct. Instagram (`Instagram`) and LinkedIn (`LinkedInApp`) apps are also tagged.
- **Time-window credit is correlation.** A band member's own share of the event page lands in the
  same window. Compare each post against the `baseline` column (that platform's average per
  window), and cross-check a headline number with a direct HogQL query before reporting it — the
  18 Sep Bandlassian FB post's 16 Sydney-page sessions were confirmed that way, first one 29 s
  after posting.
- **What it showed (20 Aug – 30 Sep):** direct 72% of 3,317 sessions; Facebook 218, LinkedIn 57,
  Instagram 55 (41 of them the tagged bio link), **YouTube 0, TikTok 0**. Ticket-click rate by
  session: LinkedIn 28%, Instagram 29%, Facebook 16%, search 13%. Posts that beat baseline were
  Facebook posts **with a link in the caption** (Sydney band announcements, photo posts); reels and
  videos without a link produced nothing measurable.
- `utm_source=drip, utm_campaign=yow Aug W4 2026` is the YOW! newsletter: 147 visitors to the
  Brisbane page on 26–28 Aug, zero ticket clicks. That is the unexplained 27 Aug spike.
- **None of 123 posts since 20 Aug carries a UTM**, though `posts.utm_*` columns exist. Tag every
  link (`pnpm bottb post link`) and store the `utm_content` on the post row; that turns window
  credit into exact credit.

## Choosing a thumbnail frame

Moved to `social/youtube.md` (2026-10-30).

## Improvements for next time

- Fix the app's LinkedIn OAuth connect (needs prod admin session) so LinkedIn can go via API
  (`uploadVideoToLinkedIn` already exists in `src/lib/social/video.ts`) — kills the manual upload
  and the mention dance; note the API still can't schedule, so publish from a job like IG.
- IG publishes ran from session-only cron jobs — fine when the session stays open all week, but a
  Vercel cron hitting an admin endpoint (or the schedule skill's cloud routines) would be sturdier.
- Consider re-titling YouTube uploads before the file finishes uploading fails — always retype after
  the Details step renders (see step 5).
- ~~Capture LinkedIn/IG/TikTok permalinks the day after each post~~ — superseded: LinkedIn URNs are
  recoverable from the admin Boost links at any time (see "Measuring what a post did"), so a missed
  capture is an inconvenience, not a loss. Still append them to the schedule log; FB
  and YouTube links are known at schedule time.
- Live posts can be corrected after the fact: LinkedIn (UI edit), Facebook (API), YouTube (Studio,
  see the execCommand recipe). **Instagram captions cannot be edited via the API** (app only) and
  TikTok needs a logged-in session — so proofread those two hardest before they publish.
