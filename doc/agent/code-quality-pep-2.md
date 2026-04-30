# PEP 2: Code Quality Follow-ups

> **Status:** Proposed
> **Owner:** TBD
> **Created:** 2026-04-29
> **Predecessor:** [code-quality-pep.md](./code-quality-pep.md)
> **Source:** Items deferred from PRs #139–#144 (Waves 1–6) and Gemini review threads on those PRs.

## Purpose

The original 7-wave PEP shipped scoped, reviewable PRs that intentionally deferred lower-priority items so each wave could land cleanly. This document is the durable record of what was deferred and why, so the follow-up work isn't lost.

Group A (PEP carry-overs) is the most valuable — those items were named in the original plan and only partly delivered. Group B (review-driven) covers Gemini suggestions that didn't block merge but are worth doing. Group C (latent issues) covers pre-existing concerns surfaced when Wave 4's split made `db.ts` reviewable for the first time.

---

## Group A — Carried over from the original PEP

These were named in `code-quality-pep.md` but deferred during execution to keep individual PRs scoped.

### A1. `useAdminCRUD<T>(apiPath)` hook (PEP 2.4)

**Why deferred:** Wave 2 shipped the `<ErrorBanner>` and `nameToSlug()` extractions but the bigger-impact CRUD-state hook needs design discussion (ID-field naming differs across domains: `id` vs `slug`).

**Scope:** Returns `{ items, add, update, remove, isSubmitting, error }`. Consumed by `photographer-admin-client.tsx`, `company-admin-client.tsx`, `video-admin-client.tsx`, `photo-admin-client.tsx`. Should collapse the four near-clone state machines (574 + 514 + 612 + 661 LOC).

**Exit:** All four admin clients shrink ≥ 30%; CRUD logic lives in one place.

### A2. `<AdminInput>` sweep (PEP 2.3)

**Why deferred:** Wave 2 used `<ErrorBanner>` everywhere but left ~30 raw `<input className="w-full px-4 py-2 rounded-lg bg-white/5 …">` instances in admin clients untouched.

**Scope:** Replace those with the existing `<AdminInput>` / `<AdminFormField>` primitives in `src/components/ui/admin-form-field.tsx`. Mostly mechanical.

**Exit:** Zero raw `<input className="w-full px-4 py-2 …">` in `src/app/admin/`.

### A3. Response envelope (PEP 3.3)

**Why deferred:** Wave 3 introduced Zod and `withErrorHandling` for 4 representative routes; switching every route to a `{ data, error?, pagination? }` envelope shape would touch every client too.

**Scope:** Pick one envelope shape, migrate routes incrementally. Eliminate outliers like `{ success, message }` (`api/band/[bandId]/route.ts:154-157`) and bare arrays.

**Exit:** Every API route returns the standard envelope; no `{ success, message }` outliers.

### A4. Singular → plural route consolidation (PEP 3.4)

**Why deferred:** Wave 3 didn't touch routing.

**Scope:** Collapse `/api/band/[bandId]` into `/api/bands/[bandId]`; update callers in `event-admin-dashboard.tsx`. Fix the same singular/plural drift wherever else it exists.

**Exit:** All resource paths use the plural form.

### A5. ESLint rule banning raw SQL imports from `app/api/**` (PEP 3.5)

**Why deferred:** ~20 routes still import `@/lib/sql` directly; turning on the rule before migrating them would block CI.

**Scope:** Migrate the 20 routes onto `db.ts` helpers (or new ones), then add an ESLint rule disallowing `@/lib/sql` imports under `src/app/api/**`.

**Exit:** Rule is on; no API route imports raw `sql`.

### A6. Replace in-memory rate limiter (PEP 3.6)

**Why deferred:** `src/lib/api-protection.ts:67` still uses an in-memory `Map`. Needs a Redis/KV decision (Vercel KV vs Upstash) before implementation.

**Scope:** Pick a backend, swap the `Map`. Or document the acceptance and add a TTL sweep so it doesn't leak.

**Exit:** Rate-limit state survives a redeploy, or the trade-off is documented.

### A7. Photo query consolidation (PEP 4.2)

**Why deferred:** Wave 4 was scoped to a pure mechanical extraction. Consolidating the three near-clone photo functions (`getPhotosWithCount`, `getGroupedPhotosWithCount`, `getPhotosRandomWithCount`, ~600 LOC) requires understanding their behavior, not just moving them.

**Scope:** Collapse the three into one builder with strategy params. Extract the shared photographer/event JOIN fragments.

**Exit:** `src/lib/db/photos.ts` shrinks by ~250 LOC with no behavior change.

### A8. Move user CRUD out of `password-auth.ts` (PEP 4.3)

**Why deferred:** Wave 4 split `db.ts` but `password-auth.ts` still mixes hashing with user data access.

