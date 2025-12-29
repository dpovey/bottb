# Architecture Overview

Next.js full-stack application for tech band competitions with voting, photos, and results.

## Principles

- Server-first rendering with Next.js App Router
- Strict TypeScript throughout
- Database as source of truth (Neon Postgres)
- Component-driven development with Storybook

## Modules

| Module                                | Description                        |
| ------------------------------------- | ---------------------------------- |
| [Data Layer](./data-layer.md)         | Database schema, types, queries    |
| [Authentication](./authentication.md) | Admin auth with NextAuth.js        |
| [Voting](./voting.md)                 | Crowd/judge voting, fingerprinting |
| [Scoring](./scoring.md)               | Score calculation, finalization    |
| [Photos](./photos.md)                 | Photo gallery, slideshow, sharing  |
| [Search](./search.md)                 | Orama client-side search           |
| [API](./api.md)                       | REST endpoints, rate limiting      |
| [Components](./components.md)         | UI component architecture          |
| [Layouts](./layouts.md)               | Page layouts and navigation        |
| [Analytics](./analytics.md)           | PostHog event tracking             |
| [Social](./social.md)                 | LinkedIn/Meta posting              |
| [SEO](./seo.md)                       | Metadata, structured data, sitemap |

## Tech Stack

| Layer     | Technology                        |
| --------- | --------------------------------- |
| Framework | Next.js 16, React 19              |
| Styling   | Tailwind CSS 4                    |
| Database  | Neon Postgres                     |
| Auth      | NextAuth.js v5                    |
| Storage   | Vercel Blob                       |
| Analytics | PostHog + Vercel Analytics        |
| Testing   | Vitest, RTL, Storybook, Chromatic |

## Key Decisions

### Server/Client Separation

- `user-context.ts`: Shared interfaces only
- `user-context-server.ts`: Server functions (Node.js, DB)
- `user-context-client.ts`: Client functions (browser APIs)

### Finalized Results

- Finalized events use cached results from `finalized_results` table
- Non-finalized events calculate scores dynamically
- Always check `event.status === 'finalized'` first

### API Protection

| Endpoint                | Auth   | Rate Limit |
| ----------------------- | ------ | ---------- |
| `/api/votes`            | Public | 10/min     |
| `/api/votes/batch`      | Admin  | 200/min    |
| `/api/photos/[id]/jpeg` | Public | 20/min     |
