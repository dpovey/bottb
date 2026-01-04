---
paths: src/components/**/*.tsx
---

# Component Conventions

See `doc/arch/components.md` and `doc/practices/react.md` for full guidelines.

## Structure

- `src/components/ui/` - Shared primitives (Button, Card, etc.)
- `src/components/icons/` - Icon components
- `src/components/layouts/` - Layout components
- `src/components/photos/` - Photo-specific components
- `src/components/scoring/` - Scoring-specific components

## Patterns

- Use existing UI components from `src/components/ui/`
- Follow design system tokens from `DESIGN.md`
- Browse `/design-system` in the app or run `pnpm storybook`

## Styling

See `doc/practices/styling.md` for full guidelines.

- Use Tailwind CSS for styling
- Follow design system color tokens
- Use CSS variables for theme values
- Mobile-first responsive design

## Testing

- Co-locate tests: `Component.test.tsx`
- Use React Testing Library
- Test behavior, not implementation
- Use `userEvent` for interactions

