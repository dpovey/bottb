# Voting Requirements

![Crowd Voting Page](../screenshots/vote-crowd.png)

## Voting Types

| Type  | Path                    | Input           | Points            |
| ----- | ----------------------- | --------------- | ----------------- |
| Crowd | `/vote/crowd/[eventId]` | Select one band | 20 (proportional) |
| Judge | `/vote/judge/[eventId]` | Score all bands | 80 (averaged)     |

## Scoring Criteria

| Criteria    | Points  |
| ----------- | ------- |
| Song Choice | 20      |
| Performance | 30      |
| Crowd Vibe  | 30      |
| Crowd Vote  | 20      |
| **Total**   | **100** |

## UI States

### Crowd Voting Page

1. **New Voter**: Band list with radio buttons, "Submit Vote"
2. **Returning Voter** (cookie): Previous choice shown, "Update Vote"
3. **Already Voted** (fingerprint): "Already voted" message
4. **Success**: Confirmation with band name

### Judge Voting Page

- Band accordion/cards
- Slider/input per criterion
- Validation: all bands, all criteria, valid ranges
- "Submit All Scores" button

## Double Voting Prevention

1. **FingerprintJS**: Browser fingerprint (primary)
2. **Custom Fingerprint**: IP + User Agent hash (fallback)
3. **Cookie**: Allows updates, tracks previous vote
4. **Server Validation**: Database duplicate check

## API

- `POST /api/votes`: Submit vote (public, 10/min rate limit)
- `POST /api/votes/batch`: Admin batch submission
- Response 409 for duplicates with previous band name
