# PEP: Code Quality Remediation

> **Status:** Proposed
> **Owner:** TBD
> **Created:** 2026-04-26
> **Source:** Deep audit covering `src/lib/`, `src/app/api/`, `src/components/`, repo cruft, deps, and tests.

## Goal

Pay down the highest-signal tech debt found in the audit so that:

- `src/lib/db.ts` is no longer a 2,388-line grab bag.
- API routes have one validation, error, response, and naming convention.
- Admin clients stop copy-pasting CRUD boilerplate.
- Critical untested modules (`scoring.ts`, `image-processor.ts`, auth) are covered.
- The repo root and dependency list stop carrying dead weight.

## Non-goals

- Feature work. This PEP is purely structural.
- Rewriting working code for taste. Each wave must show a concrete, named win.
- Behavior change visible to end users (except Wave 7 stub fixes).

## Wave Model

Each wave is one or more PRs. Waves 1–3 are independent and can run in parallel. Waves 4 and 5 are large mechanical refactors and should each ship as a single PR. Wave 6 runs alongside everything. Wave 7 is product-gated and may not happen.

```
Wave 1 ──┐
Wave 2 ──┼──► Wave 4 ──┐
Wave 3 ──┘             ├──► Wave 7 (product-gated)
                       │
Wave 5 ────────────────┤
Wave 6 ────────────────┘
```

---

## Wave 1 — Cleanup

**Risk:** Low. **Effort:** ~½ day. **PRs:** 1.

Strip dead files, deps, and config so later waves work on a smaller surface.

| #   | Change                                              | Files                                                                                                                                                                              |
| --- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #   | Change                                              | Files                                                                                                                                                                                                                                                          |
| --- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1 | `git rm` accidentally tracked artifacts             | `bottb@0.1.0`, `tsc`, `audio.html`, `lighthouse-report.json`, `SCROLL_DEBUG_INFO.md`, `.cursor/debug.log` (note: `tsconfig.tsbuildinfo` and `lighthouse-report.report.{html,json}` matched gitignore patterns and were never tracked — no `git rm` needed)      |
| 1.2 | Move or gitignore root screenshots                  | 11 PNGs at repo root → `.gitignore` (`/*.png` and `/*.html`); files remain untracked in working dir                                                                                                                                                            |
| 1.3 | Reconcile orphan `docs/` against tracked `doc/`     | `git mv docs/ANALYTICS_TRACKING_PLAN.md doc/arch/analytics-events.md` + `docs/SLIDESHOW_REQUIREMENTS.md doc/requirements/slideshow.md`. `docs/org/` is untracked product-owner WIP — leave as-is                                                               |
| 1.4 | Delete superseded planning docs                     | `DESIGN-TODO.md` (all ✅), and **both** `TESTING_PLAN.md` + `TESTING_SUMMARY.md` + `VOTING_TEST_PLAN.md` — all reference Jest (project uses Vitest) so all three are stale                                                                                      |
| 1.5 | Drop unused Jest ecosystem                          | `package.json`: remove `jest`, `jest-environment-jsdom`, `jest-fixed-jsdom`, `@types/jest`. Add `/// <reference types="vitest/globals" />` to `vitest.shims.d.ts` — vitest globals were typed transitively through `@types/jest` and break without it          |
| 1.6 | Align Next ESLint config                            | bump `eslint-config-next` to `^16.2.0`                                                                                                                                                                                                                         |
| 1.7 | Delete orphan Storybook PostCSS config              | `.storybook/postcss.config.js` (references uninstalled `autoprefixer`)                                                                                                                                                                                         |
| 1.8 | Type missing env vars **used at runtime**           | `src/lib/env.ts`: replace dead `SOCIAL_TOKEN_SECRET` with `SOCIAL_TOKEN_ENCRYPTION_KEY` (the actually-consumed name); add `YOUTUBE_API_KEY` (used in `lib/youtube-api.ts` + `api/admin/youtube/scan`) and `GOOGLE_SITE_VERIFICATION` (used in `app/layout.tsx`) |
| 1.9 | Remove `@deprecated` aliases after sweeping callers | **Deferred to Wave 5** — touches multiple components (`WinnerDisplay.company`, `HeroFocalPoint` in `db.ts`/`db-types.ts`/api routes, `FocalPointImage.srcHigh` in `hero-background.tsx`); fits naturally with the component reorg                              |

