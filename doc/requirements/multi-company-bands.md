# Multi-Company Bands — Design & Migration Plan

> Status: **Planned** (Phase 1 in progress). Motivating case: the **ShipReX** band in
> `events/brisbane-2026.json` is drawn from **Rex Software + UrbanX**, but the data model
> only records a single `bands.company_slug`, so UrbanX is unrepresentable.
>
> Steady-state spec lives in [`bands-companies.md`](./bands-companies.md); this doc covers
> the change and its consequences.

## Design decisions (locked)

1. **Model — primary + join table.** Keep `bands.company_slug` as the **primary/lead**
   company (backward-compatible: the ~15 existing single-company joins keep working). Add a
   `band_companies` join table holding the full set, including the primary.
2. **Display — show all companies everywhere.** Every company badge slot renders all of a
   band's companies (e.g. `Rex Software + UrbanX`), including song/video/photo cards. The
   primary flag still exists (ordering, backward-compat, winner attribution) but display
   never branches on it — one `CompanyBadgeGroup` is used everywhere.
3. **Cardinality — assume ≤ 2 companies** for now. No "+N more" overflow handling yet; a
   plain `A + B` layout. Leave a comment noting the assumption so it is not a silent cap.
4. **Finalized results — current companies, not a snapshot.** `finalized_results` stays
   company-free; company is derived from live band data at display time.
5. **API / seed field — `company_slugs[]` + explicit `primary_company`** as the single
   source of truth (aligns the existing `company` vs `company_slug` naming drift).
6. **Data scope — 2026 only.** UrbanX attaches to ShipReX in `brisbane-2026.json` /
   `seed-brisbane-2026.ts` only. `brisbane-2024.json` and `brisbane-2025.json` stay
   `rex-software`-only.

## Schema

```sql
CREATE TABLE band_companies (
  band_id      varchar(255) NOT NULL REFERENCES bands(id)       ON DELETE CASCADE,
  company_slug varchar(255) NOT NULL REFERENCES companies(slug) ON DELETE CASCADE ON UPDATE CASCADE,
  is_primary   boolean NOT NULL DEFAULT false,
  position     integer NOT NULL DEFAULT 0,
  PRIMARY KEY (band_id, company_slug)
);
CREATE INDEX idx_band_companies_company ON band_companies(company_slug);
CREATE UNIQUE INDEX uq_band_companies_primary ON band_companies(band_id) WHERE is_primary; -- <=1 primary/band
```

**Invariant:** the `is_primary = true` row's slug equals `bands.company_slug`.
`bands.company_slug` remains the fast path for badges/winner/OG; the join table is queried
where the full list is shown.

**FK asymmetry (intentional):** `bands.company_slug` is `ON DELETE SET NULL` (keeps the
band, drops the lead); a deleted company should just remove the _association_ → the join
row is `ON DELETE CASCADE`. When a company is deleted, a band may lose its primary row →
repair by promoting the next `position` to primary, or nulling `bands.company_slug`.

**Backfill:**

```sql
INSERT INTO band_companies (band_id, company_slug, is_primary, position)
SELECT id, company_slug, true, 0 FROM bands WHERE company_slug IS NOT NULL;
```

## Consequence audit + resolution strategy

### A. Schema & migration

- **A1** New table in both schema sources — `src/lib/schema.sql` + new migration (per
  `.claude/rules/database.md`). Migration `up` creates table/indexes + backfill + inserts
  UrbanX company; `down` drops the table.
- **A2** Backfill existing bands (see SQL above).
- **A3** Keep the 1:1 FK (`schema.sql:450`, `migrations/1768022884123_*`) — **no change**.

### B. Read paths — repeated `LEFT JOIN companies c ON b.company_slug = c.slug` (~15 sites)

- **B1** `src/lib/db/bands.ts:13,29,41` — keep the primary join for legacy
  `company_name/icon/logo`; add a `LEFT JOIN LATERAL` aggregating
  `json_agg(... ORDER BY bc.is_primary DESC, bc.position)` → `companies: Company[]`.
