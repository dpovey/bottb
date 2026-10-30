# Browser automation (Chrome extension)

Split out of social-reel-posting-runbook.md on 2026-10-30; shared rules (copy, handles, scheduling, ledger) stay there.

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
  **12 Oct 2026:** the dialog works in the _browser's_ zone and names it ("Australian Eastern Standard
  Time" while the Mac was on Brisbane time), so an 08:00 Sydney slot in October is typed as 7:00 AM.
  Typing the date opens a calendar that hides the time field: click the day in the calendar. The dialog
  shrinks after the time is picked, so re-find Next (a click on the old spot lands outside and raises
  the save-draft prompt; close that with its X). Check the result from an empty composer: clock icon →
  "View all scheduled posts" (there is no Scheduled tab under Page posts).

## A disabled button eats the click and reports nothing

The delete confirmation checkbox did not register when clicked by accessibility ref. The dialog
stayed open with the box unticked, "Delete forever" stayed greyed out, and the click on the disabled
button **returned success and did nothing**. The tool reports the click, not the effect.

Nothing revealed this except the Data API still returning the supposedly-deleted video. Without that
check the report would have been "deleted" when nothing had happened.

**So: for any gated control, confirm the gate is actually open before clicking through** — read the
checkbox state back, or screenshot and look — and always verify the outcome through a different
instrument than the one that performed the action.
