# YouTube

Split out of social-reel-posting-runbook.md on 2026-10-30; shared rules (copy, handles, scheduling, ledger) stay there.

## The pipeline per reel: item 5 (YouTube via Studio)

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
       ~~Check the field names in Studio the first time~~ Checked by name 2026-10-22 (Mustang Sally preview, `hjiTbqrFazc`):
       Details → **Show more** (`#toggle-button`) → **AI use** radios "Yes, AI was used" / "No, AI wasn't used"; **Tags** (type
       them comma-separated, each comma makes a chip); **Video language** and **Category** came pre-set (English, Music: channel
       defaults, read them anyway); **Recording date** opens a calendar (click the day); **Video location** is a typeahead: type
       "Manning Bar", pick "Manning Bar Hideout at Manning, Manning Road, Camperdown NSW" (decoys: Mannings BBQ, Manning's Sports
       Bar). **Allow embedding** is a checkbox under Licence (was already on). Audience: `tp-yt-paper-radio-button[name=
VIDEO_MADE_FOR_KIDS_NOT_MFK]`. Read-back that worked: every `[role=radio][aria-checked=true]` innerText, the location
       input's value, the tags' `ytcp-chip` texts. **Save while still uploading is fine:** Studio says "will be unlisted once
       uploading and processing have finished. Keep this browser tab open". For videos already up, the same fields are on each
       video's edit page; backfill them.
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

## YouTube thumbnails (offline generator)

Full-song videos get a custom thumbnail in the same house layout as the in-app generator
(`/admin/thumbnails`): frame + top/bottom scrims, company logo one top corner, BoTTB square the
other (default `top-right`), artist bold + song under it bottom-left in Jost.

Rather than driving the browser tool, run the layout offline:

- `doc/production/scripts/thumbnail/compose.mjs` — a direct port of
  `src/app/admin/thumbnails/compose.ts` (`composeYouTube`) plus the `src/lib/canvas.ts` helpers
  (`drawCover`, `drawLogoRow`, `trimTransparent`, `wrapLines`) and `video-safe-area.ts` constants.
  If the in-app layout changes, re-port it.
- **10 Oct 2026:** YouTube and LinkedIn thumbnails carry the song text (Dean: "we didn't put text on the
  thumbnails for youtube and linkedin"). When Dean supplies a finished frame (BoTTB square already
  top-right), feed it straight to `render.mjs` as the still: at 1920x1080 the crop is identity and the
  square lands on the same pixels. Run it **from the repo root** (`@napi-rs/canvas` is in the repo's
  `node_modules` now; no scratch install). The company SVG from `companies.logo_url` loads directly via
  `loadImage`; rasterise to a wide PNG first so `trimTransparent` works. Keep Dean's plain frames as
  `<slug>-<platform>-notext.jpg`. LinkedIn: swap the thumbnail **before** Post (Edit media preview →
  Video thumbnail → Remove → upload → Update); YouTube: video edit page, `#file-loader`, Save, then check
  `i.ytimg.com/vi/<id>/maxresdefault.jpg`.
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

## Studio's red Description box is not a save failure (6 Nov 2026)

On a video's edit page the Description can show a red outline and counter (`#description-textarea.invalid === true`) with no message
and Save disabled. Mustang Sally `nNGYLWXWjl4` showed it with the full text saved, and so did the already-public good 4 u
`yUPYr-OgmzI`, so it isn't specific to one upload. Cause not established; it isn't blocking schedule or publish. A Data API read of a
scheduled video returns no item, because it's private until its slot: read the time from Studio instead. The content list shows the
date only; the upload dialog gives the time.

## Deleting a video when another carries the same title (27 Sep 2026)

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

## Shorts: full-song links go in Related video (7 Nov 2026)

URLs in Shorts descriptions and comments are not clickable (YouTube Help, answer 13748639), so a "Full song: <url>" line there does nothing. The clickable route is Studio, Content, the Short, **Related video** (answer 14075157); it shows under the channel name, needs advanced feature access, and the target must be public or unlisted. Not yet tried on our channel, and whether it can be set before the Short is public is unknown: check on the first Short.

Channel identity (7 Nov 2026): Dean's Google account manages the BotTB channel, so Studio may open as his personal channel (`UC9C0DzFMnKFTCxdxvKmUGxg`). Check the URL shows `UCJVbMoGFRdQxVgHvW1heYCg` and the header says "You're a manager" before any upload; switch from the avatar menu, Switch account. Related video shows on Shorts in the details side panel; advanced features read "Eligible", and setting the field is still untried.

Fetch-inject works in the T3 browser too (7 Nov 2026): a 316 MB 2160x3840 Short went up from Blob with no drag. Studio blocks **Related video** for managers: "Only channel owner can gain access. If you share a channel, ask the primary channel owner to complete the verification process". Until the owner verifies, don't write "tap the link under our channel name" in a Short's description without checking the link exists.

