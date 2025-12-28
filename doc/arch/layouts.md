# Layout Architecture

Three primary layout patterns for different contexts.

## Layouts

| Layout         | Usage           | Features                            |
| -------------- | --------------- | ----------------------------------- |
| `WebLayout`    | Content pages   | Header (glass), breadcrumbs, footer |
| `AdminLayout`  | Admin dashboard | Sidebar, topbar                     |
| `PublicLayout` | Home/landing    | Transparent header, full footer     |

## WebLayout

- Fixed header with backdrop blur
- Optional breadcrumbs
- Simple or full footer variant
- Content: `max-w-7xl mx-auto px-6`

## AdminLayout

- Sidebar navigation (Dashboard, Events, Videos, Social)
- Topbar with page title and user info
- Main content area with padding

## PublicLayout

- Transparent header (becomes glass on scroll)
- Full-bleed hero support
- Full footer with sitemap

## Header Variants

- `transparent`: Home page hero
- `glass`: Scrolled/content pages (`bg-bg/80 backdrop-blur`)
- `solid`: Admin pages

## Footer Variants

- `simple`: Copyright + social icons
- `full`: Multi-column sitemap

## Breakpoints

| Name | Width  | Usage         |
| ---- | ------ | ------------- |
| `sm` | 640px  | Small tablets |
| `md` | 768px  | Tablets       |
| `lg` | 1024px | Desktop       |
| `xl` | 1280px | Large desktop |

## Content Widths

- Standard: `max-w-7xl`
- Narrow (forms): `max-w-4xl`
- Modal: `max-w-2xl`
