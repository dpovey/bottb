# Scoring Requirements

![Results Page](../screenshots/results-page.png)

Point distribution is version-aware — see `doc/arch/scoring.md` for every
version and `src/lib/scoring.ts` for the definitions themselves. The
band-facing explanation of the current system lives at `/about/scoring`
(`src/app/about/scoring/page.tsx`).

## Point Distribution (2026.2 — current default)

| Category    | Max     | Source             |
| ----------- | ------- | ------------------ |
| Song Choice | 20      | Judge average      |
| Performance | 20      | Judge average      |
| Crowd Vibe  | 20      | Judge average      |
| Visuals     | 20      | Judge average      |
| Crowd Vote  | 20      | Relative to leader |
| **Total**   | **100** |                    |

## Crowd Score Calculation

The band with the most votes takes the full crowd-vote allocation; the rest
are scored in proportion to that band.

```
Band Score = (Band Votes / Max Band Votes) × Crowd Vote Max
```

## Results Display

### Overall Winner

- Trophy icon, band name, company badge
- Total score prominent

### Category Winners

- Grid showing best in each category (categories vary by scoring version)
- Song Choice, Performance, Crowd Vibe, Visuals, Crowd Favorite

### Full Results Table

- All bands ranked by total score
- Individual category scores
- Vote counts

### Band Detail

- Visual score bars per category
- Total score and rank

## Finalization

CLI: `pnpm finalize-event <id>`

1. Calculate final scores
2. Store in `finalized_results` table
3. Set status to "finalized"
4. Disable voting

## Tie-Breaking

1. Higher crowd vote
2. Higher performance score
3. Show as co-winners
