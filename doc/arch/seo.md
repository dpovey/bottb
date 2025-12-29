# SEO Architecture

Search engine optimization implementation across the application.

## Metadata System

### Static Metadata

For pages with fixed content, export `metadata` object:

```typescript
export const metadata: Metadata = {
  title: 'Page Title | Battle of the Tech Bands',
  description: 'Page description under 160 chars',
}
```

### Dynamic Metadata

For pages with dynamic content, use `generateMetadata`:

```typescript
export async function generateMetadata({ params }): Promise<Metadata> {
  const data = await fetchData(params.id)
  return {
    title: `${data.name} | Battle of the Tech Bands`,
    description: data.description,
    openGraph: { ... },
    alternates: { canonical: `${baseUrl}/path/${params.id}` }
  }
}
```

### Title Format

**Always use the full name** in page titles for SEO consistency:

```typescript
// ✅ Good
title: 'All Songs | Battle of the Tech Bands'
title: `${band.name} at ${event.name} | Battle of the Tech Bands`

// ❌ Bad - avoid abbreviations in titles
title: 'All Songs — BOTTB'
```

### Base URL Resolution

`src/lib/seo.ts` provides `getBaseUrl()`:

1. `NEXT_PUBLIC_BASE_URL` (explicit)
2. `VERCEL_PROJECT_PRODUCTION_URL` (Vercel prod)
3. `VERCEL_URL` (Vercel preview)
4. `localhost:3000` (development)

## H1 Tags for SEO

Every page needs exactly one H1 for SEO. For full-screen visual content (like slideshow), use a visually-hidden H1:

```tsx
// Slideshow page - visual content, but crawlers need an H1
return (
  <>
    <h1 className="sr-only">{`${band.name} at ${event.name}`}</h1>
    <SlideshowContent ... />
  </>
)
```

**Avoid multiple H1s** - Loading skeletons should use `<div>` not `<h1>`:

```tsx
// ❌ Bad - loading skeleton has H1 that duplicates actual content H1
function Loading() {
  return <h1>Photo Gallery</h1>
}

// ✅ Good - loading skeleton uses div
function Loading() {
  return <div className="font-semibold text-4xl">Photo Gallery</div>
}
```

## SSR for Crawlability

Client components that fetch data should receive initial data from the server so crawlers see content:

```tsx
// page.tsx (server)
export default async function Page() {
  const initialData = await fetchData()
  return <ClientComponent initialData={initialData} />
}

// client-component.tsx
export function ClientComponent({ initialData }) {
  const [data, setData] = useState(initialData) // SSR sees this
  // Client-side fetching for filters/pagination happens after hydration
}
```

## Structured Data (JSON-LD)

Components in `src/components/seo/`:

| Component            | Schema Type    | Used On                    |
| -------------------- | -------------- | -------------------------- |
| `EventJsonLd`        | MusicEvent     | Event pages                |
| `MusicGroupJsonLd`   | MusicGroup     | Band pages                 |
| `OrganizationJsonLd` | Organization   | About page                 |
| `FAQJsonLd`          | FAQPage        | FAQ page                   |
| `BreadcrumbsJsonLd`  | BreadcrumbList | All pages with breadcrumbs |
| `ImageObjectJsonLd`  | ImageObject    | Photo pages                |

Usage:

```tsx
<EventJsonLd event={event} bands={bands} heroImageUrl={heroUrl} />
```

## Dynamic OG Images

Generated at build/request time using `next/og` ImageResponse:

| Page            | File                  | Content                             |
| --------------- | --------------------- | ----------------------------------- |
| `/event/[id]`   | `opengraph-image.tsx` | Event name, date, bands, hero image |
| `/band/[id]`    | `opengraph-image.tsx` | Band name, company, event           |
| `/results/[id]` | `opengraph-image.tsx` | Winner, scores, trophy              |

Config: `runtime: 'edge'`, 1200×630px PNG

## Sitemap

`src/app/sitemap.ts` generates `/sitemap.xml`:

| Content                | Priority | Change Frequency |
| ---------------------- | -------- | ---------------- |
| Home                   | 1.0      | daily            |
| Events, Photos         | 0.9      | daily/weekly     |
| Event pages            | 0.9      | weekly           |
| Results pages          | 0.8      | monthly          |
| Band pages             | 0.7      | monthly          |
| Static (About, FAQ)    | 0.8      | monthly          |
| Legal (Privacy, Terms) | 0.3      | yearly           |

Dynamically includes:

- All events
- Results for finalized events
- All bands per event
- All photographers
- Hero-labeled photos

## Robots.txt

`src/app/robots.ts` generates `/robots.txt`:

```
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/
Disallow: /vote/
Sitemap: https://bottb.com/sitemap.xml
```

## URL Structure

| Pattern                | Example                              |
| ---------------------- | ------------------------------------ |
| `/event/[id]`          | `/event/sydney-2025`                 |
| `/band/[id]`           | `/band/uuid-here`                    |
| `/results/[id]`        | `/results/sydney-2025`               |
| `/photo/[id]`          | `/photo/uuid` (redirects to gallery) |
| `/photographer/[slug]` | `/photographer/john-doe`             |

## Canonical URLs

All dynamic pages include canonical URL:

```typescript
alternates: {
  canonical: `${baseUrl}/event/${eventId}`
}
```

## OpenGraph Tags

Standard tags on all pages:

- `og:title`, `og:description`, `og:url`
- `og:type`: website (pages), article (events)
- `og:image`: Dynamic or hero photo
- `og:site_name`: Battle of the Tech Bands

Twitter card: `summary_large_image`

## LLMs.txt

`public/llms.txt` provides site information for AI crawlers (similar to robots.txt for search engines). Contains:

- Site description and purpose
- URL structure and routes
- Key content types
- Contact information

## Key Files

| File                    | Purpose               |
| ----------------------- | --------------------- |
| `src/lib/seo.ts`        | Base URL utility      |
| `src/app/sitemap.ts`    | Sitemap generation    |
| `src/app/robots.ts`     | Robots.txt generation |
| `src/components/seo/`   | JSON-LD components    |
| `*/opengraph-image.tsx` | Dynamic OG images     |
| `public/llms.txt`       | AI crawler info       |
