# Design System Migration TODO

> Current state assessment and migration plan
>
> **Design Inspiration**: [Tomorrowland](https://www.tomorrowland.com/) — Monochromatic, elegant, sophisticated

## Migration Status

**Last Updated**: December 2024

### ✅ Completed

| Task                               | Status  | Notes                                                                   |
| ---------------------------------- | ------- | ----------------------------------------------------------------------- |
| Tailwind config with design tokens | ✅ Done | Colors, fonts, spacing in `tailwind.config.js`                          |
| Jost font setup                    | ✅ Done | Replaced Rock Salt + Lato                                               |
| Button component                   | ✅ Done | `src/components/ui/button.tsx` - outline, filled, accent, ghost, danger |
| Card component                     | ✅ Done | `src/components/ui/card.tsx` - default, elevated, interactive           |
| Badge component                    | ✅ Done | `src/components/ui/badge.tsx` - semantic variants                       |
| DateBadge component                | ✅ Done | `src/components/ui/date-badge.tsx`                                      |
| BandThumbnail component            | ✅ Done | `src/components/ui/band-thumbnail.tsx` - logo/hero fallback             |
| CompanyBadge component             | ✅ Done | `src/components/ui/company-badge.tsx` - outline badge with icon         |
| CompanyIcon component              | ✅ Done | `src/components/ui/company-icon.tsx` - square icon display              |
| Header component                   | ✅ Done | `src/components/nav/header.tsx` - reusable with nav, breadcrumbs        |
| Footer component                   | ✅ Done | `src/components/nav/footer.tsx` - simple and full variants              |
| Breadcrumbs component              | ✅ Done | `src/components/nav/breadcrumbs.tsx`                                    |
| Layout refactor                    | ✅ Done | WebLayout, AdminLayout, PublicLayout use shared Header/Footer           |
| Home page                          | ✅ Done | Hero section, new design system                                         |
| Event page                         | ✅ Done | Hero, breadcrumbs, company badges on bands                              |
| Band page                          | ✅ Done | Hero, score breakdown, company badge                                    |
| Results page                       | ✅ Done | Category winners, full table with company badges, band links            |
| Voting pages                       | ✅ Done | Crowd and judge voting with design system                               |
| Photos page                        | ✅ Done | Gallery grid, slideshow, filters                                        |
| Photo slideshow                    | ✅ Done | Full-screen with keyboard nav, company badges                           |
| Companies page                     | ✅ Done | Company cards with logos/icons                                          |
| Company logos/icons                | ✅ Done | Blob storage, seeding scripts                                           |
| Test updates                       | ✅ Done | All tests passing                                                       |

### 🔄 In Progress / TODO

| Task         | Priority | Notes                           |
| ------------ | -------- | ------------------------------- |
| Admin pages  | Low      | Can use basic styling for now   |
| SEO metadata | Low      | Add OG images, structured data  |
| About page   | Low      | Create based on design examples |

---

## Design Direction Summary

Based on the actual Tomorrowland website:

- **90% monochromatic** — white/gray text on near-black backgrounds
- **Outline buttons** — not filled, subtle white borders
- **ALL CAPS + letter spacing** for navigation and buttons
- **Single geometric sans-serif** (Jost) — no serif fonts
- **Accent color (Indigo)** — used sparingly for selected states, winners, CTAs
- **Semantic colors** — used rarely, only for user feedback

### ✅ Finalized Color Decisions

| Role        | Color        | Hex       | Usage                                               |
| ----------- | ------------ | --------- | --------------------------------------------------- |
| **Accent**  | Vibrant Gold | `#F5A623` | Selected states, primary CTAs, links, winner badges |
| **Error**   | Apple Red    | `#f10e34` | Error states, destructive actions                   |
| **Success** | Lime Green   | `#31eb14` | Success states, confirmations                       |
| **Warning** | Vibrant Gold | `#F5A623` | Warning states, caution notices (same as accent)    |
| **Info**    | Blue         | `#3B82F6` | Informational messages                              |

See `design/` folder for HTML mockups and `design/theme.css` for the CSS variables.

---

## Component Library

All components are in `src/components/`:

### UI Components (`src/components/ui/`)

- **Button** - Variants: outline (default), filled, accent, ghost, danger
- **Card** - Variants: default, elevated, interactive. Sub-components: CardHeader, CardTitle, CardDescription, CardContent, CardFooter
- **Badge** - Variants: default, accent, error, success, warning, info
- **DateBadge** - Tomorrowland-style date display (month on top, day below)
- **BandThumbnail** - Band image with logo/hero/initials fallback
- **CompanyBadge** - Outline badge with company icon, variants: default, inline, pill
- **CompanyIcon** - Square company icon with fallback to building icon

### Navigation (`src/components/nav/`)

- **Header** - Configurable with nav, breadcrumbs, variants (transparent, glass, solid)
- **Footer** - Variants: simple (copyright + social), full (with sitemap)
- **Breadcrumbs** - Chevron separators, link styling

### Layouts (`src/components/layouts/`)

- **WebLayout** - For content pages (header, footer, optional breadcrumbs)
- **AdminLayout** - For admin pages (header with Admin breadcrumb prefix)
- **PublicLayout** - For home/landing pages (transparent header, full footer)

---

## Remaining Work

### Pages to Update

1. **Admin pages** (`src/app/admin/*`)
   - Can use basic styling, lower priority
   - Consider admin toolbar from design examples

2. **About page** (`src/app/about/page.tsx`)
   - Create based on design examples

### Hero Images

- **Home page**: Using placeholder Unsplash image
- **Event/Band pages**: Uses `event_hero` and `band_hero` labeled photos
- Photo labels system implemented for hero image selection

---

## Design Examples

Review the HTML mockups in `design/`:

- `design-system.html` — Typography, colors, all components
- `theme.css` — Shared CSS variables and component styles (company-badge, etc.)
- `home.html` — Home page layout
- `event.html` — Event detail page with company badges
- `voting.html` — Voting interface
- `band.html` — Band page layout with company badge
- `results.html` — Results page (2025.1 scoring) with company badges
- `results-2022.html` — Results page (legacy winner-only)
- `results-2025.html` — Results page (with scream-o-meter)
- `results-2026.html` — Results page (with visuals category)
- `photos.html` — Photo gallery
- `photos-slideshow.html` — Full-screen photo slideshow
- `about.html` — About page
- `login.html` — Authentication page
- `404.html` — Not found page
- `admin.html` — Admin interface with floating toolbar
- `accent-colors.html` — Interactive color picker
- `header-dropdown.html` — Header with dropdown menu

Open directly in browser to review. These use Tailwind CDN and shared `theme.css` for standalone viewing.

---

## Quick Reference

### Button Usage

```tsx
import { Button } from "@/components/ui";

<Button variant="outline">Default</Button>
<Button variant="filled">Emphasis</Button>
<Button variant="accent">Primary CTA</Button>
<Button variant="ghost">Text only</Button>
<Button variant="danger">Delete</Button>
```

### Card Usage

```tsx
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui'
;<Card variant="interactive">
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>Content</CardContent>
</Card>
```

### Layout Usage

```tsx
import { WebLayout } from '@/components/layouts'
;<WebLayout
  breadcrumbs={[{ label: 'Events', href: '/' }, { label: 'Event Name' }]}
  footerVariant="simple"
>
  {children}
</WebLayout>
```

---

## Notes

- The key insight from Tomorrowland: **less color is more**
- Keep UI mostly white/gray on black — color is the exception
- Outline buttons feel more elegant than filled
- ALL CAPS with letter-spacing gives sophisticated feel
- Test all changes on mobile — voting happens on phones at events
