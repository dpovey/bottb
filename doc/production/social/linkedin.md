# LinkedIn

Split out of social-reel-posting-runbook.md on 2026-10-30; shared rules (copy, handles, scheduling, ledger) stay there.

## The pipeline per reel: item 6 (LinkedIn composer)

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
     - **Clicking outside the composer** also opens "Save this post as a draft?" (30 Oct 2026: a "click
       line 1" aimed from a 0.6-scale screenshot landed left of the dialog; the typed body went nowhere).
       Take line 1's coordinates from a full-scale screenshot, and check `.ql-editor` text after typing.
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

## LinkedIn composer — the caret trap (learned the hard way, 7 Sep 2026)

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

## LinkedIn photos do NOT need dragging — only video does

Correcting a standing assumption. The CSP problem is specific to the **fetch-inject** route, where
the page itself fetches a Blob URL; `file_upload` sets files on the input directly and is
unaffected. The 10 MB limit is **per call**, so a downscaled photo set sails through where a video
cannot: 13 JPEGs at 2048 long edge came to 6.5 MB and went in one call on 24 Sep.

Find the input with `find` ("file input for uploading images"), then `file_upload` with every path
in one call. Dragging is only needed for video.

## Verify LinkedIn mention chips by `data-entity-urn` before clicking Post

**12 Oct 2026:** look the company up in the handles registry first: `pnpm bottb handles --platform
linkedin` (table `social_handles`, `external_id` = the company urn). Sydney 2026 parties were missing
until 12 Oct (Dean: "Don't you have those recorded in the db somewhere?"); every new company or
photographer gets `bottb party add` + `handles set` the first time it is tagged. Two "V2 AI" pages
exist: the right one is 81854932 (/company/v2ai, IT Services and IT Consulting). **Never press Escape in the
LinkedIn composer** to close a hashtag dropdown: it opens "Save this post as a draft?" (Discard / Save as
draft). Close that dialog with its X and the composer, chips and images survive.

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
