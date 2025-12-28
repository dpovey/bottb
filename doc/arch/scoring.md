# Scoring Engine

Score calculation and result finalization with version-aware processing.

## Scoring Versions

Defined in `src/lib/scoring.ts`:

| Version  | Max Judge | Max Crowd | Total | Special Category       |
| -------- | --------- | --------- | ----- | ---------------------- |
| `2022.1` | -         | -         | -     | Winner stored directly |
| `2025.1` | 80        | 10        | 100   | Scream-o-Meter (10)    |
| `2026.1` | 90        | 10        | 100   | Visuals (20)           |

### 2022.1 (Legacy)

- No detailed scoring
- Winner name stored in `event.info.winner`
- Results page shows winner only

### 2025.1

```
Song Choice (20) + Performance (30) + Crowd Vibe (30)
+ Crowd Vote (10) + Scream-o-Meter (10) = 100
```

### 2026.1 (Current Default)

```
Song Choice (20) + Performance (30) + Crowd Vibe (20)
+ Crowd Vote (10) + Visuals (20) = 100
```

## Score Calculation

### Judge Scores

- Each judge rates each band on applicable criteria
- Final = average across all judges per category

### Crowd Vote

```
Band Score = (Band Votes / Total Votes) × 10
```

### Scream-o-Meter (2025.1)

- Real-time crowd noise measurement
- Score 1-10 stored directly

### Visuals (2026.1)

- Judge-scored category (0-20)
- Costumes, backdrops, set design, visual presentation

## Dynamic vs Finalized

| Event Status | Data Source                                  |
| ------------ | -------------------------------------------- |
| `voting`     | `getBandScores()` - calculated dynamically   |
| `finalized`  | `getFinalizedResults()` - cached in database |

**Critical Rule**: Always check for finalized results first.

## Finalization Process

CLI: `npm run finalize-event <event-id>`

1. Parse scoring version from event info
2. Calculate final scores using version-appropriate formula
3. Determine winners (overall + per category)
4. Store in `finalized_results` table (JSONB)
5. Update event status to `finalized`

## Finalized Result Structure

```
result_data: {
  overall_winner: BandScore
  category_winners: {
    songChoice, performance, crowdVibe, crowdFavorite, visuals?
  }
  band_scores: BandScore[]
  total_votes, judge_count, crowd_votes
}
```

## Tie-Breaking

1. Higher crowd vote wins
2. Higher performance score wins
3. Show as co-winners

## Display Components

- `ScoreBreakdown`: Category bars (version-aware)
- `WinnerDisplay`: Overall winner highlight
- `CategoryWinners`: Grid of category winners (version-aware)
- `ScoringLegend`: Explains scoring formula for version

## Key Functions

```typescript
getScoringConfig(version) // Get full config
getCategories(version) // Get category list
hasDetailedBreakdown(version) // Check if shows scores
parseScoringVersion(eventInfo) // Parse with fallback
calculateTotalScore(scores, version)
getMaxJudgePoints(version)
```
