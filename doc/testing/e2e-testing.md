# E2E Testing

Playwright for critical user flows.

## Running

```bash
npx playwright test           # Run all
npx playwright test --ui      # UI mode
npx playwright test --headed  # See browser
npx playwright test --debug   # Debug mode
npx playwright codegen        # Generate tests
```

## Configuration

`playwright.config.ts`:

- Test dir: `e2e/`
- Base URL: `http://localhost:3000`
- Auto-starts dev server

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

## Page Object Pattern

Encapsulate page logic in classes for reuse.

## Best Practices

- Each test should be independent
- Clear cookies/storage before tests
- Don't rely on test order
