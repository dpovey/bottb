# API Architecture

Next.js Route Handlers in `src/app/api/`.

## Route Structure

```
api/
├── auth/[...nextauth]/   # Authentication
├── events/               # Event data
│   └── [eventId]/scores/ # Event scores
├── bands/[eventId]/      # Bands by event
├── photos/[photoId]/     # Photo operations
├── votes/                # Voting
│   └── batch/            # Admin batch voting
├── setlist/[bandId]/     # Setlist management
├── songs/                # All songs
├── videos/               # Video management
├── upload/image/         # File uploads
└── admin/social/         # Social integration
```

## Protection Matrix

| Endpoint                    | Auth   | Rate Limit |
| --------------------------- | ------ | ---------- |
| `GET /api/events`           | Public | 100/min    |
| `POST /api/votes`           | Public | 10/min     |
| `POST /api/votes/batch`     | Admin  | 200/min    |
| `GET /api/photos/[id]/jpeg` | Public | 20/min     |
| `PATCH /api/photos/*`       | Admin  | -          |
| `DELETE /api/photos/*`      | Admin  | -          |
| `POST /api/admin/*`         | Admin  | -          |

## Response Codes

| Code | Usage            |
| ---- | ---------------- |
| 200  | Success          |
| 201  | Created          |
| 400  | Invalid input    |
| 401  | Unauthenticated  |
| 404  | Not found        |
| 409  | Duplicate (vote) |
| 429  | Rate limit       |
| 500  | Server error     |

## Rate Limiting

- In-memory Map with key/count/resetTime
- Key: IP address or user identifier
- Returns 429 with `X-RateLimit-Remaining` header

## Security Headers

All responses include via `next.config.ts`:

- Strict-Transport-Security
- X-Content-Type-Options
- X-Frame-Options
- Referrer-Policy
