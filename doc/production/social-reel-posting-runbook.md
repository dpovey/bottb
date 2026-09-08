# Social reel posting runbook

How the Brisbane 2026 post-event reels were scheduled across five platforms (30–31 Aug 2026), with
everything that went wrong and the workarounds that stuck. Follow this for Sydney 2026 and later.
Copy + schedule for the Brisbane run: `brisbane-2026-reel-posts.md` and
`brisbane-2026-reel-schedule-log.jsonl` in this directory. The working Blob+FB+IG script is
`scripts/social-fbig.mjs` (run from repo root: `S=<state dir> node scripts/social-fbig.mjs <postKey>
<video path> <ISO time> <collab1,collab2>`; it reads captions from `posts.json` in `$S`).

## The pipeline per reel

1. **Brand the video** (ffmpeg): additive-blend the white-on-black `End Card.mov` logo over the first
   ~5 s, sped up 1.6×, scaled to ~150% width and cropped, sitting in the lower half, fade-out 0.8 s.
   Gotcha: `pad` silently clamps a y-offset that would overflow the frame — crop the logo canvas to fit
   _before_ padding, or the logo lands mid-frame. Keep output 1080×1920 H.264 + AAC, `+faststart`.
   On busy bright shots the additive logo washes out; acceptable, but check a frame.
2. **Upload the branded file to Vercel Blob** (`@vercel/blob` `put`, `social/<event>/<file>`,
   public, `allowOverwrite`). This single URL feeds Facebook, Instagram _and_ the YouTube browser
   trick.
3. **Facebook Reel via Graph API** (page token `META_PAGE_ACCESS_TOKEN`): `POST /{page}/video_reels`
   `upload_phase=start` → `POST rupload.facebook.com/video-upload/v21.0/{video_id}` with header
   `file_url: <blob url>` (no binary upload needed) → poll `{video_id}?fields=status` until
   `uploading_phase.status=complete` → `upload_phase=finish` with `video_state=SCHEDULED`,
   `scheduled_publish_time=<epoch>`, `description`. Permalink is `facebook.com/reel/{video_id}`
   immediately. FB captions: names only — the API cannot @-tag other Pages.