**Scope:** Move `getUserByEmail`, `createUser`, `deleteUser`, `listUsers` from `src/lib/password-auth.ts` to a new `src/lib/users.ts`. Keep hashing + `authenticateUser` in `password-auth.ts`. Extend Wave 6's `password-auth.test.ts` accordingly.

**Exit:** `password-auth.ts` only handles auth; user CRUD lives in `users.ts`.

### A9. Decompose `user-context-server.ts` (PEP 4.4)

**Why deferred:** Wave 4 only split `db.ts`. `user-context-server.ts` is 7,030 LOC and mixes UA parsing, UTM extraction, fingerprint generation, and cookie parsing.

**Scope:** Extract `browser-utils.ts`, `utm-tracking.ts`, `fingerprint.ts`. Original file becomes a thin façade.

**Exit:** No module in `src/lib/` exceeds ~600 LOC.

### A10. Move loose top-level components into subdirs (PEP 5.1)

**Why deferred:** Wave 5 was scoped to story renames + deprecation removal.

**Scope:** Move `admin-toggle.tsx`, `admin-toolbar.tsx` → `components/admin/`; `facebook-pixel.tsx`, `posthog-provider.tsx`, `providers.tsx` → `components/providers/`.

**Exit:** No components loose at the top of `src/components/` (other than top-level page-shell pieces).

### A11. Resolve `nav-bar.tsx` vs `nav/header.tsx` (PEP 5.2)

**Why deferred:** Need to confirm which is canonical and where each is imported.

**Scope:** Pick one, delete the other, redirect imports.

**Exit:** One nav component.

### A12. Split `photo-slideshow.tsx` (PEP 5.4)

**Why deferred:** 1,476 LOC component. Risky to split without careful behavioral testing.

**Scope:** Decompose into `slideshow-controls`, `slideshow-image`, `slideshow-pagination`, plus a `use-slideshow-state` hook.

**Exit:** No component file exceeds 500 LOC.

### A13. Stories backfill (PEP 5.5)

**Why deferred:** Wave 5 only renamed stories; coverage is 11% (16 / 140).

**Scope:** Add stories for `event-card`, `company-card`, `hero-carousel`, `shorts-carousel`, `video-carousel`, key `photos/` components.

**Exit:** Story coverage ≥ 60%.

### A14. Un-skip slideshow + label tests (PEP 6.4)

**Why deferred:** Wave 6 added 76 new tests but left 31 skipped tests untouched.

**Scope:**

- `src/components/photos/__tests__/photo-slideshow-view-tracking.test.tsx:131` — fix the Embla mock that crashes the runner, or test the state hook directly.
- `src/app/api/photos/[photoId]/labels/route.test.ts` — 8 `it.skip` placeholders for focal-point + label PATCH logic.

**Exit:** Zero `.skip` in repo.

### A15. DB integration smoke (PEP 6.5)

**Why deferred:** Needs Postgres test container plumbing in unit-test runs.

**Scope:** Vote dedup + event status transitions exercised against the real test Postgres (port 5433) via `seed-test-db.ts`.

**Exit:** Concurrent vote submissions and event-state transitions are covered against a real DB, not mocks.

### A16. CI coverage gate (PEP 6.6)

**Why deferred:** Need to set a baseline now that test count is 691.

**Scope:** Capture current line coverage as the floor; fail PR if coverage drops below it.

**Exit:** Coverage gate active in CI.

---

## Group B — Review-driven (Gemini)

These came from Gemini review threads on PRs #139–#144 and were judged worth doing but not blocking.

### B1. Thread `request.method` and `request.url` into `withErrorHandling` logs

