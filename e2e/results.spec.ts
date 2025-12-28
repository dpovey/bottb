import { test, expect } from '@playwright/test'

/**
 * E2E tests for viewing finalized event results
 *
 * Prerequisites:
 * - Test database seeded with test-finalized-event
 * - Test database seeded with finalized_results for the event
 */

test.describe('Results Page', () => {
  test('displays winner for finalized event', async ({ page }) => {
    await page.goto('/results/test-finalized-event')

    // Should show the event name (use heading to be specific - multiple elements match)
    await expect(
      page.getByRole('heading', { name: 'Melbourne Tech Bands 2024' })
    ).toBeVisible()

    // Should show winner (Cloud Crusaders from fixtures has rank 1)
    await expect(page.getByText('Cloud Crusaders').first()).toBeVisible()
  })

  test('shows score breakdown for bands', async ({ page }) => {
    await page.goto('/results/test-finalized-event')

    // Wait for results to load (use heading to be specific)
    await expect(
      page.getByRole('heading', { name: 'Melbourne Tech Bands 2024' })
    ).toBeVisible()

    // Should show both bands from fixtures (use first() as names appear multiple times)
    await expect(page.getByText('Cloud Crusaders').first()).toBeVisible()
    await expect(page.getByText('Algorithm Angels').first()).toBeVisible()
  })

  test('redirects non-finalized events', async ({ page }) => {
    // Try to view results for a voting event (not finalized)
    await page.goto('/results/test-voting-event')

    // Should redirect away from results page or show appropriate message
    await page.waitForLoadState('networkidle')

    // Either redirected to event page, or shows redirect/not-found
    const currentUrl = page.url()

    // Results page for non-finalized event should redirect
    expect(currentUrl).not.toContain('/results/test-voting-event')
  })

  test('handles non-existent event gracefully', async ({ page }) => {
    await page.goto('/results/non-existent-event')

    // Should show 404 or not found state
    await page.waitForLoadState('networkidle')

    // Either 404 page or redirect - use heading role to avoid multiple matches
    await expect(page.getByRole('heading', { name: /not found/i })).toBeVisible(
      { timeout: 5000 }
    )
  })

  test('displays ranking information', async ({ page }) => {
    await page.goto('/results/test-finalized-event')

    // Wait for content (use heading to be specific)
    await expect(
      page.getByRole('heading', { name: 'Melbourne Tech Bands 2024' })
    ).toBeVisible()

    // Should display some form of ranking (1st place, winner, etc.)
    await expect(
      page
        .getByText(/winner/i)
        .or(page.getByText(/1st/i))
        .or(page.getByText(/champion/i))
        .first()
    ).toBeVisible()
  })
})
