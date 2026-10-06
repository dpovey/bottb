# Run the Night

The admin page that walks an operator through a live event, one step at a time:
open crowd voting, close it, decide the held votes, check the judge sheets,
finalise the results, release them.

- Page: `/admin/events/[eventId]/run` (linked from the admin dashboard and each event's admin page)
- Rules: `src/lib/event-lifecycle.ts` (state machine), `src/lib/vote-review.ts` (held votes)
- Server: `src/lib/night.ts`, `src/lib/db/night.ts`, `src/app/api/events/[eventId]/night/`
- End-to-end test: `e2e/run-the-night.spec.ts`

## On the night

Open **Admin → Events → Run the night** for the event. The page refreshes itself
every few seconds, so it can stay open all night, on a laptop or a phone.

| Step                | What you press         | What happens                                                                                                                               |
| ------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. Before voting    | **Open crowd voting**  | The voting page starts taking votes. Phones already on it switch to the ballot by themselves within a few seconds (ten at most).           |
| 2. Voting open      | **Close crowd voting** | The voting page stops taking votes. Phones still on the ballot are told voting has closed.                                                 |
| 3. Voting closed    | **Finalise results**   | Disabled until every held vote has a decision and every judge sheet is complete. Calculates and freezes the scores. Nothing is public yet. |
| 4. Results locked   | **Release results**    | The results page, the winner and the breakdown go public.                                                                                  |
| 5. Results released | —                      |                                                                                                                                            |

Every step asks for confirmation and says what it will do. Every step can be
undone with the small button under the main one: _Voting opened by mistake_,
_Reopen crowd voting_, _Unlock results_ (discards the frozen scores so votes or
judge sheets can be corrected), _Take results down_.

Between closing and finalising:

- **Held votes.** A vote that looks like a repeat of an earlier one is not
  counted until you approve it. Each has a suggestion and the reason for it.
  _Follow suggestions_ applies them all; _Approve all_ / _Reject all_ and the
  per-vote buttons are there too, and _Already decided_ lets you undo. Band
  names are hidden on this list so decisions are made blind.
- **Judge sheets.** Enter each judge's sheet from _Enter a judge's scores_.
  _Check against the paper sheet_ shows what was typed. To fix a mistake, delete
  the sheet and enter it again. Sheets can be entered at any point up to
  finalising, including before voting opens.
- **Show scores** reveals the per-band vote tallies, the standings and (once
  locked) the winner. It is off by default so the screen is safe to have open
  where others can see it.

The _Screens_ box links the QR code page for the projector (it shows whether
voting is open and follows changes by itself), the voting page, judge entry and
the results page (admins can preview results while they are locked).

## Rehearsing

**Admin dashboard → Rehearse with test event** creates (once) and opens a
practice event, _Test Night (rehearsal)_, with five made-up bands. It behaves
exactly like a real event — real phones can scan its QR code and vote — but it
is flagged `is_test`, which keeps it out of the home page, the events list, the
navigation, the sitemap, the search index and every filter. Its own pages are
reachable by URL and marked `noindex`.

On the test event only, the run page has **Rehearsal tools**: add 40 simulated
crowd votes (a quarter of them repeats, so there are held votes to review), add
three simulated judges, and reset. These refuse to run against a real event.

## Event statuses

```
upcoming → voting → closed → locked → finalized
```

| Status      | Crowd can vote | Judge sheets editable | Held votes reviewable | Results                   |
| ----------- | -------------- | --------------------- | --------------------- | ------------------------- |
| `upcoming`  | no             | yes                   | no                    | —                         |
| `voting`    | yes            | yes                   | yes                   | —                         |
| `closed`    | no             | yes                   | yes                   | live preview, admins only |
| `locked`    | no             | no                    | no                    | frozen, admins only       |
| `finalized` | no             | no                    | no                    | frozen, public            |

`finalized` means what it always has across the site: results are public. The
admin's "Finalise results" button is the `closed → locked` step.

An event is _live_ (shown as "happening now", never as a past event, never with
a winner) while it is `voting`, `closed` or `locked`.

Rules the server enforces, whatever the page shows:

- A transition only applies if the event is still in the status it starts from.
  Two operators pressing the same button cannot both succeed, and a button
  pressed on a stale screen is refused.
- Finalising is refused while a held vote is undecided, when no judge sheet has
  been entered, or when a judge has not scored every band.
- Releasing is refused unless there is a frozen result for every band.
- Things worth a second look (a tie at the top, fewer than three judges, no
  crowd votes, voting already open for another event) are warnings: the
  confirmation lists them and the server only proceeds if exactly those
  warnings were acknowledged.
- Votes, held-vote decisions and judge sheets cannot change once results are
  locked. If one somehow does, the page says the locked results no longer match.
- Every transition is recorded in `event_status_log` with who made it.
- Results finalised before this page existed (every event up to Brisbane 2026)
  cannot be taken down or unlocked here: re-finalising would recalculate them
  under the current rules and replace the original scores.
- "Clear all scores" on the event admin page only works before voting opens
  (or on the test event). The old "set status" endpoint is retired.

## Held votes

Only `approved` crowd votes count towards the score. A vote is held (`pending`)
when it matches an earlier vote in the same event by:

- the same email address, or
- the same browser fingerprint (FingerprintJS — identical handsets share one), or
- an identical browser on the same IP address.

It is recorded and held, never refused: identical phones are indistinguishable
to us, and on venue Wi-Fi or a mobile carrier they share an IP address too, so
refusing would throw away real people's votes. The voter is told their vote was
received and will be checked.

Suggestions (`reviewVote` in `src/lib/vote-review.ts`):

| Situation                                                                                   | Suggestion |
| ------------------------------------------------------------------------------------------- | ---------- |
| Same email as an earlier vote                                                               | Reject     |
| Identical handset, different IP address                                                     | Approve    |
| Identical phone on a busy shared network (three or more kinds of device on that IP address) | Approve    |
| Second identical phone on one unshared connection                                           | Approve    |
| Third or later identical phone on one unshared connection                                   | Reject     |

A rejected vote is kept (`rejected`, with `reviewed_at` / `reviewed_by`) rather
than deleted.

A voter who comes back changes their own vote (by vote id, from their cookie
or from the id the voting page keeps in the browser); its approved / held /
rejected status stays as it was. Because the page sends that id with every
attempt, a vote that was saved but whose answer was lost on a bad signal is
recognised when the voter taps again, and is not recorded twice.

## API

All under `/api/events/[eventId]/night`, admin only:

| Endpoint           | Purpose                                                                   |
| ------------------ | ------------------------------------------------------------------------- |
| `GET  /`           | Everything the page shows (`NightState` in `src/lib/night-types.ts`)      |
| `POST /transition` | `{ transition, acknowledgedWarnings? }` — take one lifecycle step         |
| `PATCH /votes`     | `{ status, voteIds }` — approve, reject or un-decide specific crowd votes |
| `DELETE /judges`   | `{ name }` — delete one judge's sheet                                     |
| `POST /test`       | `{ action }` — rehearsal tools; 403 unless the event is the test event    |

Plus `POST /api/admin/test-event` (create/return the test event) and the public,
CDN-cached `GET /api/events/[eventId]/ballot` that the voting page and QR screen
poll for "is voting open, and which bands".

Every non-404 answer from the night endpoints carries the current `state`, so
the page always redraws from the server's view, success or failure.
