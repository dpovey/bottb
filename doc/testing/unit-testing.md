# Unit Testing

Vitest + React Testing Library patterns.

## Setup

- Config: `vitest.config.mts`
- Setup file: `vitest.setup.ts`
- Environment: jsdom
- Globals enabled

## Query Priority

1. `getByRole` - Most accessible (buttons, headings, links)
2. `getByLabelText` - Form fields
3. `getByText` - Non-interactive content
4. `getByTestId` - Last resort

## Query Variants

| Variant    | Returns        | Throws           |
| ---------- | -------------- | ---------------- |
| `getBy`    | Single element | Yes if not found |
| `queryBy`  | Single or null | No               |
| `findBy`   | Single (async) | Yes if not found |
| `getAllBy` | Array          | Yes if empty     |

## User Interactions

Use `userEvent.setup()`:

- `user.click()`, `user.dblClick()`
- `user.type()`, `user.clear()`
- `user.selectOptions()`
- `user.keyboard('{Enter}')`
- `user.tab()`, `user.hover()`

## Assertions

- `toBeInTheDocument()`, `toBeVisible()`
- `toBeDisabled()`, `toBeEnabled()`
- `toHaveTextContent()`, `toHaveClass()`
- `toHaveAttribute()`, `toHaveValue()`
- `toBeChecked()`, `toHaveFocus()`

## Async Testing

- `findBy*` - Wait for element
- `waitFor(() => expect(...))` - Wait for condition
- `waitForElementToBeRemoved()` - Wait for removal

## Mock Database

```typescript
vi.mock('@/lib/db', () => ({
  getEvents: vi.fn(),
  getEventById: vi.fn(),
}))
```

## Test Structure

```typescript
describe('Component', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('rendering', () => { ... })
  describe('interactions', () => { ... })
  describe('error states', () => { ... })
})
```