Dean dropped Related video for the 2026 reels (7 Nov 2026): Shorts carry "Full song on our channel". If it comes back, only the channel's primary owner can verify (help answer 9891124).

Scheduling trap (7 Nov 2026): Studio can show the typed time in the box yet keep 00:00 if Schedule is clicked straight after picking the option; No One Knows was saved at 00:00 while the box read 17:00. Pick the time with a real click, wait, and after scheduling reload the edit page and read the time back (Visibility panel). Also, `preview_navigate` can leave Studio on its current page: open a new tab for each read-back.

Daily upload limit (7 Nov 2026): Studio stopped at the 11th attempt in a day, after 10 uploads, including one abandoned draft: "Daily upload limit reached. Upload more videos daily after a one-time verification or wait 24 hours." The file injects and the dialog opens but the link stays on "Creating link…"; check for that line before filling a dialog in. The "Show more" toggle stays closed in that state, so #recorded-date is missing. Plan batches of about 10 a day until the primary owner verifies.

The limit is still on at 12:20 the next day (8 Nov 2026), so it seems to be a rolling 24 hours from the last uploads (7 Nov, until about 19:40), not a reset at midnight. Closing the dialog in that state leaves no draft behind.

## Custom thumbnail in the T3 browser, and reading ids (8 Nov 2026, Paint It Black)

In the upload dialog, during upload, neither `preview_act upload` on the hidden `image/jpeg,image/png` input nor a Blob fetch-inject
into it set the thumbnail, and "Upload file" opened nothing. After processing, the same fetch-inject on the edit page
(`studio.youtube.com/video/<id>/edit`) took at once: data: previews appeared, Save enabled, "Changes saved", and
`i.ytimg.com/vi/<id>/maxresdefault.jpg` showed it. So set the thumbnail on the edit page, not in the dialog.
Take the video id from the Data API or a `ytimg` URL, never from a screenshot: the dialog's link read `6OpNQg7kLjl`; the id is `6OpNQg7kLjI`.
Recording date: typing `27 Aug 2026` into the calendar's own text box plus Enter worked and read back. Tags typed with
`preview_act type` stayed as text until an Enter turned them into chips.

Limit cleared by 20:30 on 8 Nov (last uploads 7 Nov about 19:40), so a rolling 24 hours holds. In the upload dialog the recording-date and schedule-date calendars each open their own text box (a fresh `#input-N`); type `27 Aug 2026` there and press Enter. The time list's 17:00/18:00 items sit below the fold of the fixed `tp-yt-paper-dialog`: scroll that dialog to the item, then real-click it.

## Full-song upload without Blob in the T3 browser (20 Nov 2026, You Oughta Know)

An unreleased cut can't go on public Blob, so the 1.53 GB 4K master went in as pieces: `split -b 45m`, a helper
`<input type=file id=bottb-part>` pushing each `files[0]` to `window.__parts`, `preview_act upload` per piece (each took a few
seconds), then `new File(parts, name, {type:'video/mp4'})`, SHA-256 checked in the page (`crypto.subtle.digest` on the rebuilt
File matched the render), then `DataTransfer` onto `input[name=Filedata]` + `change`. Private preview `vJjjFS8RFY4`.

- **Attach the pieces before Studio's upload dialog is open.** With the dialog open (modal), `upload` on the helper input timed
  out even for a 1 KB file, and one attempt dropped the T3 connection and the tab. On a fresh load of `/videos/upload?d=ud`,
  before the dialog rendered, the same call took at once.
- The "still uploading" dialog after Save is not `tp-yt-paper-dialog[opened]`; poll `ytcp-video-upload-progress` text for
  "Upload complete". Navigating the tab away mid-upload fails with ERR_ABORTED, which protects the upload.
- On the edit page the Visibility card reads "Pending" while processing even when Private was saved.

## Direct upload in the T3 browser (25 Nov 2026, Barracuda)

`preview_act upload` took the 1.48 GB 4K in one call into a helper `<input type=file>` added to the Studio upload page before the dialog
opened. Then Create → Upload videos, and the file went from the helper onto `input[name=Filedata]` with `DataTransfer` + `change`. Size
and the SHA-256 of the first and last 8 MB matched the render. No pieces and no Blob. The video id came from the dialog's `youtu.be` href.
Thumbnail: on the edit page, `preview_act upload` straight into `#file-loader` (`image/jpeg,image/png`), Save went disabled, and
`maxresdefault.jpg` showed it 1 min later. Recording date: opening the dropdown fills in today; type the show date (`27 Aug 2026`) into the
date picker's own text box (tag it by its value property first: an attribute selector timed out), press Enter, read it back. Location
typeahead "The Triffid" → "The Triffid Stratton Street, Newstead QLD"; Data API `recordingDetails` confirmed it.
