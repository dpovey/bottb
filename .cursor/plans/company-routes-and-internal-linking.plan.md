# Company Routes & Internal Linking

## Background

From Ahrefs audit:

- 23 pages have only one incoming internal link (photographers, company-filtered photos)
- Company pages use query params (`/companies?company=amazon`) instead of clean routes

## Part 1: Company Route Restructuring

### Current State

```javascript
/companies                    → List all companies
/companies?company=amazon     → Shows Amazon's bands (same page, query param)
/photos?company=amazon        → Photos filtered by company
```

### Target State

```javascript
/companies                    → List all companies
/companies/[slug]             → Individual company page (NEW)
/companies/[slug]/photos      → Company photos (optional, or keep filter)
```

### Implementation

#### 1. Create new dynamic route

Create `src/app/companies/[slug]/page.tsx`:

- Move `SelectedCompanyView` logic from current companies page
- Add proper metadata with canonical URL
- Fetch company data and bands server-side

#### 2. Simplify companies list page

Update `src/app/companies/page.tsx`:

- Remove `?company=` query param handling
- Keep only the grid view of all companies
- Update `CompanyCard` links to use `/companies/[slug]`

#### 3. Update all company links

Files to update:

- `src/components/ui/company-badge.tsx` - Change href from `?company=` to `/companies/`
- `src/components/company-card.tsx` - Update link destination
- Any other components linking to companies

#### 4. Add redirects

In `next.config.ts`, add redirect:

```typescript
async redirects() {
  return [
    {
      source: '/companies',
      has: [{ type: 'query', key: 'company', value: '(?<slug>.+)' }],
      destination: '/companies/:slug',
      permanent: true,
    },
  ]
}
```

#### 5. Update sitemap

Update `src/app/sitemap.ts` to include `/companies/[slug]` pages.---

## Part 2: Internal Linking Improvements

### Problem

Photographer pages and company pages only have 1 incoming link (from their list pages). This hurts SEO discoverability.

### Solution: Add links in more places

#### Photographer Links

| Location | Implementation ||----------|----------------|| Photo cards | Add "Photo by [Name]" link below/on photos || Photo slideshow | Show photographer credit with link || Photo detail/modal | Link to photographer page || Event pages | "Photos by [Names]" section |

#### Company Links

| Location | Implementation ||----------|----------------|| Band cards | Show company badge that links to company page || Event pages | List participating companies with links || Results pages | Company badges on band entries || Photo captions | "Band from [Company]" links |

### Files to Update

**For photographer links:**

- `src/components/photos/photo-card.tsx` (if exists)
- `src/components/photos/photo-slideshow.tsx`
- `src/app/photos/photos-content.tsx`
- `src/app/event/[eventId]/page.tsx`

**For company links:**

- `src/components/event-card.tsx`
- `src/app/event/[eventId]/event-page-client.tsx`
- `src/app/results/[eventId]/page.tsx`
- `src/components/scoring/score-breakdown.tsx`

---

## Implementation Order

1. **Company routes first** - Bigger structural change, do in isolation
2. **Internal linking second** - Can be done incrementally across multiple components

## Estimated Effort
