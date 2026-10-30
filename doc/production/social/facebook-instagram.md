# Facebook and Instagram

Split out of social-reel-posting-runbook.md on 2026-10-30; shared rules (copy, handles, scheduling, ledger) stay there.

## The pipeline per reel: items 2-4 (Blob, Facebook Reel, Instagram Reel)

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
   can do nothing — invite via instagram.com in Chrome or the IG app (Edit → Add collaborators; see
   "Add collaborators after publish" under Photo posts). API and web cap at 3; the app took a 4th on 13 Oct 2026.
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

## A caption can be fixed after publishing; the images cannot

`POST /{page-post-id}` with `message=` rewrites a live Facebook post's text and returns
`{"success":true}`. Read it back with `?fields=message,updated_time` to confirm. **There is no
equivalent for the attached photos** — changing those means deleting and reposting, which loses the
URL and any engagement.

Instagram has no caption-edit endpoint at all, so an IG caption must be right at `media_publish`.

Consequence for ordering: when a fact is still outstanding (a credit, a link), **ship the platform
whose text you can edit first, and hold the one you cannot.** On 24 Sep the CAM A operator's name
landed one minute after the Facebook post went out; the FB caption was edited in place and Instagram
then published correct the first time.

## Do not put a full stop immediately after an @handle

Instagram usernames may legally contain periods (`@urbanx.io`), so `@kurtboldy.` is ambiguous in a
way `@kurtboldy,` is not. Rephrase so the handle is not sentence-final, or end the line without
punctuation. The same care applies to a handle followed by `'s`.

## Blob uploads (the public URL every API post needs)

`doc/production/scripts/blob-upload.mjs <file> [blob-path]` — prints `BLOB_URL`.

**Run it with the repo root as cwd.** It resolves `@vercel/blob` and `.env.local` from there; a copy
run out of the scratchpad dies with `ERR_MODULE_NOT_FOUND` in under a second. On 7 Sep that failure
was invisible because the job was detached — the log said the upload never happened while the plan
assumed it had. Always read the log for `BLOB_URL` before moving on.

Verified 7 Sep 2026: uploads return `HTTP 200` with `access-control-allow-origin: *`, which is what
makes the YouTube Studio cross-origin fetch-inject work. Use `multipart: true` for the big masters.
Delete throwaway blobs with `del(url, {token})` — they are public until you do.

**10 Oct 2026, measured:** `blob-upload.mjs` on a 236.6 MB file (multipart) took 58 s, peak footprint 0.38 GB
(`/usr/bin/time -l`). Bounded memory on >1 GB is still unproven. When FB/IG use the 1080p IG file and only YouTube
needs the 4K, Dean drags the 4K into Studio and only the IG file goes to Blob (his 3 Oct rule, applied to
Jumbo "Say It Ain't So").

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
