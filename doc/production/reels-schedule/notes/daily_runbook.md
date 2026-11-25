# Daily reel jobs

Each scheduled run follows this file. State lives in `../data/jobs.json`; copy, files, covers and slots in `../data/social_batch_2026-11-07.json`. Run commands from `/Users/dean/src/personal/bottb`. Dean approved all of this copy and every slot (7 Nov 2026): don't change a word, don't add posts, and don't pester him for routine work.

## Each run

1. `date`, then read `jobs.json`. Do every job whose `not_before` (Brisbane time, the Mac's zone) has passed and whose `done` is false. A run that has nothing due says so in one line and stops.
2. Set `done` true (and any id or note) straight after each job, so a crashed run doesn't repeat it. Never post twice: if unsure whether a job happened, read the platform first.
3. Finish with a short plain report: done, failed and why, and any link Dean needs. Add anything new you learned to the platform's runbook in `social/`, and findings to `notes/findings.md`.
4. When every job is done, say so; Dean can delete the two tasks named in `jobs.json`.

Stop and report to Dean, without retrying blindly, on: a signed-out platform, a copyright or content check flag, a text or time that won't read back exactly, or a platform refusing. Not done is fine; wrong is not. Two honest tries per job.

## Browser

T3 preview tools are deferred: load with ToolSearch `select:mcp__t3-code__preview_open,mcp__t3-code__preview_act,mcp__t3-code__preview_evaluate,mcp__t3-code__preview_snapshot,mcp__t3-code__preview_wait_for,mcp__t3-code__preview_status,mcp__t3-code__t3_preview_close`. Always open a new tab: `profileId` `profile-989c012c-c035-46a5-b98c-a88369ed8880`, `reuseExistingTab` false, `open` false; pass your `tabId` on every call. Prefer `preview_evaluate`; snapshots are large. Close your tabs at the end. Silence before attaching anything: `const p=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){this.muted=true;return p.apply(this,arguments)}`.

Attaching a file over 50 MB: `split -b 45m`, hidden `<input type=file id=bottb-part>` whose change handler pushes `files[0]` to `window.__parts`, `preview_act upload` with selector `#bottb-part` one piece at a time, sequentially, `timeoutMs` 60000, then `new File(window.__parts, basename, {type:'video/mp4'})` in a `DataTransfer`, set the site's input `.files`, dispatch `change` bubbling. Pieces go in the session scratchpad and are deleted afterwards.

## Job: tiktok (book one reel)

Only within 10 days of the slot. Runbook: `social/tiktok.md`. In the picker the time is 08:00 (GMT+10) = 09:00 Sydney.

1. Open https://www.tiktok.com/explore and really click the sidebar Upload (never go to /upload directly: bot wall). If "wasn't saved" shows, Discard and confirm.
2. Attach the `file` to the input whose id isn't `bottb-part`, compare SHA-256 with `shasum -a 256`, wait 8 s, dismiss "Got it".
3. Real click in `[contenteditable=true]`, press Meta+a, press Delete, check 0/4000, then `preview_act type` with NO locator with the exact `tt`. Never execCommand or a locator: they corrupt the editor. `innerText.trim()` must equal `tt`; if not, close the tab and start over. Click the neutral "Details" heading. Never press Enter or Escape.
4. Location: click `text="<tiktok_location>" >> nth=-1`. Cover: click `text="Edit cover"`, upload `cover` to the image input, Save.
5. Click `text="Schedule" >> nth=0`. `.Picker__trigger` [0] date, [1] time. Real click on the `DatePicker__day`; on time, `.TimePicker__item` in two columns, only the 7 in `.TimePicker__panel` are clickable: click the top visible with 2 s between clicks until 08 shows, click it, same for minutes 00.
6. Wait for both checks "No issues found" (Content check lite takes up to 10 min). Any flag: don't schedule, report the wording.
7. Close the dropdown, check radio `schedule`, date, 08:00, GMT+10 on a screenshot, caption, location. The button must read Schedule, never Post. Click it, wait for `/tiktokstudio/content`, reload, read the row. Id: `item_id=(\d+)` in the 8000 characters after the caption in the page HTML.
8. `python3 doc/production/reels-schedule/scripts/record_social.py <key> tiktok <id>`.

## Job: youtube (upload one 4K Short)

Runbook: `social/youtube.md`. Data: `data/yt_batch_2026-11-07.json` (`title`, `desc`, `url`, `size`, `name`, `tags`), slot in `jobs.json`. Studio: channel `UCJVbMoGFRdQxVgHvW1heYCg`, header "You're a manager". Create > Upload videos, then in the page `fetch(url)`, `blob()`, `new File`, `DataTransfer` on `input[name=Filedata]`, change. "Daily upload limit reached": close the dialog, leave `done` false, report nothing more than that; the next run retries.

Fill with execCommand insertText; `VIDEO_MADE_FOR_KIDS_NOT_MFK`, `VIDEO_HAS_ALTERED_CONTENT_NO`; Show more (`#toggle-button`): `input[aria-label="Tags"]`, `#recorded-date` 27 Aug 2026, `input[aria-label="Video location"]` then click the `Stratton Street, Newstead` result. Don't add a Related video. Schedule: date, then pick the time (Brisbane = slot minus an hour) with a real click on the `tp-yt-paper-item`, wait, verify, then `#done-button`; read "Your video will be set to public on". Read the row back in a new tab: one Short saved at 00:00 on 7 Nov from clicking too fast.

Record: `python3 doc/production/reels-schedule/scripts/record_yt.py <key> <ytid> <iso slot>`.

## Job: linkedin_comment

As the page, on the post that went live at 13:00 Sydney. Open https://www.linkedin.com/company/104393733/admin/page-posts/published/ and find the post by its first words. Comment box: the identity must be Battle of the Tech Bands, not Dean. Type exactly `li_comment` with no locator after a real click; click Comment; reload and confirm it's there as the page. Then record the post's permalink: `pnpm -s bottb post update --id <ledger row> --permalink <url> --status published`.

## Job: ig_collaborators

After the reel is live on Instagram. In the page's admin session at instagram.com: open the reel from https://www.instagram.com/battleofthetechbands/, ⋯, Edit, Add collaborators. Add the job's `collaborators` (web cap 3), choosing the exact handle, beware lookalikes such as `eddyhill_.gigphotography`. Save without changing the caption. Read the reel's permalink and record it: `pnpm -s bottb post update --platform instagram ...` (see `pnpm bottb` usage). Facebook goes live at the same time; check its status with `node doc/production/reels-schedule/scripts/fb_scheduled.mjs` and mark that row published too.

## Job: linkedin_book

See the steps in `social/linkedin.md` (last paragraphs) with the batch file's `li_chunks`: type chunks with no locator, caret reset before each, `@Name` in one go, ArrowDown then Enter, verify URN.

## Job: whatsapp

After a reel's Facebook and Instagram slot, with all its platforms live: `pnpm -s bottb post whatsapp --group <group>`. Paste the result in your report as plain lines, no code fence or quote bars. One line of copy, then one link per platform. Don't send it anywhere: Dean does that.
