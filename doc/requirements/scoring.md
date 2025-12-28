# Scoring Requirements

![Results Page](../screenshots/results-page.png)

## Point Distribution

| Category    | Max     | Source        |
| ----------- | ------- | ------------- |
| Song Choice | 20      | Judge average |
| Performance | 30      | Judge average |
| Crowd Vibe  | 30      | Judge average |
| Crowd Vote  | 20      | Proportional  |
| **Total**   | **100** |               |

## Crowd Score Calculation

```
Band Score = (Band Votes / Total Votes) × 20
```

## Results Display

### Overall Winner

- Trophy icon, band name, company badge
- Total score prominent

### Category Winners

- Grid showing best in each category
- Song Choice, Performance, Crowd Vibe, Crowd Favorite

### Full Results Table

- All bands ranked by total score
- Individual category scores
- Vote counts

### Band Detail

- Visual score bars per category
- Total score and rank

## Finalization

CLI: `npm run finalize-event <id>`

1. Calculate final scores
2. Store in `finalized_results` table
3. Set status to "finalized"
4. Disable voting

## Tie-Breaking

1. Higher crowd vote
2. Higher performance score
3. Show as co-winners