- **B2** `src/app/band/[bandId]/page.tsx:393-397,479-483` — same aggregate; extract inline
  SQL into a shared helper to kill duplication.
- **B3** Song/video/photo reads (`songs.ts:87,121,177,501`; `videos.ts:43,74,101`;
  `photos.ts`) — cards show all companies too (decision 2), so surface `companies[]`.
- **B4** Setlists API (`api/events/[eventId]/setlists/route.ts:36,48,135,147`) — add
  `companies[]` alongside `company_slug`.

### C. Write paths

- **C1** Create band (`api/bands/route.ts:49-50`) — after inserting the band, insert join
  rows (primary = `company_slug`, plus additional). Transaction.
- **C2** Edit band (`api/band/[bandId]/route.ts:80`) — accept `company_slugs[]` + primary;
  delete + re-insert `band_companies`; keep `bands.company_slug` = primary in sync.
- **C3** Validation (`src/lib/api-schemas.ts:98-114`) — extend `bandCreateSchema` with
  `company_slugs[]` + `primary_company`; validate each slug exists and primary ∈ set.
- **C4** Company delete guard + cascade repair (`api/companies/[slug]/route.ts:107-113`;
  `getCompanyBands` `companies.ts:51`) — guard must query the **join table** (else it
  misses secondary-only associations); add primary-repair on company delete.

### D. Company-side reads

- **D1** `companies.ts:17,20` (`getCompanies`), `getDistinctCompanies:60-70` — repoint the
  `INNER JOIN bands` to `band_companies`; `COUNT(DISTINCT bc.band_id)`. Otherwise UrbanX
  shows 0 bands and is hidden from `/companies`, marquee, and filter dropdowns.
- **D2** `companies.ts:40-55` `getCompanyBands`, `companies/[slug]/page.tsx` — query via
  the join table so UrbanX's page lists ShipReX.

### E. Types

- **E1** `src/lib/db-types.ts:90-117` `Band` — add `companies?: Company[]`; keep legacy
  single fields (now = primary).
- **E2** ~7 duplicated inline band types (`event-admin-dashboard.tsx:35`,
  `results/[eventId]/page.tsx:68`, `event-card.tsx:52-60`, `event-page-client.tsx:33`,
  `setlist-admin-client.tsx:12`, `songs.ts:40-42`, `videos.ts:147-149`) — add `companies`.

### F. UI display — "show all"

- **F1** `company-badge.tsx`, `company-icon.tsx` — add a `CompanyBadgeGroup` (array →
  badges / "A + B"); one source used everywhere.
- **F2** Dedup-by-slug (`event-company-strip.tsx:33-39`, `event-card.tsx:260-264`) —
  iterate `band.companies` instead of the single `company_slug`.
- **F3** `scoring/WinnerDisplay.tsx:17-47,109-133`, `ScoreBreakdown.tsx:9-11,132-137` —
  render all companies.
- **F4** Band page badge/OG/JSON-LD (`band/[bandId]/page.tsx:804-807,566,592`,
  `opengraph-image.tsx`, `seo/music-group-jsonld.tsx:38-43`) — show/emit all companies.
- **F5** Event/results/home/events lineups (`event-page-client.tsx:399-402,219-222`,
  `results/[eventId]/page.tsx:288,463`, `page.tsx:305,335`, `events/page.tsx:162,192`,
  `nav/events-dropdown.tsx`) — swap single badge → badge group.
- **F6** Admin forms (`event-admin-dashboard.tsx:622,659-670,717-739`,
  `thumbnail-generator.tsx:80,102,399`, `setlist-admin-client.tsx:218-220`) — convert
  single `<select>` → multi-select + a "primary" marker; submit `company_slugs[]` + primary.

### G. Scoring / results / winner

- **G1** `getBandScores` (`events.ts:123,145`) — voting is band-keyed, so scoring math is
  unaffected; change only the display projection to carry `companies[]`.
