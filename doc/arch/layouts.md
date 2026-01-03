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

- Sidebar navigation with hierarchical sections
- Topbar with page title and user info
- Main content area with padding

### Admin Sidebar Structure

The admin sidebar organizes navigation into logical sections. Configuration is in `src/components/layouts/admin-sidebar.tsx`.

**Current sections:**

| Section   | Items                            | Collapsible |
| --------- | -------------------------------- | ----------- |
| (top)     | Dashboard                        | No          |
| Events    | Events                           | No          |
| Photos    | Photos, Grouping, People, Heroes | Yes         |
| Content   | Videos                           | No          |
| Directory | Companies, Photographers         | No          |
| Settings  | Social Accounts                  | No          |

**Section types:**

1. **Header-less section**: Items displayed at top level (Dashboard)
2. **Labeled section**: Section header shown above items
3. **Collapsible section**: Can expand/collapse; auto-expands when any child route is active

### Adding New Admin Pages

To add a new page to the sidebar:

1. Create the admin page under `src/app/admin/`
2. Add an entry to the appropriate section in `navSections` array:

```tsx
{
  label: 'My Page',
  href: '/admin/my-page',
  icon: <MyIcon className="w-5 h-5" />,
  matchPath: ['/admin/my-page'],
}
```

3. If adding to a collapsible section, items appear nested with smaller text
4. Use `matchPath` to control when the item shows as active (supports prefix matching for child routes)

### Collapsible Section Behavior

- Sections with `collapsible: true` show a chevron indicator
- Auto-expands when navigating to any child route
- Remembers user's manual expand/collapse preference
- Items in collapsible sections are indented and use smaller text

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
