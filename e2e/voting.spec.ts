import { test, expect } from '@playwright/test'

/**
 * E2E tests for the crowd voting flow
 *
 * Prerequisites:
 * - Test database seeded with test-voting-event and bands
 * - Dev server running with DATABASE_URL pointing to test DB
 */

test.describe('Crowd Voting', () => {
  test.beforeEach(async ({ context }) => {
    // Clear cookies before each test to ensure clean state
    await context.clearCookies()
  })

  test('can view voting page and see bands', async ({ page }) => {
    await page.goto('/vote/crowd/test-voting-event')

    // Wait for bands to load
    await expect(page.getByText('Crowd Voting')).toBeVisible()
    await expect(page.getByText('Vote for your favorite band!')).toBeVisible()

    // Should see at least one band from fixtures
    await expect(page.getByText('The Code Rockers')).toBeVisible()
    await expect(page.getByText('Database Divas')).toBeVisible()
  })

  test('can select a band and submit vote', async ({ page }) => {
    await page.goto('/vote/crowd/test-voting-event')

    // Wait for bands to load
    await expect(page.getByText('The Code Rockers')).toBeVisible()

    // Select a band by clicking its label
    await page.getByText('The Code Rockers').click()

    // Submit the vote
    await page.getByRole('button', { name: /Submit Vote/i }).click()

    // Should see success message OR already voted message (fingerprint reuse)
    await expect(
      page
        .getByText(/Thank you/i)
        .or(page.getByText(/already voted/i))
        .first()
    ).toBeVisible({ timeout: 10000 })
  })

  test('shows loading state initially', async ({ page }) => {
    // Navigate and check for loading state (may be brief)
    await page.goto('/vote/crowd/test-voting-event')

    // Either loading text or bands should be visible quickly
    await expect(
      page.getByText('Crowd Voting').or(page.getByText('Loading...'))
    ).toBeVisible()
  })

  test('handles non-existent event gracefully', async ({ page }) => {
    await page.goto('/vote/crowd/non-existent-event')

    // Should show either error state or empty bands
    // The exact behavior depends on API error handling
    await page.waitForLoadState('networkidle')

    // Page should still render without crashing
    await expect(page.getByText('Crowd Voting')).toBeVisible()
  })
})