**Source:** [PR #141, comment 3143769344](https://github.com/dpovey/bottb/pull/141#discussion_r3143769344)

**Scope:** Update `withErrorHandling` in `src/lib/api-protection.ts` to log `[api error] failed to <action> [<METHOD> <url>]: <error>` so server logs are searchable.

**Why deferred:** Cosmetic; lands naturally with the broader rollout of the HOF (Group A items A3/A4/A5).

### B2. Reword image-processor test comment

**Source:** [PR #144, comment 3143806844](https://github.com/dpovey/bottb/pull/144#discussion_r3143806844)

**Scope:** `src/lib/__tests__/image-processor.test.ts` — comment "800 === 900 lower bound for medium" should read "800 < 900". Trivial.

**Why deferred:** Doc-only nit. Pick up next time the file is touched.

### B3. Tighten middleware-auth dev-cookie test

**Source:** [PR #144, comment 3143806848](https://github.com/dpovey/bottb/pull/144#discussion_r3143806848)

**Scope:** `src/lib/__tests__/middleware-auth.test.ts` — dev-cookie test asserts the dev cookie name in isolation; add a complementary assertion that `__Secure-` is absent in that branch (the production branch already asserts the inverse, so coverage is already complete between the two tests; this just makes each test self-contained).

**Why deferred:** Coverage is already complete across the pair; this is a defensiveness improvement.

### B4. Lift `whitespace-pre-line` into an `<ErrorBanner multiline>` variant

**Source:** [PR #140, comment 3143761068](https://github.com/dpovey/bottb/pull/140#discussion_r3143761068)

**Scope:** Currently only `video-social-post.tsx` needs `whitespace-pre-line` (multi-line server messages from social APIs). If more callers need it, lift to a `multiline` prop instead of a per-caller className.

**Why deferred:** Single caller — premature abstraction until a second one shows up.

### B5. Replace raw `×` dismiss in `<ErrorBanner>` with `<CloseIcon>`

**Source:** [PR #140, comments 3143761053 + 3143761059](https://github.com/dpovey/bottb/pull/140#discussion_r3143761053)

**Scope:** Switch the dismiss button from `×` to `<CloseIcon>` for visual consistency with the rest of the UI.

**Why deferred:** Keeps the primitive dependency-free of the icons module. Revisit if the design system standardises on `<CloseIcon>` for dismissals.

### B6. Make admin slug fields freely editable

**Source:** [PR #140, comment 3143761064](https://github.com/dpovey/bottb/pull/140#discussion_r3143761064)

**Scope:** `value={newSlug || nameToSlug(newName)}` (in both `company-admin-client.tsx:195` and `photographer-admin-client.tsx`) makes the slug input difficult to edit manually because the displayed value comes from a fallback. Should split state: track the user's edited value separately, default to derived only on first render or when the user hasn't touched the field.

**Why deferred:** Pre-existing UX pattern across multiple admin clients. Lands naturally with A1 (`useAdminCRUD`).

---

## Group C — Latent issues in `db.ts` (pre-existing, surfaced by Wave 4's split)

Wave 4 was scoped as a pure mechanical extraction — no SQL or function logic changed. Splitting the file made these issues reviewable for the first time. None were introduced by the refactor; they were already in production.

### C1. SQL injection risk on `seed` interpolation **(security-high)**

**Source:** [PR #142, comment 3143781985](https://github.com/dpovey/bottb/pull/142#discussion_r3143781985)
**Location:** `src/lib/db/photos.ts:264` (was `src/lib/db.ts` pre-split)

**Scope:** The `seed` value is directly interpolated into a SQL fragment. Should use a parameterised query or strict numeric coercion.

**Why this is critical:** Any caller that lets a user-controlled value reach this `seed` parameter is a SQL injection vector. Audit call sites first; if all callers pass server-side numeric values it's lower-risk, but it's still wrong.

### C2. Manual PostgreSQL array literal construction **(security-high)**

**Source:** [PR #142, comment 3143781986](https://github.com/dpovey/bottb/pull/142#discussion_r3143781986)
**Location:** `src/lib/db/photos.ts:607`

**Scope:** Hand-rolled array literal string is being concatenated into a query rather than passed as a parameter. Switch to `sql\`... = ANY(${array})\`` or equivalent.

### C3. N+1 update in `getSetlistForBand` reorder

**Source:** [PR #142, comment 3143781988](https://github.com/dpovey/bottb/pull/142#discussion_r3143781988)
**Location:** `src/lib/db/songs.ts:306`

**Scope:** Updates inside a `for` loop. Replace with a single `UPDATE ... FROM (VALUES ...)` or batched query.

### C4. N+1 nested loop on song-conflict updates

**Source:** [PR #142, comment 3143781989](https://github.com/dpovey/bottb/pull/142#discussion_r3143781989)
**Location:** `src/lib/db/songs.ts:400`

**Scope:** Nested loop performs an individual update per conflict. Collect all `song_id`s and run one batched update.

### C5. N+1 inserts in `finalizeEventResults`

**Source:** [PR #142, comment 3143781993](https://github.com/dpovey/bottb/pull/142#discussion_r3143781993)
**Location:** `src/lib/db/results.ts:183`

**Scope:** Inserting finalized results one-at-a-time in a loop. Replace with a single multi-row `INSERT`.

---

## Sequencing

Suggested order of attack:

1. **C1, C2** — security; do these first regardless of other priorities.
2. **A14, A16** — un-skip + coverage gate; small, locks in test-suite quality.
3. **A1, A2, B6** — admin client cleanup; one PR collapses the four admin clients onto a shared hook with proper input components and slug UX.
4. **A7, A8, A9** — `src/lib/` refactor follow-ups; size + quality wins.
5. **A3, A4, A5, B1** — API standardisation rollout; one or two PRs migrating remaining routes.
6. **A6** — rate limiter (needs an infra decision).
7. **A10–A13** — component reorg; lower priority, can wait.
8. **C3–C5, B2–B5** — opportunistic; pick up next time you're in the file.

## Out of scope

This document tracks items deferred from the original PEP and its review feedback. New audit findings should go into a fresh PEP, not this one.