4. **Instagram Reel via Graph API** (same token; IG business id `17841461862790198`):
   `POST /{ig}/media` with `media_type=REELS`, `video_url=<blob url>`, `caption`,
   `share_to_feed=true`, `collaborators=["handle1","handle2"]` (max 3; each account gets an accept
   prompt). Poll container `status_code` until `FINISHED` (~1–2 min). Collaborators are creation-time
   only: to change them on a pending post, recreate the container; on a **published** post the API
   can do nothing — invite via the IG app (Edit → Invite collaborator; app allows ~5 vs the API's 3).
   Standing crew for Brisbane: videographers @quirkylikethat + @kurtboldy on every video post, so the
   3-cap list is [band company, @quirkylikethat, @kurtboldy]; if the band's company has no IG,
   use @youngcareoz as the third — NOT @thetriffid (they never accept collaborator invites). **IG cannot pre-schedule** —
   run `media_publish` with `creation_id` at post time from a scheduled job. **Containers expire in
   ~24 h and in practice every pre-built one died before its slot** (errors: subcode 2207032 "Cannot
   Create Media" / 2207020 "Expired Media"). Don't pre-build a week of containers — have the daily
   job build the container from the Blob URL and publish it in one go (~1–2 min), or at minimum keep
   the recreate-from-blob fallback that every Brisbane job ended up using. Business-discovery handle lookup is not permitted on this token; verify IG handles by
   loading instagram.com/<handle> in the browser.
5. **YouTube via Studio in Chrome** (the API key is read-only; no upload OAuth exists):
   - Channel: Battle of the Tech Bands `UCJVbMoGFRdQxVgHvW1heYCg` — Studio opens on Dean's personal
     channel by default; always navigate to
     `studio.youtube.com/channel/UCJVbMoGFRdQxVgHvW1heYCg/videos/upload?d=ud`.
   - Studio's CSP allows `fetch()` of the Blob URL, so inject the file with JS: fetch → `new File`
     → `DataTransfer` → set `input[name=Filedata].files` → dispatch `change`. Works for ~90 MB files.
   - **Wait for the dialog to actually render before typing title/description** — typing right after
     inject reliably vanishes; retype and verify.
   - Next ×3 → Visibility → Schedule. The date field is a text+calendar hybrid; click the calendar
     day (typing dates half-works), then the time field: End, backspace ×6, type `17:00`, **Tab**
     (Enter clears it). Time zone defaults to GMT+10 local. The shorts link
     (`youtube.com/shorts/<id>`) exists as soon as the upload starts — capture it then.
   - Covers trigger "Claimed content found" (Content ID). Posts still publish on schedule; revenue
     routes to rights holders. Glance at Studio → Content detection after uploading.
6. **LinkedIn via the page composer in Chrome** (no LinkedIn OAuth token is connected; the site has
   the connect flow but it needs an admin session, and the API can't schedule anyway):
   - The Chrome extension's `file_upload` tool caps at **10 MB** and LinkedIn/TikTok CSP blocks the
     fetch-inject trick, so **Dean drags the video into the composer manually**; the agent does copy,
     mentions and scheduling. (A ~9 MB 720p re-encode technically fits the tool but looks soft —
     don't.)
   - Mentions — the composer (Quill) fights automation; this exact loop is the only thing that
     worked. For each mention:
     1. In one `type` action, type text that **ends with** `@Page Name` (dropdown search tolerates
        the full display name).
     2. Wait ~3 s for the dropdown, then **Down, Return**. Return alone does NOT select — with no
        highlighted row it just inserts a newline into the post (first attempt produced five stray
        blank lines this way). Down first, always.
     3. After the chip inserts, the caret is inert: continuing to type in the same flow lands text
        in the wrong place and the next `@` never triggers the dropdown. **Right arrow does not fix
        it.** The only reliable reset: click on line 1 of the post, then **cmd+Down** to jump to the
        end, then continue typing.
        Known failure modes, all observed:
     - Typing `, @Name` straight after a chip → dropdown never appears (caret state, not the comma).
     - Backspacing near a chip is unpredictable — it can eat the chip or neighbouring characters
       (one attempt turned "Ten people" into "n people"). Prefer click + End/Home to reposition and
       retype small spans; avoid long backspace runs across chip boundaries.
     - `@Youngcare` resolved but left a literal `@` immediately before the chip once, and another
       time inserted a paragraph break mid-sentence — always run the JS check below and eyeball the
       rendered text before scheduling.
     - Escape (e.g. to close a hashtag dropdown) opens the "Save this post as a draft?" dialog;
       dismiss with its X, never Discard. Coordinates also shift as the post grows and as toasts
       appear — re-find buttons rather than reusing coordinates.
       Verify before scheduling with JS on the dialog: `[...ed.querySelectorAll('a.ql-mention')]`
       lists the chips in order (compare against the intended tag list), `ed.innerHTML.match(/@<a/g)`
       catches stray `@`s, and mapping `p.innerText.length` over paragraphs catches stray blank lines
       (pattern: text,1,text,1,… — any run of 1s means extra empties to remove).
   - Schedule: clock icon → date (calendar click) → time (type `4:30 PM`, click the suggestion
     option) → Next → Schedule. Scheduled posts have **no permalink until they publish**.
7. **TikTok via TikTok Studio in Chrome** (Content Posting API needs app review — not worth it):
   - Account: **@bottb0**. Direct navigation to `/upload` or `/tiktokstudio/*` hits a "Please wait…"
     bot check that never resolves; **navigate to tiktok.com/explore, then click Upload in the
     sidebar**. Same for getting back after posting: Home → Upload.
   - Dean uploads the file manually (same 10 MB extension cap). Then: caption (plain text; the
     `#`/`@` pickers exist but plain hashtags in text work), Location chip "The Triffid", Schedule
     radio → date via calendar → time via the two scroll columns (click values to re-centre the
     wheel; it drifts — verify with a zoom before submitting). Allows scheduling ≤10 days out.
   - After Schedule it lands on /tiktokstudio/content — the new post can take a reload to appear;
     don't panic and don't double-post. **Getting permalinks: never map video ids from the Studio
     list's anchors or profile-grid tile order — both burned us with swapped links.** The reliable
     check is TikTok's oEmbed (no login needed): `curl
"https://www.tiktok.com/oembed?url=https://www.tiktok.com/@bottb0/video/<id>"` returns the
     caption for published videos (400 while still scheduled) — match the caption before sharing a
     link. Scheduled posts have pre-assigned ids that appear in page HTML before publish, which is
     why an unverified link can point at a not-yet-public post. Web sessions also log out
     spontaneously after a few days; scheduled posts still publish server-side.

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

- **Site access is per-domain** and granted from the page side: if navigation to a domain is
  refused, have Dean open the site and click the Claude extension icon there once (that's how
  tiktok.com got unlocked; there's no obvious allowlist UI). battleofthetechbands.com itself was never granted,
  so OAuth connect flows on our own admin can't be driven by the agent — Dean clicks those.
- **Work only in the session's own "Claude" tab group.** Dean once uploaded a video in a second
  Claude tab group from another session; those tabs are invisible to this session and Chrome refused
  to drag the tab across groups. Rule: Dean does manual uploads in the tabs this session opened
  (they're grouped together, next to the LinkedIn tab), never in a fresh window.
- **Spurious "Navigation to this domain is not allowed"** occasionally appears for a domain that
  worked minutes earlier (hit it with studio.youtube.com after a TikTok visit in the same tab).
  Don't debug it — create a new tab and navigate there.
- **JS results containing URLs/query strings can come back `[BLOCKED: Cookie/query string data]`** —
  have injected scripts return short plain strings (counts, booleans, text slices), not full hrefs.
- **YouTube's confirmation toast lies**: a scheduled Short can pop "Video published". Trust the
  "Video scheduled — public on <date> at <time>" dialog, or reopen the video's Visibility; the Data
  API (read key) returning no item for the ID is also consistent with private-until-scheduled.
- TikTok's caption box: after typing, press Escape only to close its own hashtag dropdown — on
  LinkedIn Escape means "discard?", and a triple-click on some fields triggers macOS's dictionary
  "No definition found" popover; both are harmless but occlude clicks, so re-screenshot after.

### LinkedIn composer — the caret trap (learned the hard way, 7 Sep 2026)

Inserting a mention chip moves the caret to **immediately after the chip**, and it _snaps back
there_ after any non-typing action (a screenshot, a key press). So a later `type` call lands its
text in the middle of the sentence, and a `BackSpace` eats the chip instead of the character you
meant. This is what produced "Rex Software Limited are your..." mid-post.

**SUPERSEDED — do not follow this.** An earlier version of this section said "type the whole caption
in ONE `type` action with plain company names". That was a workaround written before the caret
behaviour was understood, and following it on 8 Sep shipped a LinkedIn post with the major sponsor
in plain text. **The mandatory method is in "HARD RULE — LinkedIn mentions are mandatory" above:**
build the caption forward, chip by chip, typing the remainder immediately after taking each chip.
A proven fix supersedes the workaround it replaced; if these two sections ever disagree again, the
hard rule wins.

Other composer facts, verified:

- The file input does not exist until the media button is clicked, and clicking it opens a **native
  file dialog that blocks CDP entirely**. Patch it out first:
  `HTMLInputElement.prototype.click` → capture `this` and return, for `type === 'file'`.
- Do NOT fetch images from Vercel Blob inside the LinkedIn page: its CSP blocks the request
  ("Failed to fetch"), regardless of the blob's CORS headers.
- Use the extension's `file_upload` tool with the input's ref instead. It only accepts paths the
  session may read, so **copy the files into the session scratchpad first** — a path under
  `~/src/...` is rejected. 9 x 250 KB was fine; the cap is 10 MB per call.
- `cmd+a` then `Delete` in the composer clears the text but **leaves the attached images**, so a
  botched caption is cheap to redo.

### TikTok photo posts

TikTok Studio has a **Photos** tab beside Videos (`/tiktokstudio/upload?tab=photo`). Same
`file_upload` route; the first image becomes the Cover. Title is capped at 90 chars, description 4000. Typing `#tag` opens a suggestion dropdown — **never press Enter**, click a neutral area to
dismiss it, or you will insert the wrong tag. Set Location to The Triffid. Posting redirects to
`/tiktokstudio/content`; get the permalink from that list, then **confirm it with oEmbed**
(`https://www.tiktok.com/oembed?url=...`) before sending it to anyone — list order has mismatched
before. A just-posted item returns an empty oEmbed title until it finishes processing.

### WhatsApp summaries — give them as plain text

Dean pastes these straight into WhatsApp. **Never format them as a markdown blockquote** (`> `) or
wrap them in a code fence — the quote bars come along and he can't use it. Plain lines, one link
per line, labelled by platform. Send one as each post goes live, and again consolidated when every
platform for that item is up.

## Scheduling doctrine (AU)

One burst per day so each band has a single moment to amplify: **LinkedIn 4:30 pm → YouTube 5:00 →
IG + FB 6:00 → TikTok 6:30** (AEST); weekend variant 10:30 am → 11:00 → 11:30 → 12:00. Order the week
Night-highlights first, then bands in winning order. Sources and per-platform research are in
`brisbane-2026-reel-posts.md`.

## HARD RULE — LinkedIn mentions are mandatory, not optional

**Every LinkedIn post MUST @mention Jumbo Interactive Limited.** They are the major sponsor and
plain text does not credit them. This is not a nice-to-have and not something to skip because the
composer is awkward. Dean called this out on 8 Sep 2026 after I shipped a post with plain names.

**Before posting to LinkedIn, review the caption and mention every entity that has a page:**
Jumbo Interactive Limited (ALWAYS), the band's company (Epsilon / Rex Software / URBAN X /
Suncorp Group / For The Record (FTR)), and Youngcare. Check the draft for any company named in
plain text that should be a chip.

**Use the company's FULL registered name** — a partial name silently returns nothing from the
typeahead (`Jumbo Interactive Limited` works, `Jumbo Interactive` does not; `Rex Software` works,
`Rex` returns people).

**The technique that works** (proven 7 Sep, and the caret rule that explains it):

1. Type the caption up to and including `@Full Company Name`.
2. Down, then Return, to take the chip.
3. Type the remainder.

The caret always resets to **immediately after the most recent chip** on any non-typing action
(screenshot, JS call, key press). That is harmless while the chip is the last thing in the box — so
it is safe to screenshot and confirm the right entry is highlighted BEFORE taking it. It is
destructive once you have typed past the chip: a later `type` lands mid-sentence and `BackSpace`
eats the chip. So never go back to add a mention; build the caption forward, chip by chip.

**Verify before clicking Post:**
`document.querySelector('.ql-editor').querySelectorAll('[data-entity-urn]').length` — must equal the
number of mentions you intended, and the text must contain no stray `@`.

## Handles / tags (verified Aug 2026)

| Who                         | LinkedIn page                        | Instagram                  | Facebook             | Notes                                                                                      |
| --------------------------- | ------------------------------------ | -------------------------- | -------------------- | ------------------------------------------------------------------------------------------ |
| BotTB                       | battle-of-the-tech-bands             | @battleofthetechbands      | page 207312765803305 | TikTok @bottb0, YouTube @battleofthetechbands                                              |
| Jumbo Interactive (sponsor) | jumbo-interactive-limited            | — none                     | /JumboInteractive    | name-only on IG/TikTok                                                                     |
| Youngcare                   | youngcareoz                          | @youngcareoz               | /YoungcareOz         | YouTube @YoungcareOz; no TikTok → use #youngcare                                           |
| Rex Software                | rex-software                         | @rex_software              | /rexsoftware         |                                                                                            |
| URBAN X                     | urbanx                               | @urbanx.io                 | /URBANX.IO           |                                                                                            |
| Epsilon                     | epsilon                              | @epsilonmarketing (global) | /EpsilonMarketing    |                                                                                            |
| Suncorp                     | suncorp ("Suncorp Group")            | @suncorp                   | /suncorpAUNZ         | /SunCorp is someone else                                                                   |
| For The Record              | ftr-limited ("For The Record (FTR)") | — none                     | — none found         | LinkedIn only                                                                              |
| The Triffid                 | —                                    | @thetriffid                | /thetriffid          | TikTok location yes; **do NOT use as IG collaborator — they never accept invites**         |
| Amy Corrie (photographer)   | —                                    | @amyjuliaaaaa              | —                    | Brisbane 2026 stills. Credit "Photos by Amy Corrie"; IG collaborator (Dean approved 7 Sep) |
| Aaron Griffiths (video)     | —                                    | @quirkylikethat            | —                    | Videographer — video posts only, never photo posts                                         |
| Kurt Boldy (video)          | —                                    | @kurtboldy                 | —                    | Videographer — video posts only, never photo posts                                         |

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
- Voice rules that survived review: no em dashes, no "the moment when", no rule-of-three, no
  "it's not X it's Y", no emoji bookends, first-person "we", lead with a detail someone in the room
  would recognise. Don't invent crowd reactions ("got its own cheer") — Dean cut every one; stick to
  facts and structure ("built around", "closed on").
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
  centre-crops previews — looks "converted to vertical". Fix: render a 9:16 canvas with the full
  16:9 frame centred over a blurred, slightly darkened fill
  (`scale=1080:1920:force_original_aspect_ratio=increase,crop,gblur` bg + overlay), then post that.
  There is no API delete — remove a bad IG post via instagram.com ⋯ → Manage post → Delete.
- Big masters (4.8 GB ProRes-ish renders) exceed IG's ~1 GB limit: make a ~10 Mbps H.264 social
  master first; it also spares Dean the giant manual uploads for LinkedIn/TikTok.

## YouTube thumbnails (offline generator)

Full-song videos get a custom thumbnail in the same house layout as the in-app generator
(`/admin/thumbnails`): frame + top/bottom scrims, company logo one top corner, BoTTB square the
other (default `top-right`), artist bold + song under it bottom-left in Jost.

Rather than driving the browser tool, run the layout offline:

- `doc/production/scripts/thumbnail/compose.mjs` — a direct port of
  `src/app/admin/thumbnails/compose.ts` (`composeYouTube`) plus the `src/lib/canvas.ts` helpers
  (`drawCover`, `drawLogoRow`, `trimTransparent`, `wrapLines`) and `video-safe-area.ts` constants.
  If the in-app layout changes, re-port it.
- `doc/production/scripts/thumbnail/render.mjs` — CLI wrapper. Run it from a scratch dir that has
  `npm i @napi-rs/canvas` (prebuilt binary, no compile; it reads the repo's
  `public/fonts/jost-latin.woff2` straight as woff2).

Picking the still:

1. gigstills already has Dean's selects — `~/src/personal/gigstills/runs/bottb_camA/state.json`,
   `candidates[]` with `band`, `selected`, `rank` (lower is better), `keywords`
   (`keys`/`drummer`/`guitarist`/`crowd`/`wide`), `show_clock` and `t` (seconds into the clip).
2. Narrow to the song by time: the band's set ends at the last candidate's `show_time`, and the
   song length comes from `runs/bottb-cut/cut_list.json` (`record_in`/`record_out` at 25 fps).
   Sanity-check by extracting the matching frame from the delivered render and eyeballing it.
3. Extract at full 4K from the camera master, not the graded JPEG proxies:
   `ffmpeg -ss <t> -i "/Volumes/BOTTB/Footage/CAM A (Roaming)/<clip>.MP4" -frames:v 1 -q:v 2 out.jpg`
4. Offer Dean a spread of shots (lead vocal, keys, guitarist, drummer, crowd, band-wide) — he picks.
   Contact sheet: `ffmpeg -pattern_type glob -i '*.jpg' -filter_complex "scale=960:540,tile=2x4:padding=8" -frames:v 1 _contact-sheet.jpg`

Company logo comes from the DB (`companies.logo_url`, a Vercel Blob URL) — `curl` it down and let
`trimTransparent` crop the baked-in padding. Finals live in
`/Volumes/BOTTB/Renders/Thumbnails/<Song>/`. YouTube caps thumbnails at 2 MB; the CLI steps the
JPEG quality down until it fits.

## Photo posts (stills) — settled Sep 2026, not yet exercised

First run: Amy Corrie's Brisbane 2026 stills, six posts (one per band + one audience/community),
prepared by the `cut-recipe-colour-correction` session under
`gigstills/runs/amy-labels/social/<post>/`.

- **Crops are for Instagram and Facebook only.** Dean's rule (7 Sep 2026), and I got this wrong on
  the ShipReX post by sending the 4:5 crops to LinkedIn too:
  | Platform | Asset |
  |---|---|
  | Instagram | 1080x1350 4:5 crop (hard aspect limits, and a carousel forces the first slide's ratio on the rest) |
  | Facebook | the same 4:5 crop |
  | LinkedIn | **the ORIGINAL photo, uncropped, native aspect** — LinkedIn happily mixes portrait and landscape in one post |
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
- **IG collaborators do not survive scheduling.** Business Suite has Tag People -> Invite
  Collaborator, but it is reported not to carry on a _scheduled_ post — the invite has to be added
  after it publishes (open post -> Edit -> Invite collaborator). Verify on the first post before
  queuing the rest. (Reported, not yet confirmed by us.)
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

`doc/production/scripts/blob-upload.mjs <file> [blob-path]` — prints `BLOB_URL`.

**Run it with the repo root as cwd.** It resolves `@vercel/blob` and `.env.local` from there; a copy
run out of the scratchpad dies with `ERR_MODULE_NOT_FOUND` in under a second. On 7 Sep that failure
was invisible because the job was detached — the log said the upload never happened while the plan
assumed it had. Always read the log for `BLOB_URL` before moving on.

Verified 7 Sep 2026: uploads return `HTTP 200` with `access-control-allow-origin: *`, which is what
makes the YouTube Studio cross-origin fetch-inject work. Use `multipart: true` for the big masters.
Delete throwaway blobs with `del(url, {token})` — they are public until you do.

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

### 8 Sep 2026 — Amy Corrie photo run

| #   | What happened                                                                                                                                                                                  | Why it mattered                                                                             | What changed                                                                                                                                                                                                                                                                                                                                     |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **The five photo posts were never scheduled.** I prepared captions, crops and LinkedIn assets on 7 Sep and stopped there. Epsonics was due 09:00 and had not gone out when Dean asked at 09:55 | A whole day's post silently missed. Nobody would have noticed until Dean asked              | Facebook is now scheduled **natively** for all four remaining posts, so they fire even if this session dies (it died twice on 7 Sep). Never rely on a session-only cron for a multi-day schedule: IG has no scheduling API, so only IG/LinkedIn/TikTok need a live session, and that limitation must be stated to Dean rather than left implicit |
| 2   | I posted the Epsonics LinkedIn caption with **plain-text company names**, no mentions, despite having proven the mention technique the day before                                              | Jumbo Interactive is the major sponsor and got no credit. Dean had to edit the post himself | See the HARD RULE section above. Root cause was mine: I reverted to the older "type it all in one block" workaround because it felt safer, after already learning the correct method. A proven fix supersedes the workaround it replaced                                                                                                         |
| 3   | A stale scheduled FB post would have **republished The Chain on Sat 12 Sep using the old flickery file**                                                                                       | A duplicate post with a known-bad video                                                     | Deleted with Dean's approval. Lesson: when a post is held and pushed to a later date, it stays on the schedule after the real post ships — always re-check `/{page}/scheduled_posts` after a held item is finally published                                                                                                                      |
| 4   | The FB handle-swap turned a standalone `@epsilonmarketing` line into a one-word paragraph reading "Epsilon"                                                                                    | Ugly orphan line, caught only by the `--dry` run                                            | **Always `--dry` first** and read the rendered caption for both platforms. Never leave a bare @handle on its own line — fold the company into a sentence                                                                                                                                                                                         |

## Improvements for next time

- Fix the app's LinkedIn OAuth connect (needs prod admin session) so LinkedIn can go via API
  (`uploadVideoToLinkedIn` already exists in `src/lib/social/video.ts`) — kills the manual upload
  and the mention dance; note the API still can't schedule, so publish from a job like IG.
- IG publishes ran from session-only cron jobs — fine when the session stays open all week, but a
  Vercel cron hitting an admin endpoint (or the schedule skill's cloud routines) would be sturdier.
- Consider re-titling YouTube uploads before the file finishes uploading fails — always retype after
  the Details step renders (see step 5).
- Capture LinkedIn/IG/TikTok permalinks the day after each post and append to the schedule log; FB
  and YouTube links are known at schedule time.
- Live posts can be corrected after the fact: LinkedIn (UI edit), Facebook (API), YouTube (Studio,
  see the execCommand recipe). **Instagram captions cannot be edited via the API** (app only) and
  TikTok needs a logged-in session — so proofread those two hardest before they publish.