- **G2** `getPastEventsWithWinners` (`events.ts:54-66`, interface `:38-40`) —
  `winner_company_*` becomes an array; past-events/home/dropdown show all winner companies.
- **G3** `results.ts` / `finalized_results` — company derived at display, **no change**
  (decision 4: reflects current company set).

### H. Non-UI outputs

- **H1** Search index (`build-search-index.ts:214-240`, `public/search-index.json`) — index
  all companies per band; rebuild via `pnpm build:search-index`.
- **H2** Scoring sheet (`generate-scoring-sheet.ts:102-104,159-178,253`) — join via
  `band_companies`; print all company names.
- **H3** Descriptions generator (`generate-descriptions-local.ts:214`) — include all
  companies in AI context.
- **H4** QR sheet (`generate-qr-sheet.ts`) — no company usage, **no change**.
- **H5** Sitemap (`sitemap.ts`) — UrbanX auto-appears once it is a company row with a band.

### I. Seed data & tooling

- **I1** Create the **UrbanX** company row (prerequisite) — done in the Phase 1 migration;
  logo/icon set later via `set-company-logo.ts`.
- **I2** Event JSON (`brisbane-2026.json:32-34`) — add `company_slugs[]`; ShipReX 2026 =
  `["rex-software","urbanx"]`, primary `rex-software`. 2024/2025 unchanged (decision 6).
- **I3** `create-event.ts:48,173-208,246-247` — support `company_slugs[]`; validate each;
  insert band + join rows.
- **I4** `seed-brisbane-2026.ts:137-142,205-247` — upsert UrbanX; write ShipReX join rows.
- **I5** `rename-band-id.ts:38-39` — also copy `band_companies` rows for the new id.
- **I6** `migrations/1776910239803_*` — historical, no edit; backfill (A2) covers it.

### J. Tests & fixtures

- **J1** `src/__mocks__/handlers.ts:327-376`, `event-card.stories.tsx:63-84` — add
  multi-company fixtures.
- **J2** `e2e/seed-test-db.ts`, `e2e/fixtures/test-db.sql` — include `band_companies` + a
  multi-company band; re-dump via `pnpm e2e:dump`.
- **J3** New tests — backfill correctness, multi-company read aggregation, company-delete
  primary repair, `getCompanyBands` via join, edit replace-set.

## Phased rollout (each phase independently shippable)

1. **Data foundation** — migration + `schema.sql` mirror + backfill (A); create UrbanX
   company (I1). No behavior change.
2. **Reads + types** — `band_companies` aggregate in `db/*`, `Band.companies`, company-side
   counts (B, D, E). Backward compatible.
3. **Writes + admin** — API + validation + multi-select admin form (C, F6, I3).
4. **Display** — `CompanyBadgeGroup` + all "show all" components (F, G2, H1–H3).
5. **Data** — set ShipReX 2026 = rex + urbanx (I2, I4).
6. **Tests** throughout (J).

Pre-commit gate each phase: `pnpm format && pnpm typecheck && pnpm lint && pnpm test`.

## Progress

PR #192 (`feat/multi-company-bands`):

- **Phase 1 — done.** Migration applied; `band_companies` + backfill + `urbanx`
  company row live. ShipReX 2026 linked to `rex-software` (primary) + `urbanx`.
- **Phase 2 — done (core).** `companies[]` aggregate on band reads + band page;
  company-side counts/filters via the join table (`Band.companies`). Song/video/
  photo reads (B3) and setlists API (B4) not yet plumbed.
- **UrbanX asset — done.** White (inverted) logo + X-mark icon uploaded to Blob.
- **Phase 4 — partial.** `CompanyBadgeGroup` + `bandCompanyList()` helper; band
  page hero, event lineup badge, event company-logo strip, and event-card dedup
  now render all companies. **Still primary-only** (data not plumbed): winner/
  scoring badges (needs G1/G2), song/video/photo cards (B3), OG image + JSON-LD
  (F4 tail).
- **Phase 3 (write paths / admin multi-select) — not started** (C, F6, I3).
