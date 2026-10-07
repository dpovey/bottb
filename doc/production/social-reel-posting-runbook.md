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
   public, `allowOverwrite`). This URL feeds Facebook and the YouTube browser trick.
   **Instagram needs a second, 1080p upload — the 4K master does not work there** (see step 4).
   Upload both up front on a 4K job; the 1080p is already rendered beside the master in
   `TO_POST_<song>/` because LinkedIn and TikTok want it too.
3. **Facebook Reel via Graph API** (page token `META_PAGE_ACCESS_TOKEN`): `POST /{page}/video_reels`
   `upload_phase=start` → `POST rupload.facebook.com/video-upload/v21.0/{video_id}` with header
   `file_url: <blob url>` (no binary upload needed) → poll `{video_id}?fields=status` until
   `uploading_phase.status=complete` → `upload_phase=finish` with `video_state=SCHEDULED`,
   `scheduled_publish_time=<epoch>`, `description`. Permalink is `facebook.com/reel/{video_id}`
   immediately. **`copyright_check_status` is NOT a top-level field** — asking for
   `?fields=copyright_check_status` returns `(#100) Tried accessing nonexisting field`. It is nested
   under `status`, so query `?fields=status` and read `status.copyright_check_status`, which sits
   alongside `uploading_phase`, `processing_phase` and `publishing_phase`. (Confirmed 21 Sep 2026;
   the earlier wording here implied a top-level field.)

   **`GET /{page}/scheduled_posts` lags the video object — do not use it as an emptiness check
   while a reel is still processing.** A reel scheduled at 12:02 read `published=false`,
   `scheduled_publish_time` correct and `length` correct on its own object, while the page's
   `scheduled_posts` edge returned an empty list for minutes afterwards, because the video was still
   `processing`. Read the video by id for the authoritative answer; the sweep is only trustworthy
   once `status.video_status` is `ready`. (21 Sep 2026 — the empty sweep briefly looked like the
   schedule had failed, and on a different day could just as easily look like nothing is scheduled
   when something is.) FB captions: names only — the API cannot @-tag other Pages.

