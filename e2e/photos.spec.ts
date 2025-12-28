import { test, expect } from '@playwright/test'

/**
 * E2E tests for the photo gallery
 *
 * Prerequisites:
 * - Test database seeded with test photos
 * - Fixed test images in public/images/test/
 */

test.describe('Photo Gallery', () => {
  test('displays photo gallery page', async ({ page }) => {
    await page.goto('/photos')

    // Should show gallery heading (use role to be specific)
    await expect(
      page.getByRole('heading', { name: 'Photo Gallery' })
    ).toBeVisible()
  })

  test('shows photos in grid', async ({ page }) => {
    await page.goto('/photos')

    // Wait for photos to load
    await page.waitForLoadState('networkidle')

    // Should have some images visible (either from DB or placeholders)
    const images = await page.locator('img').count()
    expect(images).toBeGreaterThan(0)
  })

  test('can navigate to photo detail', async ({ page }) => {
    await page.goto('/photos')

    // Wait for photos to load
    await page.waitForLoadState('networkidle')

    // Find first clickable photo
    const photoLink = page.locator('a[href*="/photo/"]').first()

    // If photos exist, clicking should navigate to detail
    if ((await photoLink.count()) > 0) {
      await photoLink.click()
      await expect(page).toHaveURL(/\/photo\//)
    }
  })

  test('handles empty photo gallery gracefully', async ({ page }) => {
    // Even with no photos, gallery page should render
    await page.goto('/photos')

    // Page should load without errors (use role to be specific)
    await expect(
      page.getByRole('heading', { name: 'Photo Gallery' })
    ).toBeVisible()
  })

  test('shows filter options', async ({ page }) => {
    await page.goto('/photos')

    // Wait for page to load
    await page.waitForLoadState('networkidle')

    // Should have filter controls visible (events, photographers, etc.)
    // The exact filter labels depend on what's in the DB
    const filterSection = page
      .getByRole('button', { name: /filter/i })
      .or(page.getByText(/event/i).first())

    // Filter controls should be present
    await expect(filterSection).toBeVisible({ timeout: 5000 })
  })
})
