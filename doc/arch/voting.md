# Voting System

Crowd and judge voting with multi-layered duplicate prevention.

## Scoring Versions

Events have a `scoring_version` that determines categories and point distribution:

| Version  | Events                       | Description                                |
| -------- | ---------------------------- | ------------------------------------------ |
| `2022.1` | Brisbane 2024, Brisbane 2025 | Winner-only display, no detailed breakdown |
| `2025.1` | Sydney 2025                  | Full breakdown with Scream-o-Meter         |
| `2026.1` | Future events (default)      | Full breakdown with Visuals category       |

### 2022.1 (Legacy)

- No detailed scoring breakdown
- Winner stored directly in event info
- No judge scoring UI

### 2025.1

| Category       | Points  | Type                 |
| -------------- | ------- | -------------------- |
| Song Choice    | 20      | Judge                |
| Performance    | 30      | Judge                |
| Crowd Vibe     | 30      | Judge                |
| Crowd Vote     | 10      | Crowd (proportional) |
| Scream-o-Meter | 10      | Measurement          |
| **Total**      | **100** |                      |

### 2026.1 (Current)

| Category    | Points  | Type                 |
| ----------- | ------- | -------------------- |
| Song Choice | 20      | Judge                |
| Performance | 30      | Judge                |
| Crowd Vibe  | 20      | Judge                |
| Crowd Vote  | 10      | Crowd (proportional) |
| Visuals     | 20      | Judge                |
| **Total**   | **100** |                      |

**Visuals** covers costumes, backdrops, set design, and visual presentation.

## Voting Types

| Type  | Path                    | Points                    |
| ----- | ----------------------- | ------------------------- |
| Crowd | `/vote/crowd/[eventId]` | 10 max (proportional)     |
| Judge | `/vote/judge/[eventId]` | 70-90 (version dependent) |

## Event Lifecycle

```
upcoming → voting → closed → locked → finalized
```

Defined in `src/lib/event-lifecycle.ts` and driven from the "Run the night"
admin page (see `doc/requirements/run-the-night.md`).

| Status      | Meaning                                                          |
| ----------- | ---------------------------------------------------------------- |
| `upcoming`  | Before crowd voting opens                                        |
| `voting`    | Crowd voting open                                                |
| `closed`    | Voting closed; held votes reviewed, judge sheets checked         |
| `locked`    | Results calculated and frozen in `finalized_results`; not public |
| `finalized` | Results public                                                   |

- Transitions are a compare-and-swap on `events.status`, so only one of two
  simultaneous requests wins, and each is logged in `event_status_log`.
- An event is _live_ while `voting`, `closed` or `locked`: `getActiveEvent`
  returns it and `getPastEvents` leaves it out. Nothing public shows a winner
  until `finalized`.
- Writes that depend on the status (held-vote decisions, judge sheets) repeat
  the status condition in their own SQL, so they cannot land after a transition.

## Double Voting Prevention

Only `approved` votes are counted (`getBandScores`). A vote that looks like a
repeat is stored as `pending` and decided by an admin; it is never refused,
because identical phones are indistinguishable (same FingerprintJS id, same
browser string, and on venue Wi-Fi or a carrier gateway the same IP address).

### Layer 1: Cookie

- `voted_[eventId]` holds `{ bandId, bandName, voteId }`
- A returning voter updates that one vote by id (`updateCrowdVoteChoice`)
- 30-day expiry

### Layer 2: Email

- Optional; lower-cased
- Same address as an approved vote → held

### Layer 3: FingerprintJS

- 40+ browser characteristics; identical handsets collide
- Same visitor id as an earlier vote → held

### Layer 4: Custom Fingerprint

- SHA-256 of IP + User Agent + Event ID + date
- Same fingerprint as an earlier vote → held (stored under a fresh fingerprint,
  since `votes.vote_fingerprint` is unique)

### Review

`src/lib/vote-review.ts` matches each held vote against the earlier votes and
suggests approve or reject; the admin decides on the "Run the night" page.
Rejected votes are kept with `status = 'rejected'`.

## Vote Flow

1. The voting page polls `GET /api/events/[eventId]/ballot` (cached) and shows
   the ballot only while the event is `voting`
2. Client gets fingerprint (FingerprintJS) and POSTs `/api/votes`
3. Server checks the event is `voting` and the band belongs to it
4. Cookie with a vote id → update that vote; otherwise run the repeat checks
5. Insert as `approved` (200) or `pending` (201)
6. Set cookie for future updates

`POST /api/votes` only ever records crowd votes: `voter_type` and judge score
fields in the body are ignored.

## Judge Sheets

`POST /api/votes/batch` (admin) takes one judge's whole sheet: every band
exactly once, whole-number scores within the scoring version's range. It is
saved in a single statement (all or nothing), one sheet per judge
(case-insensitive), until results are locked. To correct a sheet, delete it on
the "Run the night" page and enter it again.

## API Endpoints

| Endpoint                           | Auth                                | Rate Limit        |
| ---------------------------------- | ----------------------------------- | ----------------- |
| `POST /api/votes`                  | Public                              | 300/min           |
| `POST /api/votes/batch`            | Admin                               | 200/min           |
| `GET /api/events/[eventId]/ballot` | Public                              | none (CDN-cached) |
| `/api/events/[eventId]/night/*`    | Admin                               | 200/min           |
| `GET /api/events/[eventId]/scores` | Public once finalized; admin before | 100/min           |

Rate limits are per IP address + browser, with a separate counter per limit
type. The vote limit is high because a venue's Wi-Fi puts the whole crowd behind
one address.

## UI States

1. **Voting Opens Soon**: event `upcoming`
2. **New Voter**: Clean form, "Submit Vote"
3. **Returning** (cookie): Pre-filled, "Update Vote"
4. **Vote Submitted / Vote Received**: counted, or held for review
5. **Voting Has Closed**: event `closed`, `locked` or `finalized`

## Key Files

- `src/lib/scoring.ts`: Version configs, category definitions
- `src/lib/event-lifecycle.ts`: Statuses, transitions, readiness rules
- `src/lib/vote-review.ts`: Held-vote matching and suggestions
- `src/lib/night.ts`, `src/lib/db/night.ts`: "Run the night" state and writes
- `src/app/vote/`: Voting pages
- `src/app/api/votes/`: Vote submission API
