# The `bottb` CLI and the post ledger

Brisbane 2026 was posted out of a session's head and a hand-written JSONL log. That log ends with a
correction: a posting time recorded as 10:20 was actually 12:19, because it was written from a sense
of elapsed time instead of read back from Facebook's `created_time`. Three TikTok permalinks in the
same file were another post's. Two LinkedIn permalinks were never written down at all and are gone.

This CLI and the schema behind it exist so Sydney 2026 does not repeat that.

```bash
pnpm bottb --help
pnpm bottb doctor
```

## What the schema holds

**`social_parties` + `social_handles`** — who we tag, and how, per platform.

Social accounts are **shared nationally**: one Facebook page, one Instagram, one TikTok, one YouTube
channel across every city. Handles are therefore not a per-event or per-city concern, and they are
not a `companies` concern either, because sponsors, charities, venues, photographers and
videographers all need the same information and only some of them are companies.

`social_handles.status` is the point of the design:

| value      | meaning                                              |
| ---------- | ---------------------------------------------------- |
| `active`   | they have an account and this is it                  |
| `none`     | somebody looked; they genuinely have no account here |
| `unknown`  | somebody looked and could not tell                   |
| _(no row)_ | nobody has ever checked                              |

The last two are different, and keeping them apart is most of the value. `URBAN X` on LinkedIn is
`unknown`, not `none`: the "it does not resolve" test was run in a composer whose caret was silently
jumping, so the query may never have been contiguous. That is not evidence of absence.

`mention_name` holds the **full registered name** a platform's typeahead needs, which is often not
the handle and not the trading name. `Jumbo Interactive Limited` resolves on LinkedIn;
`Jumbo Interactive` silently returns nothing. `Rex Software` resolves; `Rex` returns people.

`collab_policy` records whether a party accepts Instagram-style collaborator invites. The Triffid is
`never` — they do not accept, and a post sits pending waiting for them.

**`event_parties`** records who is credited on a given event's posts. A party's `kind` is what it
intrinsically is (Jumbo Interactive is a `company`); its `role` is what it did at that event
(`national-sponsor` at Brisbane 2026, and also `band-company`).

**Views.** `party_handles` and `company_handles` flatten all of that into one row per party (or per
company) with a column per platform — `linkedin_handle`, `instagram_mention_name`,
`instagram_collab_policy` and so on — so a simple lookup stays a simple lookup.

```sql
SELECT company_name, linkedin_mention_name, instagram_handle, instagram_collab_policy
FROM company_handles;
```

**`posts`** — one row per publication per platform. Distinct from the older
`social_posts`/`social_post_results` pair, which is the admin UI's _queue_ of submitted jobs. Most
Brisbane posts never went through that queue: they were scheduled natively on Facebook, dragged into
LinkedIn, or uploaded by hand. `posts` records what is live, however it got there.

- `group_key` ties a cross-platform burst together. One reel across five platforms is one group.
- `posted_at_estimated` says whether `posted_at` was **read back from the platform** or inferred
  from a schedule. Those are different kinds of fact and the ledger will not pretend otherwise.
- `posted_at` may be null on a published post. "It is live and nobody wrote down when" is a real
  state; forcing a value there only makes somebody invent one.
- `utm_campaign` / `utm_source` / `utm_medium` / `utm_content` tag the caption link so social reach
  joins to website analytics. `utm_campaign` is the event slug, so it joins to `events.id`.
  `utm_medium` distinguishes the **link placement** — Instagram captions are not clickable, so IG
  traffic arrives as `social_bio` or `social_story`, not plain `social`. `utm_content` is the
  per-post slug, and it is the one that matters: referrer alone only tells you the platform, which
  is useless in an event week when three posts a day come from Instagram.

`posts.id` is a stable uuid so a sibling `post_metrics(post_id, captured_at, ...)` can hang off it
later. Nothing here collects metrics.

## Commands

