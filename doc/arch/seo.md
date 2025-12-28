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
    title: `${data.name} | BOTTB`,
    description: data.description,
    openGraph: { ... },
    alternates: { canonical: `${baseUrl}/path/${params.id}` }
  }
}
```

### Base URL Resolution

`src/lib/seo.ts` provides `getBaseUrl()`:

1. `NEXT_PUBLIC_BASE_URL` (explicit)
2. `VERCEL_PROJECT_PRODUCTION_URL` (Vercel prod)
3. `VERCEL_URL` (Vercel preview)
4. `localhost:3000` (development)

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

## Key Files

| File                    | Purpose               |
| ----------------------- | --------------------- |
| `src/lib/seo.ts`        | Base URL utility      |
| `src/app/sitemap.ts`    | Sitemap generation    |
| `src/app/robots.ts`     | Robots.txt generation |
| `src/components/seo/`   | JSON-LD components    |
| `*/opengraph-image.tsx` | Dynamic OG images     |
