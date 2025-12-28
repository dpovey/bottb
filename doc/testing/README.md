# Testing Strategy

## Testing Stack

| Tool                  | Purpose             |
| --------------------- | ------------------- |
| Vitest                | Unit test runner    |
| React Testing Library | Component testing   |
| MSW                   | API mocking         |
| Storybook             | Component isolation |
| Chromatic             | Visual regression   |
| Playwright            | E2E testing         |

## Running Tests

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage
npm run storybook     # Component isolation
npm run chromatic     # Visual regression
npx playwright test   # E2E tests
```

## Test File Locations

| Type    | Location   | Naming          |
| ------- | ---------- | --------------- |
| Unit    | Co-located | `*.test.ts(x)`  |
| Stories | Co-located | `*.stories.tsx` |
| E2E     | `e2e/`     | `*.spec.ts`     |

## Test Guides

| Guide                                 | Description            |
| ------------------------------------- | ---------------------- |
| [Unit Testing](./unit-testing.md)     | Vitest + RTL patterns  |
| [API Testing](./api-testing.md)       | Route handler testing  |
| [Visual Testing](./visual-testing.md) | Storybook + Chromatic  |
| [Mocking](./mocking.md)               | MSW and test utilities |
| [E2E Testing](./e2e-testing.md)       | Playwright patterns    |

## Philosophy

- Test from user's perspective
- Use ARIA queries (getByRole, getByLabelText)
- Test behavior, not implementation
- No `data-testid` unless necessary

## Coverage Goals

| Metric     | Target |
| ---------- | ------ |
| Statements | 80%    |
| Branches   | 80%    |
| Functions  | 80%    |
| Lines      | 80%    |
