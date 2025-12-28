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

## Double Voting Prevention

### Layer 1: FingerprintJS (Primary)

- 40+ browser characteristics
- Stable across sessions
- Confidence scoring

### Layer 2: Custom Fingerprint (Fallback)

- IP + User Agent + Event ID + Daily timestamp
- SHA-256 hashed

### Layer 3: Cookie Tracking

- `voted_[eventId]` cookie
- Allows vote updates (not duplicates)
- 30-day expiry

### Layer 4: Server Validation

- Check both fingerprint types in database
- Return 409 if duplicate found

## Vote Flow

1. Client gets fingerprint (FingerprintJS + custom)
2. POST `/api/votes` with fingerprints
3. Server checks cookie (can update?)
4. Server checks database fingerprints
5. Create/update/reject vote
6. Set cookie for future updates

## API Endpoints

| Endpoint                | Auth   | Rate Limit |
| ----------------------- | ------ | ---------- |
| `POST /api/votes`       | Public | 10/min     |
| `POST /api/votes/batch` | Admin  | 200/min    |

## UI States

1. **New Voter**: Clean form, "Submit Vote"
2. **Returning** (cookie): Pre-filled, "Update Vote"
3. **Already Voted** (fingerprint): "Already voted" message
4. **Event Not Active**: "Voting closed" message

## Key Files

- `src/lib/scoring.ts`: Version configs, category definitions
- `src/app/vote/`: Voting pages
- `src/app/api/votes/`: Vote submission API