**Note on 1.8 scope:** the original PEP listed `SPOTIFY_CLIENT_ID`/`SPOTIFY_CLIENT_SECRET` and `DATABASE_URL_UNPOOLED`/`POSTGRES_URL_NON_POOLING`. Those vars are only consumed inside `src/scripts/` via raw `process.env`, never through the typed `env.server` layer — so adding them to `env.ts` would be dead typing. They stay documented in `env.example`.

**Exit:** `pnpm format && pnpm typecheck && pnpm lint && pnpm test` clean. Repo root has zero loose PNGs / log files / build artifacts.

---

## Wave 2 — Shared primitives

**Risk:** Low. **Effort:** ~1 day. **PRs:** 1–2.

Pull out the obvious copy-paste before the API and component refactors so those waves use the new helpers.

| #   | Change                                               | Notes                                                                                                                                                                                                                                        |
| --- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1 | `src/lib/slug-utils.ts` exporting `nameToSlug()`     | Replace duplicates in `src/app/api/photographers/route.ts:24`, `src/app/api/companies/route.ts`, `src/app/admin/photographers/photographer-admin-client.tsx:42`, `src/app/admin/companies/company-admin-client.tsx:45`, and the four scripts |
| 2.2 | `<ErrorBanner>` in `src/components/ui/`              | Replace ~6 inline `bg-error/20 border border-error/50 …` blocks                                                                                                                                                                              |
| 2.3 | Sweep ad-hoc inputs onto existing `<AdminFormField>` | ~30 instances of `w-full px-4 py-2 rounded-lg bg-white/5 border border-white/20 …` in admin clients                                                                                                                                          |
| 2.4 | `useAdminCRUD<T>(apiPath)` hook                      | Returns `{ items, add, update, remove, isSubmitting, error }`; consumed by photographer/company/video/photo admin clients                                                                                                                    |

**Exit:** four admin clients each shrink by ≥ 30%. Zero raw `<input className="w-full px-4 py-2 …">` in admin code.

---

## Wave 3 — API standardization

**Risk:** Medium (touches every route). **Effort:** ~1–2 days. **PRs:** 3–4 (validation, envelope, naming, lint rule).

Pick one shape for every route and enforce it.

| #   | Change                                                 | Notes                                                                                                                                                                                                                              |
| --- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.1 | Add `zod` and `src/lib/api-schemas/`                   | Validate POST/PATCH bodies in every route; start with `bands`, `events`, `photos`, `votes`                                                                                                                                         |
| 3.2 | `withErrorHandling()` HOF                              | Wraps handlers, logs server-side, returns `{ error: 'Failed to <action>' }`. Removes `error.message` leaks in `src/app/api/admin/youtube/import/route.ts:95,114`, `…/youtube/scan/route.ts:113`, `…/social/suggest/route.ts:70-71` |
| 3.3 | Standardize response envelope                          | `{ data, error?, pagination? }`. Migrate routes incrementally; eliminate `{ success, message }` outliers like `src/app/api/band/[bandId]/route.ts:154-157`                                                                         |
| 3.4 | Collapse singular routes into plural                   | Move `/api/band/[bandId]` → `/api/bands/[bandId]`; update callers in `event-admin-dashboard.tsx`                                                                                                                                   |
| 3.5 | Lint rule: routes must not import `@/lib/sql` directly | Forces 20 raw-SQL routes onto `db.ts` helpers (or new ones)                                                                                                                                                                        |
| 3.6 | Replace in-memory rate limiter                         | `src/lib/api-protection.ts:67` `Map` → Vercel KV / Upstash; or document acceptance and add a TTL sweep                                                                                                                             |

**Exit:** every API route runs through `withErrorHandling`, validates input via Zod, returns the standard envelope, and pulls data from `db.ts` (no raw `sql\`…\``in`src/app/api/\*\*`).

---

## Wave 4 — Library refactor

**Risk:** Medium (single big PR, mostly mechanical). **Effort:** ~2 days. **PRs:** 1.

Break the two oversized files apart without changing public exports.

| #   | Change                                      | Notes                                                                                                                                                                                      |
| --- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 4.1 | Split `src/lib/db.ts` (2,388 LOC)           | Into `src/lib/db/{events,votes,photos,companies,videos,songs,setlist,results}.ts`; barrel `src/lib/db/index.ts` re-exports current names so callers don't move                             |
| 4.2 | Consolidate photo queries (~600 LOC)        | Collapse `getPhotosWithCount` (line 445), `getGroupedPhotosWithCount` (line 606), `getPhotosRandomWithCount` (line 531) into one builder; extract shared photographer/event JOIN fragments |
| 4.3 | Move user CRUD out of `password-auth.ts`    | `getUserByEmail`, `createUser`, `deleteUser`, `listUsers` → `src/lib/users.ts`; keep hashing + `authenticateUser` in `password-auth.ts`                                                    |
| 4.4 | Decompose `user-context-server.ts` (7K LOC) | Extract `browser-utils.ts`, `utm-tracking.ts`, `fingerprint.ts`; original file becomes a thin façade                                                                                       |

