# Styling Practices

## Approach

- Tailwind CSS utilities only (avoid custom CSS classes)
- `cn()` utility for conditional class merging
- Mobile-first responsive design
- Dark mode only (no light mode support)

## Design System

- **90% monochromatic**: White/gray text on black backgrounds
- **8% accent**: Gold (#F5A623) for selected states, CTAs, winners
- **2% semantic**: Error red, success green, info blue

## Colors

- `bg`, `bg-elevated`, `bg-muted` for backgrounds
- `text-white`, `text-text-muted` for text
- `accent` for highlights and selection
- `error`, `success`, `warning`, `info` for status

## Typography

- Font: Jost (sans-serif)
- Headlines: `font-semibold`, normal case
- Nav/buttons: `uppercase tracking-widest text-sm`
- Body: normal case, `text-text-muted` for secondary

## Spacing

- Section padding: `py-16 sm:py-20`
- Card padding: `p-5 sm:p-6`
- Container: `max-w-7xl mx-auto px-6`

## Responsive Breakpoints

- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px

## Component Variants

- Buttons: outline (default), filled, accent, ghost, danger
- Cards: default, elevated, interactive
- Badges: default, accent, error, success

## Animations

- Use `transition-all duration-300` for general transitions
- Hover effects: border emphasis, background overlay, scale
- Respect `prefers-reduced-motion`

## Accessibility

- Touch targets: minimum 44x44px
- Focus states: `focus-visible:ring-2`
- Color contrast: 4.5:1 minimum for text
