# Component Architecture

Component-driven development with Storybook and Chromatic.

## Organization

```
src/components/
├── ui/           # Primitives (Button, Card, Badge, Modal)
├── icons/        # SVG icons (social/, ui/, admin/, misc/)
├── photos/       # PhotoGrid, PhotoSlideshow, PhotoCard
├── scoring/      # ScoreBreakdown, WinnerDisplay
├── layouts/      # WebLayout, AdminLayout, PublicLayout
├── nav/          # Header, Footer, Breadcrumbs
├── skeletons/    # Loading skeletons
└── seo/          # Structured data components
```

## UI Primitives

| Component         | Variants                                       |
| ----------------- | ---------------------------------------------- |
| Button            | outline, filled, accent, ghost, danger         |
| Card              | default, elevated, interactive                 |
| Badge             | default, accent, error, success, warning, info |
| DateBadge         | Tomorrowland-style date display                |
| Modal             | Dialog overlay                                 |
| NumberedIndicator | Position/rank (circle, square)                 |

## Icons

- Consistent API: `size` prop, className support
- All SVG props supported
- Categories: social, ui, admin, misc

## Compound Components

- **Photos**: PhotoGrid, PhotoSlideshow, PhotoFilters
- **Scoring**: ScoreBreakdown, WinnerDisplay, CategoryWinners
- **Layouts**: WebLayout, AdminLayout, PublicLayout

## Storybook Integration

All UI components have stories:

- Visual documentation
- Interactive testing
- Chromatic visual regression

```bash
pnpm storybook           # Development
pnpm chromatic           # Visual tests
```

## Design System Page

Interactive browser at `/design-system` showing all components.

## Patterns

- Server components by default
- `'use client'` only when needed
- Composition over configuration (children pattern)
- ForwardRef for components needing ref access
