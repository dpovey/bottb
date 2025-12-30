# E2E Testing

Playwright for critical user flows with Docker Postgres.

## Setup

### Local Development

```bash
# Start test database
docker compose -f docker-compose.test.yml up -d

# Seed with fixtures and run tests
pnpm test:e2e
```

### CI/CD

E2E tests run automatically on:

- Push to `main`
- Pull requests

Uses GitHub Actions with Postgres service container.

## Running Tests

```bash
pnpm test:e2e           # Full suite (seed + test)
npx playwright test        # Run tests only (assumes DB ready)
npx playwright test --ui   # UI mode for debugging
npx playwright test --headed  # See browser
npx playwright test --debug   # Debug mode
npx playwright codegen     # Generate tests
```

## Database Setup

### Docker Compose

`docker-compose.test.yml` provides ephemeral Postgres 17:

- Port: 5433 (avoids conflicts with local Postgres)
- Database: `bottb_test`
- Credentials: `test:test`

### Fixtures

Test data in `e2e/fixtures/`:

| File               | Contents                    |
| ------------------ | --------------------------- |
| `data/events.json` | Test events                 |
| `data/bands.json`  | Test bands with company_ids |
| `data/votes.json`  | Sample votes                |
| `data/photos.json` | Test photo records          |
| `test-db.sql`      | Cached pg_dump for speed    |

### Smart Restore

`e2e/smart-restore.ts` optimizes test setup:

1. Checks if `test-db.sql` dump is valid and up-to-date
2. If fixtures are newer → regenerate dump
3. Otherwise → fast restore from cached dump

This makes subsequent test runs much faster.

## Configuration

`playwright.config.ts`:

- Test dir: `e2e/`
- Base URL: `http://localhost:3030`
- Auto-starts dev server
- Global setup: seeds database

## Test Structure

```typescript
test.describe('Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies()
  })

  test('does something', async ({ page }) => {
    await page.goto('/path')
    await page.getByRole('button').click()
    await expect(page.getByText(/success/)).toBeVisible()
  })
})
```

## Selectors

Prefer accessible selectors:

- `page.getByRole('button', { name: /submit/i })`
- `page.getByLabel(/email/i)`
- `page.getByText(/success/i)`

Avoid: `.btn-primary`, `#submit-button`

## Waiting

Playwright auto-waits on actions. For explicit waits:

- `page.waitForSelector()`
- `page.waitForLoadState('networkidle')`

Avoid `page.waitForTimeout()`

## Visual Comparison

```typescript
await expect(page).toHaveScreenshot('page.png')
```

## Best Practices

- Each test should be independent
- Clear cookies/storage before tests
- Don't rely on test order
- Use fixtures for consistent test data
- Test images in `public/images/test/` for deterministic visuals
