# Design System Migration TODO

> Current state assessment and migration plan
> 
> **Design Inspiration**: [Tomorrowland](https://www.tomorrowland.com/) — Monochromatic, elegant, sophisticated

## Migration Status

**Last Updated**: December 2024

### ✅ Completed

| Task | Status | Notes |
|------|--------|-------|
| Tailwind config with design tokens | ✅ Done | Colors, fonts, spacing in `tailwind.config.js` |
| Jost font setup | ✅ Done | Replaced Rock Salt + Lato |
| Button component | ✅ Done | `src/components/ui/button.tsx` - outline, filled, accent, ghost, danger |
| Card component | ✅ Done | `src/components/ui/card.tsx` - default, elevated, interactive |
| Badge component | ✅ Done | `src/components/ui/badge.tsx` - semantic variants |
| DateBadge component | ✅ Done | `src/components/ui/date-badge.tsx` |
| Header component | ✅ Done | `src/components/nav/header.tsx` - reusable with nav, breadcrumbs |
| Footer component | ✅ Done | `src/components/nav/footer.tsx` - simple and full variants |
| Breadcrumbs component | ✅ Done | `src/components/nav/breadcrumbs.tsx` |
| Layout refactor | ✅ Done | WebLayout, AdminLayout, PublicLayout use shared Header/Footer |
| Home page | ✅ Done | Hero section, new design system |
| Event page | ✅ Done | Hero, breadcrumbs, new card styles |
| Results page | ✅ Done | Category winners, full table, band links |
| Test updates | ✅ Done | All tests passing |

### 🔄 In Progress / TODO

| Task | Priority | Notes |
|------|----------|-------|
| Band page | Medium | Needs design system update |
| Voting pages | Medium | Needs design system update |
| Photos page | Medium | Already partially done |
| Admin pages | Low | Can use basic styling for now |
| SEO metadata | Low | Add OG images, structured data |
| About page | Low | Create based on design examples |

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

| Role | Color | Hex | Usage |
|------|-------|-----|-------|
| **Accent** | Indigo | `#6366F1` | Selected states, primary CTAs, links, winner badges |
| **Error** | Apple Red | `#f10e34` | Error states, destructive actions |
| **Success** | Lime Green | `#31eb14` | Success states, confirmations |
| **Warning** | Vibrant Gold | `#F5A623` | Warning states, caution notices |
| **Info** | Blue | `#3B82F6` | Informational messages |

See `design-examples/` folder for HTML mockups and `design-examples/theme.css` for the CSS variables.

---

## Component Library

All components are in `src/components/`:

### UI Components (`src/components/ui/`)

- **Button** - Variants: outline (default), filled, accent, ghost, danger
- **Card** - Variants: default, elevated, interactive. Sub-components: CardHeader, CardTitle, CardDescription, CardContent, CardFooter
- **Badge** - Variants: default, accent, error, success, warning, info
- **DateBadge** - Tomorrowland-style date display (month on top, day below)

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

1. **Band page** (`src/app/band/[bandId]/page.tsx`)
   - Apply hero section similar to event page
   - Use Card components for score breakdown
   - Add breadcrumbs

2. **Crowd Voting page** (`src/app/vote/crowd/[eventId]/page.tsx`)
   - Apply monochromatic styling
   - Use Button components
   - Add proper badges for band selection

3. **Judge Voting page** (`src/app/vote/judge/[eventId]/page.tsx`)
   - Apply form styling
   - Use Card components for scoring sections

4. **Admin pages** (`src/app/admin/*`)
   - Can use basic styling, lower priority
   - Consider admin toolbar from design examples

### Hero Images

- **Home page**: Using placeholder Unsplash image
- **Event/Band pages**: Pick random from event photos (when available)
- **Future**: Add photo tagging system to mark hero-eligible images

---

## Design Examples

Review the HTML mockups in `design-examples/`:
- `design-system.html` — Typography, colors, all components
- `home.html` — Home page layout
- `event.html` — Event detail page  
- `voting.html` — Voting interface
- `band.html` — Band page layout
- `results.html` — Results page layout
- `photos.html` — Photo gallery
- `about.html` — About page
- `accent-colors.html` — Interactive color picker

Open directly in browser to review. These use Tailwind CDN for standalone viewing.

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
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui";

<Card variant="interactive">
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>Content</CardContent>
</Card>
```

### Layout Usage

```tsx
import { WebLayout } from "@/components/layouts";

<WebLayout 
  breadcrumbs={[
    { label: "Events", href: "/" },
    { label: "Event Name" }
  ]}
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