**Exit:** `db.ts` no longer exists at the root of `src/lib/`. No file in `src/lib/` exceeds ~600 LOC. All public imports of `@/lib/db` still resolve.

---

## Wave 5 — Component reorg

**Risk:** Medium (many file moves). **Effort:** ~1 day. **PRs:** 1.

| #   | Change                                                        | Notes                                                                                                                                                  |
| --- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 5.1 | Move loose top-level components into subdirs                  | `admin-toggle.tsx`, `admin-toolbar.tsx` → `components/admin/`; `facebook-pixel.tsx`, `posthog-provider.tsx`, `providers.tsx` → `components/providers/` |
| 5.2 | Resolve `nav-bar.tsx` vs `nav/header.tsx` duplication         | Pick one, delete the other                                                                                                                             |
| 5.3 | Rename stories to kebab-case                                  | `EventCard.stories.tsx` → `event-card.stories.tsx`, `Hero.stories.tsx` → `hero.stories.tsx`; ESLint rule for file naming                               |
| 5.4 | Split `src/components/photos/photo-slideshow.tsx` (1,476 LOC) | Into `slideshow-controls`, `slideshow-image`, `slideshow-pagination`, `use-slideshow-state`                                                            |
| 5.5 | Backfill stories                                              | `event-card`, `company-card`, `hero-carousel`, `shorts-carousel`, `video-carousel`, key `photos/` components — target 60% (currently 11%)              |

**Exit:** zero loose components at the top of `src/components/`. No component file exceeds 500 LOC. Stories coverage ≥ 60%.

---

## Wave 6 — Test gaps

**Risk:** Low (additive). **Effort:** ~1–2 days. **PRs:** 2–3, parallel to other waves.

| #   | Change                                                                | Notes                                                                                                                                                                                   |
| --- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6.1 | Unit tests for `src/lib/scoring.ts` (319 LOC, currently zero)         | All scoring versions (2022.1, 2025.1, 2026.1), category aggregation, zero/max-vote edges                                                                                                |
| 6.2 | Unit tests for `src/lib/image-processor.ts` (124 LOC, currently zero) | Variant generation, focal-point math, aspect ratios                                                                                                                                     |
| 6.3 | Unit tests for `password-auth.ts` and `middleware-auth.ts`            | Hash/verify, JWT extract, expiry, admin role checks                                                                                                                                     |
| 6.4 | Un-skip slideshow + label tests                                       | `src/components/photos/__tests__/photo-slideshow-view-tracking.test.tsx:131` (fix Embla mock or test the state hook); `src/app/api/photos/[photoId]/labels/route.test.ts` (8 `it.skip`) |
| 6.5 | DB integration smoke against real Postgres (port 5433)                | Vote dedup + event status transitions; reuse `seed-test-db.ts`                                                                                                                          |
| 6.6 | CI coverage gate                                                      | Fail PR if line coverage drops below baseline set after 6.1–6.5                                                                                                                         |

**Exit:** `scoring.ts`, `image-processor.ts`, `password-auth.ts`, `middleware-auth.ts` all > 80% line coverage. No `.skip` left in repo. CI baseline gate enabled.

---

## Wave 7 — Stub fixes (product-gated)

**Risk:** Medium (product behavior change). **Effort:** depends on product. **PRs:** 2.

Only run when the product owner is ready to ship the social features.

| #   | Change                           | Notes                                                                                                                      |
| --- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 7.1 | Implement Instagram video upload | `src/lib/social/video.ts:487` — Vercel Blob + Graph API media-create; align URL generator at line 294 with the real handle |
| 7.2 | LinkedIn org picker              | `src/app/api/admin/social/linkedin/callback/route.ts:78` — replace auto-pick of first org with explicit selection UI       |

**Exit:** no stub returning `null`/generic-URL in social code paths.

---

## Tracking

- One TODO.md entry per wave, linking to its PR(s).
- Each PR description must list the audit items it closes (e.g. _"closes Wave 3 §3.2"_).
- Don't merge a wave PR until `pnpm format && pnpm typecheck && pnpm lint && pnpm test` are green.

## Out of scope

- Adopting a service layer beyond `db.ts` helpers (revisit after Wave 4).
- Replacing NextAuth, Tailwind, or the migration tool.
- Adding new product features.
