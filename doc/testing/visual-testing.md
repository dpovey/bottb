# Visual Testing

Storybook + Chromatic for component isolation and visual regression.

## Running

```bash
pnpm storybook        # Development server
pnpm build-storybook  # Build static
pnpm chromatic        # Visual regression tests
```

## Writing Stories

```typescript
const meta: Meta<typeof Component> = {
  title: 'Category/Component',
  component: Component,
  tags: ['autodocs'],
  argTypes: { ... }
}

export const Default: Story = {
  args: { ... }
}
```

## Story Categories

| Category   | Components                    |
| ---------- | ----------------------------- |
| UI         | Button, Card, Badge, Modal    |
| Forms      | Input, Select                 |
| Navigation | Header, Breadcrumbs           |
| Display    | DateBadge, NumberedIndicator  |
| Scoring    | ScoreBreakdown, WinnerDisplay |

## Chromatic Integration

- Runs on PR automatically
- Visual diffs generated
- Review and approve/reject changes
- TurboSnap: only tests changed stories

Skip with commit message: `[skip chromatic]`

## Accessibility

- `@storybook/addon-a11y` runs axe-core
- Violations shown in panel

## Best Practices

- One story per variant/state
- Include edge cases (empty, loading, error)
- Stories should work in isolation
- Mock external dependencies