4. **Instagram Reel via Graph API** (same token; IG business id `17841461862790198`):
   `POST /{ig}/media` with `media_type=REELS`, `video_url=<1080p blob url>`, `caption`,
   `share_to_feed=true`, `collaborators=["handle1","handle2"]` (max 3; each account gets an accept
   prompt). Poll container `status_code` until `FINISHED` (~1–2 min). Collaborators are creation-time
   only: to change them on a pending post, recreate the container; on a **published** post the API
   can do nothing — invite via the IG app (Edit → Invite collaborator; app allows ~5 vs the API's 3).
   Standing crew for Brisbane: videographers @quirkylikethat + @kurtboldy on every video post, so the
   3-cap list is [band company, @quirkylikethat, @kurtboldy]; if the band's company has no IG,
   use @youngcareoz as the third — NOT @thetriffid (they never accept collaborator invites). **IG cannot pre-schedule** —
   run `media_publish` with `creation_id` at post time from a scheduled job. **A session cron does
   not give you the time you asked for.** Jobs fire only while the session's REPL is idle, with
   jitter on top, so the real behaviour is "whenever the session is next free". Sultans of Swing was
   set for 17:28 AEST on 16 Sep and published at 21:27:58 — four hours late, into the tail of the IG
   evening peak instead of its middle. Nothing looked broken and nobody noticed for five days. So:
   record the scheduled time AND the actual time in the ledger for anything published from a session
   cron, treat a gap as a defect rather than a success, and tell Dean in plain words that IG is the
   one platform whose slot cannot be guaranteed. **Containers expire in
   ~24 h and in practice every pre-built one died before its slot** (errors: subcode 2207032 "Cannot
   Create Media" / 2207020 "Expired Media"). Don't pre-build a week of containers — have the daily
   job build the container from the Blob URL and publish it in one go (~1–2 min), or at minimum keep
   the recreate-from-blob fallback that every Brisbane job ended up using. Business-discovery handle lookup is not permitted on this token.

   **Do not "verify" a handle by loading instagram.com/<handle>** — this runbook said to and it
   proves nothing. Logged out, Instagram serves the same gated page for every path: a handle
   invented on the spot returns HTTP 200 with `<title>Instagram</title>`, exactly like a real one.
   The Graph API's own validation is the only check that works. If a container is refused with
   code 210 / subcode 2207066 ("The user <handle> cannot be tagged on this media"), the error names
   only the first bad handle, so **probe each one alone** — build a throwaway container per handle
   and see which come back with an id. Throwaway containers cost nothing; they expire unused.

   Known: **`jumbointeractive` is NOT taggable** (refused 14 Sep 2026), so a Jumbo Band post's three
   slots are @quirkylikethat, @kurtboldy, @youngcareoz. When a company cannot be tagged, also strip
   the `@` from its mentions in the caption body and write the name in full — an `@` that resolves
   to nothing reads worse than plain text.
   **Instagram's real limits, from the `POST /{ig-user-id}/media` reference — not inferred:**

   |               |                                                                                 |
   | ------------- | ------------------------------------------------------------------------------- |
   | Duration      | **15 min max**, 3 s min                                                         |
   | **File size** | **300 MB max**                                                                  |
   | Resolution    | 1080x1920 recommended, 540x960 min                                              |
   | `cover_url`   | JPEG, **8 MB max**, 9:16 recommended; **overrides `thumb_offset`** if both sent |

   **The 300 MB cap is the one that bites, and this runbook previously said 1 GB — which was wrong
   and cost an evening.** That figure was inferred from a 4K rejection rather than read from the
   reference. Sultans of Swing (1080p, 517 MB, 5:55) was refused three times with
   `"Media upload has failed with error code 2207053"` — with a cover, with a corrected cover, and
   with no cover at all — while the identical bytes sat published on Facebook. A 300 MB-compliant
   re-encode at 6.3 Mb/s fixed it with no edit to the cut.

   Two traps in diagnosing this:
   - **Size and duration move together** on our ~12 Mb/s encodes, so a size limit looks exactly like
     a duration limit. Our post history brackets "works at 4:59, fails at 5:55" — which is true and
     entirely misleading. Check bytes against 300 MB before theorising.
   - **Enforcement is soft near the line.** 337 MB and ~430 MB files have gone through; 517 MB does
     not. Do not treat a past success slightly over the cap as proof the cap is not real.

   **A 4K master is refused separately**, with `2207076` after ~50 s. Same shape of generic message,
   different code. The same master uploads to YouTube and Facebook without complaint, so either code
   on a file those two accepted means "re-encode for Instagram", not "the file is broken".

   **Meta's own Reels spec page says "3 to 90 seconds" and is wrong by a factor of ten** — we have
   published 3:51 and 4:59 reels to Instagram and 5:55 to Facebook. Use the `ig-user/media`
   reference above, not the spec page.

5. **YouTube via Studio in Chrome** (the API key is read-only; no upload OAuth exists):
   - Channel: Battle of the Tech Bands `UCJVbMoGFRdQxVgHvW1heYCg` — Studio opens on Dean's personal
     channel by default; always navigate to
     `studio.youtube.com/channel/UCJVbMoGFRdQxVgHvW1heYCg/videos/upload?d=ud`.
   - Studio's CSP allows `fetch()` of the Blob URL, so inject the file with JS: fetch → `new File`
     → `DataTransfer` → set `input[name=Filedata].files` → dispatch `change`.
   - **Size is not the constraint people assume.** This has carried a 1.69 GB master (The Chain,
     7 Sep) and a 1.30 GB master (Bring Me to Life, 13 Sep — 1,299,723,260 bytes, fetched in 37.7 s).
     An earlier note here said "works for ~90 MB files" and led to telling Dean that YouTube needed a
     manual upload; that was wrong by more than an order of magnitude. **The 10 MB cap is on the
     Chrome extension's own `file_upload` tool, NOT on the fetch-inject.** Only LinkedIn and TikTok
     genuinely need Dean, because their CSP blocks the fetch.
   - Run the fetch **asynchronously** and poll a `window.__inj` state object — a 1.3 GB fetch will
     outlast the JS tool's own timeout if you await it inline.
   - Memory: the naive version holds the response buffer plus the `File` copy, so budget ~2x the
     file size as a transient Chrome peak (~2.6 GB for a 1.3 GB master). **Use `response.blob()`,
     not `response.arrayBuffer()`** — Blobs spill to disk, which held Chrome's peak to ~0.45 GB on
     a 1.19 GB master (measured 20 Sep 2026) instead of ~2x. Check available RAM first on this
     machine either way; Chrome is exempt from mem-guard, so nothing will stop it if it goes wrong.
   - **localhost HTTP is not a shortcut for getting a file into the page.** Chrome blocks the
     request from an HTTPS page before it leaves, so the local server's log stays empty and it looks
     like the page never tried. The Vercel Blob hop is load-bearing, not a convenience.
   - **Wait for the dialog to actually render before typing title/description** — typing right after
     inject reliably vanishes; retype and verify.
   - Next ×3 → Visibility → Schedule. The date field is a text+calendar hybrid; click the calendar
     day (typing dates half-works), then the time field: End, backspace ×6, type `17:00`, **Tab**
     (Enter clears it). Time zone defaults to GMT+10 local. The shorts link
     (`youtube.com/shorts/<id>`) exists as soon as the upload starts — capture it then.
     **6 Oct 2026:** triple-click + type left the field on 00:00 ("Select a time in the future"); a single click, cmd+a,
     type `14:00`, then click the matching `tp-yt-paper-item` worked. The open list is fixed-position, so `offsetParent`
     is null for every option: find the visible one by `getBoundingClientRect().width > 0`, not `offsetParent`.
   - Covers trigger "Claimed content found" (Content ID). Posts still publish on schedule; revenue
     routes to rights holders. Glance at Studio → Content detection after uploading.
   - **Fill the "Show more" settings on every upload (Dean, 2026-10-05: "youtube have a lot of other settings like
     recording data and location we have not been setting").** Before Visibility, open **Show more** on the Details step and set:
     - **Recording date** = the show date from the DB (`events.date` in the event's timezone), not the upload date.
       Sydney 2025 = 23 Oct 2025 (DB 2025-10-23 18:30 Australia/Sydney; camera files `*_20251023_*`).
     - **Video location** = the venue as Google Maps names it (Sydney 2025: The Factory Theatre, Marrickville; Sydney 2026:
       Manning Bar). Take the venue from `events.location`.
     - **Category: Music. Language: English.** **Made for kids: No** (Audience step).
     - **Altered or synthetic content ("AI use"): No** on every live-performance upload (Dean, 2026-10-05). YouTube's
       help page (support.google.com/youtube/answer/14328491, checked 5 Oct) exempts colour/lighting adjustment, beauty
       and effects filters and production assistance; disclosure is for AI that makes a real person appear to say or do
       something they didn't, alters footage of a real event, or generates a realistic scene. Our grade, Face Refinement,
       Super Scale, stem-split remix and pitch correction of the band's own performance are enhancement. Answer Yes only
       if a video ever carries a cloned voice or generated realistic footage.
     - **Allow embedding: ON.** The site embeds every video from the `videos` table, so this is load-bearing.
     - Tags: band, company, songs, "Battle of the Tech Bands", city + year.
       Check the field names in Studio the first time (this list was written from Dean's report, not a walk-through) and
       correct this entry. For videos already up, the same fields are on each video's edit page; backfill them.
   - **Title cap is 100 characters, hard.** The house format
     `{artist} - {song} (Live Cover) - {company} - Brisbane Battle of the Tech Bands {year}` came to
     104 for Bring Me to Life and would not have fitted. Shorten the event, not the sponsor:
     `... - Jumbo Interactive - BoTTB Brisbane 2026` is 85 and "BoTTB" already has precedent in the
     ShipReX title. Check the length before typing it.
   - **The thumbnail library** lives at `/Volumes/BOTTB/Renders/Thumbnails/<SongInCamelCase>/`,
     named `<band-slug>-<song-slug>-<platform>.jpg`, one per platform: `youtube` and `linkedin` at
     1920x1080, `instagram` at 1080x1920. Dean exports them to `~/Downloads`; file them here and
     clear Downloads. Reusable art such as `thumbnail-overlay-4k.png` goes in `_templates/`, never
     under a song. Drop an `UPLOAD_NOTES.txt` beside the images carrying the file paths, title,
     description and the after-publish steps — it makes the upload self-serve and outlives the
     session that wrote it.
   - **Thumbnail cap is 2 MB.** A 1920x1080 PNG export runs 2.5–3 MB and is rejected at upload.
     Convert to JPEG q92: ~0.36 MB, still 1920x1080, no visible artefacts on logo or type.
   - **External links in descriptions are not clickable until the channel completes a one-off
     verification.** Studio says so under the description box. Until that is done, every URL we put
     in a description renders as plain text, which defeats the point of putting a gallery link there.
6. **LinkedIn via the page composer in Chrome** (no LinkedIn OAuth token is connected; the site has
   the connect flow but it needs an admin session, and the API can't schedule anyway):
   - The page admin is reached by numeric id, not slug: `linkedin.com/company/104393733/admin/page-posts/published/?share=true`
     opens the composer (the slug URL says "This LinkedIn Page isn't available", 1 Oct 2026).
   - After Dean's drag the Editor opens on **Add captions** with auto captions ON: switch it off
     **6 Oct 2026:** after Post on a 385 MB video, the post took ~2 min to appear in the page feed and the tab
     raised "Leave site?" the whole time (the upload is still running in that tab). Check from a second tab;
     never force-navigate the posting tab. Auto captions came up ON again on this video (OFF on a 27 MB one).
     for sung vocals, Apply, Next. No video-title field was offered in the page composer on 1 Oct.
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
   - - **LinkedIn rewrites URLs to its own shortener on save.** A caption containing
       `https://youtu.be/<id>` reads back as `https://lnkd.in/<hash>` after the post is saved, so
       verifying a link by substring-matching the original URL returns false and looks exactly like a
       failed edit. It is not. Check for `lnkd.in`, or follow the shortened link, rather than grepping
       for the URL you typed (21 Sep 2026).
   - **Posts are editable after publishing**, which is the escape hatch when a link did not exist at
     compose time. Verify mention chips survived the edit **after a full page reload**, not from the
     edit dialog.
     Schedule: clock icon → date (calendar click) → time (type `4:30 PM`, click the suggestion
     option) → Next → Schedule. Scheduled posts have **no permalink until they publish**.
7. **TikTok via TikTok Studio in Chrome** (Content Posting API needs app review — not worth it):
   - Account: **@bottb0**. Direct navigation to `/upload` or `/tiktokstudio/*` hits a "Please wait…"
     bot check that never resolves; **navigate to tiktok.com/explore, then click Upload in the
     sidebar**. Same for getting back after posting: Home → Upload.
   - Dean uploads the file manually (same 10 MB extension cap). Then: caption (plain text; the
     `#`/`@` pickers exist but plain hashtags in text work), Location chip "The Triffid", Schedule
     radio → date via calendar → **time via the two scroll columns — CLICK, never scroll or drag.**
     The wheel ignores mouse-wheel events and drag entirely; it only moves when you **click a
     value**, which re-centres the list on that value and reveals three more either side. So to
     reach 09:00 from a default of 23:15 you click the topmost visible hour repeatedly (23 → 20 →
     17 → 14 → 11 → 08) until the hour you want is on screen, then click it, then click the minute.
     Roughly five clicks, not a scroll. **A wheel that will not scroll is not a wheel that is
     restricted to the hours it is showing** — that misreading cost a long detour on 27 Sep, where
     only 20–23 were visible and it looked like TikTok had capped the schedule window. Verify the
     final value with a `zoom` on the two columns before submitting. Allows scheduling ≤10 days out.
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
  "Video scheduled — public on <date> at <time>" dialog, or reopen the video's Visibility.

- **oEmbed CANNOT tell public from unlisted — do not use it as a visibility check.** It returns
  HTTP 200 with the correct title for BOTH. Proven 21 Sep 2026 with a control, which is the only way
  this kind of claim should be made:

  | video                   | actual   | oEmbed  | Data API `status.privacyStatus` |
  | ----------------------- | -------- | ------- | ------------------------------- |
  | `8YIPtpb5-0s` (Sultans) | public   | **200** | `public`                        |
  | `zgtbqLOIOBU`           | unlisted | **200** | `unlisted`                      |
  | `Fof1cfAv_g0`           | deleted  | 404     | no item                         |

  oEmbed only separates _exists_ from _deleted_. **The authoritative check is the Data API with the
  read-only key**, which needs no OAuth:

  ```bash
  K=$(grep '^YOUTUBE_API_KEY=' .env.local | cut -d= -f2- | tr -d '"')
  curl -s "https://www.googleapis.com/youtube/v3/videos?part=status&id=<ID>&key=$K"
  ```

  `privacyStatus` is `public` / `unlisted` / `private`; **no item at all** means deleted or private.
  This matters because an unlisted id in a caption is a link the public cannot open — the same
  user-visible failure as a dead one, and it passes a naive oEmbed gate silently. An earlier note
  here and in the Sultans ledger entry said "oEmbed 200 with the right title confirms public". That
  was wrong, and a rebuild script was briefly gated on it.

  **`privacyStatus: public` is not the same as watchable.** Public describes the video's visibility
  setting, not a viewer's ability to play it: a public video can still be region-blocked. Every song
  we post is a cover, so this is the normal case rather than an edge case.

  **`contentDetails.regionRestriction` DOES surface region blocks on the read-only key** — verified
  21 Sep 2026 against a blocked video and a clean control, which is the only way this should be
  claimed:

  | video                          | privacyStatus | `regionRestriction`   |                                     |
  | ------------------------------ | ------------- | --------------------- | ----------------------------------- |
  | `2t0zoh-ZJO4` (Jumbo full set) | public        | `{"blocked": ["RU"]}` | reads "Partially blocked" in Studio |
  | `8YIPtpb5-0s` (Sultans)        | public        | absent                | control                             |
  | `zgtbqLOIOBU`                  | unlisted      | absent                | control                             |

  So the full gate is: **refuse unless `privacyStatus == "public"` AND (`regionRestriction` is absent
  OR its `blocked` list excludes `AU` OR its `allowed` list includes `AU`)**. Handle `allowed` as
  well as `blocked` — an allow-list that omits AU is a block by another name.

  **Scope limit, deliberately not overstated:** this is verified for _region_ blocks only. A full
  Content ID takedown or a forced mute may present differently and there is no control to test that
  with, so do not read a clean `regionRestriction` as "no copyright problem". For that, still glance
  at Studio → Content detection. The RU block above affects none of our audience; what it proves is
  the mechanism, not a live problem.

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

### TikTok — confirm the caption before you Post

**On 10 Sep a post published with NO title and NO description.** The fields looked filled; the text
never landed. The tell was the content list showing "No description" — **not** the "Only me /
Content under review" state, which is normal for any new post and clears within a day. TikTok allows
**one caption edit per day, within 7 days of posting**, so there is exactly one chance to fix it.

**Before clicking Post or Schedule, confirm the character counters.** `51/90` on the title and
`424/4000` on the description are computed from TikTok's own state, so they are real evidence the
value is registered. The rendered text alone is not — on the photo-post page the title lives in a
non-editable `div.title` that a naive `input`/`textarea` sweep misses entirely.

Video uploads have a single Description field (no separate title); photo posts have both.

**Scheduled TikTok posts are IMMUTABLE.** The Studio says "Scheduled posts cannot be edited" — the
time cannot be changed without deleting and rebuilding the entire post, which means a fresh upload
of the full file and a fresh copyright check. On a cover that already reads clean, rebuilding to
move the slot an hour is a bad trade. **Get the time right first go** (Dean, 21 Sep 2026, choosing
to leave a post at 20:00 rather than rebuild it to 19:00).

**The TikTok precedent is 19:00, not 20:00.** Sultans of Swing went at 19:00; a later slot was once
inferred from "Instagram peaks 5-10pm and TikTok later still" and landed an hour off. Read the
posts list for the actual shipped time rather than reasoning from the audience-peak note.

**TikTok schedules natively** — a "Schedule" radio beside "Now" in Settings, with separate time and
date pickers. The hour column needs scrolling to reach times below 19:00. **Music copyright check and Content check lite are ON by default** (Dean, 21 Sep 2026 — both
toggles were already enabled and green at page load). An earlier version of this line said to "turn
on" the music check, which sends you hunting for a switch that is already thrown. The action is
reading the **result**, not enabling the feature: for covers, confirm both show "No issues found"
before scheduling. It takes a few seconds and tells you whether the video will be muted, which
matters far more than the delay. Both it and Content check lite returned "No issues
found" for Bring Me to Life.

**The "Video published" toast also appears when you SCHEDULE** (1 Oct 2026). Clicking Schedule
landed on `/tiktokstudio/content` with a "Video published" toast; after a reload the row read
"Oct 2, 7:00 PM" with a clock icon, i.e. scheduled. Trust the row, not the toast.

**Finding a fresh post's id (2 Oct 2026).** The Studio content list has no `/video/` anchors, the
profile page rendered no grid ids, and a direct `/@bottb0/video/<id>` load hits the "Please wait…"
wall. What worked: on `/tiktokstudio/content`, scan `document.documentElement.innerHTML` for
`\b7\d{18}\b` and decode each (`BigInt(id) >> 32n` = unix s); ids minted when you staged the post
are the candidates, in staging order. Then confirm by oEmbed caption. On 2 Oct oEmbed returned 429
for both fresh ids for 30+ min while a months-old control returned 200, so a 429 on a new post is
"not yet", not "wrong id": retry later rather than recording an unconfirmed link. (Corrected 3 Oct:
at 09:17 the control returned 429 too, so the limit is on our IP, not the post. Repeated retries
make it worse; after two failures ask Dean to copy the link from the app, Share → Copy link.
At 19:23 the same day the control was back to 200 while both fresh posts (Fri and Sat) still
returned 429 — 24 h after publishing. So oEmbed cannot confirm a fresh post on any useful
timescale: for new TikTok posts, get the link from Dean's app from the start.)

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

## Setting thumbnails and covers without freezing the session

**The extension's `file_upload` tool works for thumbnails.** Its 10 MB cap is irrelevant here — a
1920x1080 JPEG runs 0.2-0.3 MB. What you must NOT do is click the visible "Upload file" / "Upload
cover" button: that opens a native file dialog the extension cannot see or dismiss, and the session
stops responding until somebody clears it by hand.

Instead, find the hidden `input[type=file]` and upload straight to it:

```js
;[...document.querySelectorAll('input[type=file]')]
  .map((e, i) => `${i} accept="${e.accept}" id="${e.id}"`)
  .join(' || ')
```

then `find` that element and pass its ref to `file_upload`. Confirmed working on **YouTube**
(`id="file-loader"`, `ytcp-thumbnail-uploader`) and **TikTok** (inside the Edit cover dialog).

Two constraints:

- **`file_upload` only accepts paths inside the session's own directories.** Copy the file into the
  scratchpad first; a path on /Volumes is rejected outright.
- **LinkedIn is the exception.** Its video-thumbnail input does not exist in the DOM until the click
  that opens the native dialog, so there is nothing to target. That one genuinely needs Dean — it is
  the image icon in the Editor toolbar, beside **T** and **CC**, reached by going Back from the
  composer.

## Time pickers: three platforms, three different lies

Every one of these silently reverts if you type into it and walk away. **Always re-read the field
after setting it.**

- **TikTok** — the hour column advances exactly one step per scroll gesture no matter what
  `scroll_amount` says, so reaching 19:00 from 00:00 is 19 round trips. Typing is rejected. What
  works: locate the two scrollable columns, set `scrollTop = index * 32` on each, dispatch a
  `scroll` event, **then click the centred value in each column** — scrollTop alone moves the wheel
  without committing the value.
- **YouTube** — "End, backspace x6, type, Tab" is in this runbook and it does not work; the field
  reverts to 00:00 and the Schedule button stays disabled with "Select a time in the future". It is
  a combobox: type the value, then **click the matching option in the dropdown**. The options are
  virtualised and absent from the accessibility tree, so find them with
  `[...document.querySelectorAll('tp-yt-paper-item')].filter(e => e.textContent.trim() === '07:30')`
  and click the coordinates it reports. The date field is separate and does take a calendar click.
- **LinkedIn** — the friendliest: type `08:00 AM` and a suggestion appears below; click it. The
  dialog header restates the full local time, so read that back before hitting Next.

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

### The technique that works (corrected 11 Sep 2026 — read this, not the old advice)

**Type a SHORT query, then pick from the dropdown with a MOUSE CLICK.**

1. Type the caption up to and including a short `@Query` — `@Jumbo`, `@Youngcare`, `@For The Record`.
2. Screenshot, confirm the right entry, and **click it with the mouse**.
3. Press **`cmd+Down` then `End`**.
4. Type the remainder.

Three corrections to what this section used to say, each of which cost real time:

- **The FULL registered name is WRONG.** The old advice was "use the company's full registered name,
  a partial name returns nothing". The opposite is true in this composer: `@Jumbo Interactive Limited`
  and `@Youngcare` returned **no dropdown at all**, while `@Jumbo` and `@Youngcare` typed
  incrementally both returned it immediately. Long queries appear to return nothing rather than a
  narrowed list. Short query, then disambiguate by eye — `@Jumbo` offers Jumbo Supermarkten, Jumbo
  Interactive Limited and Jumbo (Retail Groceries), and only one is ours.
- **Down+Return did not take the chip.** It inserted the name as plain text and left the remainder
  to be appended later in the wrong place. Mouse click on the dropdown row works every time.
- **`cmd+Down End` after every chip is mandatory.** The caret lands _inside_ the chip, not after it,
  so the very next keystroke splits it — "For The Record (FTR)" became "For The Record." with
  "(FTR)" appearing three paragraphs later. `cmd+Down End` moves to the true end of the document
  first.

**Never screenshot or run JS between taking a chip and the next keystroke.** The caret snaps back to
the chip and a `BackSpace` then eats the chip instead of the character you meant. This happened on
11 Sep and destroyed a chip that had taken correctly.

If a dropdown does not appear for a query you believe is right, **do not BackSpace blindly** — press
`cmd+Down End` first, then edit. Deleting a few characters to shorten the query (`@Youngcare` →
`@Young`, then retyping `care`) reliably re-triggers it.

**Verify before clicking Post or Schedule:**
`document.querySelector('.ql-editor').querySelectorAll('[data-entity-urn]').length` — must equal the
number of mentions you intended, and the text must contain no stray `@`. Read the `data-entity-urn`
values too: Jumbo Interactive Limited is `1517297`, Youngcare is `307122`, For The Record (FTR) is
`81140`. A chip with the wrong urn looks identical in the composer.

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
- **Do not use "house band".** Dean, 23 Sep 2026 — it is overused. The house opening
  `"<Band> — <Company>'s house band — play ..."` put it in effectively every band post across five
  platforms. Vary the apposition instead: "<Company>'s band", "the band from <Company>", or name the
  company after the band with a comma. The problem is the formula, so do not just substitute one new
  fixed phrase for the old one — check a new caption against the last few posts before shipping.
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

Replacing a video means two items with **identical titles** sit in the Studio list at once, so
choosing the delete target from that list is a coin flip on destroying the replacement. The sequence
that is safe:

1. **Upload the replacement first**, and wait until the Data API reports `uploadStatus: processed`
   with a real `duration` — not merely `uploaded`, which is true while it is still transcoding.
   Never delete the thing being replaced until the replacement is confirmed complete.
2. Navigate to `studio.youtube.com/video/<id>/edit` so **the id is in the URL**. Do not click a row.
3. Cross-check a second, independent signal on the page — the **Filename** panel names the source
   file, which differs between versions even when titles do not.
4. Re-read `location.href` **immediately before** the irreversible click.
5. Verify afterwards by Data API: the deleted id returns **no item**, and the survivor still reads
   as expected. Query both ids in one call so there is no chance of reading a stale answer for one.

Encode the expected byte count into the injector too — `blob.size === <bytes>` before injecting
catches a stale file by name, which matters when two versions differ by ~15 KB in 1.6 GB.

### A disabled button eats the click and reports nothing

The delete confirmation checkbox did not register when clicked by accessibility ref. The dialog
stayed open with the box unticked, "Delete forever" stayed greyed out, and the click on the disabled
button **returned success and did nothing**. The tool reports the click, not the effect.

Nothing revealed this except the Data API still returning the supposedly-deleted video. Without that
check the report would have been "deleted" when nothing had happened.

**So: for any gated control, confirm the gate is actually open before clicking through** — read the
checkbox state back, or screenshot and look — and always verify the outcome through a different
instrument than the one that performed the action.

### A peer's state report is a fact about when it was written

"Resolve is closed" was true when the cutting session sent it and false by the time it was acted on,
because Dean reopened Resolve in between. Neither session was wrong; the message was simply stale.
**Re-measure anything time-varying yourself** — memory, disk, whether an app or job is running —
however recently and however confidently a peer reported it. Ask peers to send measurements with
the moment they were taken, and treat one as evidence about that moment only.

### LinkedIn photos do NOT need dragging — only video does

Correcting a standing assumption. The CSP problem is specific to the **fetch-inject** route, where
the page itself fetches a Blob URL; `file_upload` sets files on the input directly and is
unaffected. The 10 MB limit is **per call**, so a downscaled photo set sails through where a video
cannot: 13 JPEGs at 2048 long edge came to 6.5 MB and went in one call on 24 Sep.

Find the input with `find` ("file input for uploading images"), then `file_upload` with every path
in one call. Dragging is only needed for video.

### Verify LinkedIn mention chips by `data-entity-urn` before clicking Post

**Never click a typeahead row by coordinate.** The list re-renders between reading it and clicking,
so the click lands on a different row. On 24 Sep that produced three wrong mentions in one caption —
"Big Rex Software" for Rex Software, "URBAN-X" (a US venture capital firm) for URBAN X, and **Jumbo
Interactive Limited left as plain text**, which would have broken the mandatory sponsor mention. The
rest of the caption was silently swallowed too. A screenshot shows none of this: the text reads
correctly either way.

The procedure that works:

1. Type `@<full registered name>`.
2. Press `ArrowDown`.
3. Read back `aria-selected="true"` and **confirm it names the company you meant**.
4. `Return`.

Then, before Post, read the editor and check every chip:

```js
const ed = document.querySelector(
  '.ql-editor, [contenteditable="true"][role="textbox"]'
)
Array.from(ed.querySelectorAll('[data-entity-urn]')).map((e) => ({
  t: e.innerText,
  u: e.getAttribute('data-entity-urn'),
}))
```

Known-good URNs: Rex Software `1985577`, URBAN X `2758387`, Jumbo Interactive Limited `1517297`.
Also confirm the hashtags are present — a swallowed tail is the other half of this failure.

`cmd+a` then `Delete` clears the composer **only with focus inside the editor**; click into it
first and read `innerText` back to confirm. Images survive the clear.

### A caption can be fixed after publishing; the images cannot

`POST /{page-post-id}` with `message=` rewrites a live Facebook post's text and returns
`{"success":true}`. Read it back with `?fields=message,updated_time` to confirm. **There is no
equivalent for the attached photos** — changing those means deleting and reposting, which loses the
URL and any engagement.

Instagram has no caption-edit endpoint at all, so an IG caption must be right at `media_publish`.

Consequence for ordering: when a fact is still outstanding (a credit, a link), **ship the platform
whose text you can edit first, and hold the one you cannot.** On 24 Sep the CAM A operator's name
landed one minute after the Facebook post went out; the FB caption was edited in place and Instagram
then published correct the first time.

### Do not put a full stop immediately after an @handle

Instagram usernames may legally contain periods (`@urbanx.io`), so `@kurtboldy.` is ambiguous in a
way `@kurtboldy,` is not. Rephrase so the handle is not sentence-final, or end the line without
punctuation. The same care applies to a handle followed by `'s`.

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

**Symptom:** you can see every post; nobody else can. An outsider following a link gets
_"This content isn't available at the moment — when this happens, it's usually because the owner
only shared it with a small group of people or changed who can see it, or it's been deleted."_
Views sit near zero. Everything looks perfect from the admin account, and the Graph API reports the
post `published: true`, privacy `EVERYONE`, `embeddable: true`, `video_status: ready`.

**Cause:** a Meta app in Development mode ("Unpublished") only shows the content it creates to
people who hold a role on that app. Hand-posted content is unaffected, which is what makes it so
confusing — the page looks half-working.

Found 14 Sep 2026 after For The Record reported it. The split was total and had run for two weeks:

| Posted                     | How       | Public?     |
| -------------------------- | --------- | ----------- |
| 22 Jun – 20 Aug (21 reels) | by hand   | all fine    |
| 30 Aug – 14 Sep (9 reels)  | Graph API | all blocked |

The schedule log starts 30 Aug, exactly when the API pipeline began. Every Brisbane 2026 reel — the
whole band-by-band rollout and the Jumbo Band launch — was invisible to everyone but us.

**Fix:** App Dashboard → App settings → Basic → set a Privacy policy URL
(`https://www.battleofthetechbands.com/privacy`) → **Save Changes at the very bottom of the page**,
below the Data Protection Officer block. The field silently reverts if you don't scroll down to it.
Then Publish → Publish. **Visibility is restored retroactively** — all 30 reels went public the
moment the app flipped, with no re-posting. The page token and its 7 scopes keep working.

**How to check this in 10 seconds, any time:**

```sh
curl -s -A "Mozilla/5.0" "https://www.facebook.com/battleofthetechbands/videos/<video_id>" \
  | grep -c "isn't available"     # 0 = public, 1 = blocked
```

Use the `/{page}/videos/{id}` form — it is the only Facebook URL shape that serves an
unauthenticated client. `/reel/{id}` and `/{page}/posts/{id}` return a 1,542-byte error page for
_everything_, including the page's own root and made-up ids, so they cannot tell a live link from a
dead one. Two things that also look decisive and are not: the embed plugin
(`/plugins/video.php`) cleared posts that were actually blocked, and the Sharing Debugger refuses
outright with "Facebook URLs cannot be crawled".

**The tell that cracked it:** a working post shows a _login prompt_ to a logged-out viewer; a
blocked one shows the _error_. Treating those two as the same failure hid the problem for a week.

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

Offer a **spread, not single frames**. Nine frames at half-second steps across ±2 s of a candidate
moment, as a contact sheet, reading chronologically — name the files so a glob sorts in time order,
or the sheet reads in alphabetical nonsense.

This is not fussiness. On 13 Sep the frame picked as "the strongest portrait by a distance" turned
out to be the **worst** in its own group: a haze blast washed it out, and half a second later it
cleared completely. Two frames after that, the sponsor's logo became readable on the singer's robe.
A single frame hides all of that.

Pull the frames from the **delivered render** with `ffmpeg -ss <t> -i <render> -frames:v 1 -q:v 2`,
not from the camera masters — the render carries the grade. Watch for a ±2 s window that spans a
camera cut or crops a subject at the frame edge; both happened and both are invisible until you see
the spread.

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
