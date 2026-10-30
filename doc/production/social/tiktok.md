# TikTok

Split out of social-reel-posting-runbook.md on 2026-10-30; shared rules (copy, handles, scheduling, ledger) stay there.

## The pipeline per reel: item 7 (TikTok Studio)

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
     check ~~is~~ was TikTok's oEmbed — CORRECTED 30 Oct 2026: oEmbed now returns no `title` (caption) at all,
     even for a known published post (control 7698221262266453254), so it can no longer match captions.
     Use the id instead: `id >> 32` is the post's Unix time (V2 Starships/UFO 7702340811786259732 decoded to
     06:16:08Z, the minute it was posted), plus "not already in `posts`". Old method, for reference: `curl
"https://www.tiktok.com/oembed?url=https://www.tiktok.com/@bottb0/video/<id>"` returns the
     caption for published videos (400 while still scheduled) — match the caption before sharing a
     link. Scheduled posts have pre-assigned ids that appear in page HTML before publish, which is
     why an unverified link can point at a not-yet-public post. Web sessions also log out
     spontaneously after a few days; scheduled posts still publish server-side.

## TikTok — confirm the caption before you Post

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

## TikTok photo posts

**12 Oct 2026 (four photo posts scheduled):** tiktok.com/explore → Upload now opens a small menu
(Videos / Photos); click Photos. Title and description typed straight after the upload finishes can
silently not land (both counters 0): wait ~8 s, click the fields by coordinate, and re-read the counters
before scheduling. The time wheel moves one step per click and ignores a second click within ~1 s: click,
wait 2 s, zoom, repeat. The picker is in the Mac's zone (Brisbane on 12 Oct), so 19:00 Sydney = 18:00.

TikTok Studio has a **Photos** tab beside Videos (`/tiktokstudio/upload?tab=photo`). Same
`file_upload` route; the first image becomes the Cover. Title is capped at 90 chars, description 4000. Typing `#tag` opens a suggestion dropdown — **never press Enter**, click a neutral area to
dismiss it, or you will insert the wrong tag. Set Location to The Triffid. Posting redirects to
`/tiktokstudio/content`; get the permalink from that list, then **confirm it with oEmbed**
(`https://www.tiktok.com/oembed?url=...`) before sending it to anyone — list order has mismatched
before. A just-posted item returns an empty oEmbed title until it finishes processing.