```bash
pnpm bottb doctor                       # env, transport, which tables exist
pnpm bottb event next
pnpm bottb event show brisbane-2026

pnpm bottb handles                      # every party, a column per platform
pnpm bottb handles --event brisbane-2026 --platform linkedin
pnpm bottb handles set --party urbanx --platform linkedin \
    --status active --handle urbanx --mention-name 'URBAN X'
pnpm bottb handles verify --party urbanx --platform linkedin --by dean --status active

pnpm bottb party list --kind sponsor
pnpm bottb party add --slug acme --kind sponsor --name 'Acme Pty Ltd'
pnpm bottb event party add --event sydney-2026 --party acme --role sponsor

pnpm bottb post record --platform facebook --group sydney-2026-reel-1 \
    --external-id 123 --permalink https://... --status published \
    --posted-at 2026-10-09T18:00:00+11:00
pnpm bottb post list --event brisbane-2026 --platform tiktok
pnpm bottb post link --platform facebook --external-id 123
pnpm bottb post whatsapp --group brisbane-2026-reel-shiprex
```

`--json` wraps any answer in `{ok, command, data, meta}` for a skill to consume. **stdout is the
answer and nothing else**; every note, warning and transport line goes to stderr, so `--json` is
safe to pipe.

`post whatsapp` emits plain text with one link per line — no markdown, no blockquotes, no code
fences. WhatsApp renders none of that; it lands as literal characters. It also states a missing link
rather than dropping the platform silently.

### Recording a posting time

`post record` warns if you give `--posted-at` without `--posted-at-estimated`, because the default is
"this is measured". Only pass a measured time you actually read back:

| platform  | where the real time comes from            |
| --------- | ----------------------------------------- |
| Facebook  | `created_time` on the Graph API response  |
| Instagram | `timestamp` on the media                  |
| LinkedIn  | snowflake id `>> 22` is unix milliseconds |
| TikTok    | id `>> 32` is the unix creation second    |

Anything else — the schedule you set, the time you noticed, the log line's own clock — is an
estimate. Pass `--posted-at-estimated`.

## Transport

The runbook's note that "port 5432 is blocked" is misleading and has cost time. `@vercel/postgres`
does not use 5432 at all: it opens a **WebSocket to the Neon proxy on 443**, which works fine from
here. Only raw `pg`, `psql` and `node-pg-migrate` need 5432, which is why migrations are the thing
that fails, not the app.

So `src/lib/sql.ts` is the primary transport. Raw `pg` is kept as a fallback, and the CLI prints
which one it used on every run. It never degrades silently — a fallback is announced as a fallback.

## The Brisbane backfill

```bash
pnpm bottb backfill brisbane-2026-log              # dry run
pnpm bottb backfill brisbane-2026-log --apply --yes
```

`src/cli/backfill/brisbane-log.ts` is a **pure interpreter** over the whole JSONL file: no database,
no clock, no environment. It replays every line in order and reports what it could not recover
instead of guessing. Both flags are required to write; a dry run is the default.

It recovers 56 posts across 13 groups and reports, in the dry run:

- **the three wrong TikTok ids** superseded by the line-27 oEmbed verification, each one named;
- **two LinkedIn reel permalinks that do not exist** (night highlights, Total Loss) — recorded as
  published with an estimated time and a note, and listed as unrecoverable;
- **five ShipReX full-video posts with no recorded publish time at all** — `posted_at` left null;
- **Instagram publish times are estimates**, taken from the cron's scheduled minute rather than the
  media's own timestamp;
- the Epsonics photo post's corrected times (Facebook 12:19:34 measured, LinkedIn 12:22:26 measured,
  Instagram and TikTok still estimates around 12:20);
- the four natively-scheduled Facebook photo posts, and a warning that **their Instagram, LinkedIn
  and TikTok halves were never logged** and so are absent.

The dry run also resolves band ids against the database and names any that do not exist. That check
already earned itself: the ShipReX band id is `the-shiprex-brisbane-2026`, not the
`shiprex-brisbane-2026` the display name suggests, because band ids are frozen at creation and the
band was renamed afterwards.

Anything the interpreter does not recognise is listed under **NOT UNDERSTOOD**, never dropped. Prose
corrections need an explicit rule, because there is no generic way to read a correction written in
English and guessing would reintroduce the error being corrected.

The tests in `src/cli/__tests__/brisbane-log.test.ts` run against the real log file as a fixture.

## Migrations

```
migrations/1788868641754_add-social-parties-and-handles.js
migrations/1788868642135_add-posts-table.js
```

Both are written and neither has been applied. `src/lib/schema.sql` and `src/lib/db-types.ts` are
updated to match. Run `pnpm migrate` when you are ready; `pnpm bottb doctor` tells you whether it is
still needed.
