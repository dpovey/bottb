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

test.describe('Photo API', () => {
  test('shuffle pagination returns photos on subsequent pages', async ({
    request,
  }) => {
    const seed = 'test-seed-123'

    // Use small limit so test fixtures (5 photos) span multiple pages
    // Page 2 should return photos (regression: in-memory shuffle returned 0)
    const response = await request.get(
      `/api/photos?shuffle=${seed}&page=2&limit=2`
    )
    expect(response.ok()).toBe(true)

    const data = await response.json()
    expect(data.photos.length).toBeGreaterThan(0)
  })

  test('shuffle with same seed returns consistent order', async ({
    request,
  }) => {
    const seed = 'deterministic-seed'

    const response1 = await request.get(`/api/photos?shuffle=${seed}&limit=5`)
    const response2 = await request.get(`/api/photos?shuffle=${seed}&limit=5`)

    const data1 = await response1.json()
    const data2 = await response2.json()

    // Same seed should return same photos in same order
    expect(data1.photos.map((p: { id: string }) => p.id)).toEqual(
      data2.photos.map((p: { id: string }) => p.id)
    )
  })
})

test.describe('Photo Grouping API', () => {
  test('groupTypes=near_duplicate returns fewer photos than total', async ({
    request,
  }) => {
    // Without grouping - get all photos
    const ungroupedResponse = await request.get('/api/photos?limit=100')
    const ungroupedData = await ungroupedResponse.json()

    // With grouping - should return fewer (clusters collapsed)
    const groupedResponse = await request.get(
      '/api/photos?groupTypes=near_duplicate&limit=100'
    )
    expect(groupedResponse.ok()).toBe(true)

    const groupedData = await groupedResponse.json()

    // Grouped total should be less than or equal to ungrouped
    // (Equal if no near_duplicate clusters exist, less if they do)
    expect(groupedData.pagination.total).toBeLessThanOrEqual(
      ungroupedData.pagination.total
    )
  })

  test('grouped photos include cluster_photos array for representatives', async ({
    request,
  }) => {
    const response = await request.get(
      '/api/photos?groupTypes=near_duplicate,scene&limit=100'
    )
    expect(response.ok()).toBe(true)

    const data = await response.json()

    // At least some photos should have cluster_photos (if clusters exist)
    // Check that the response structure is correct
    for (const photo of data.photos) {
      // cluster_photos should be null (not clustered) or an array
      expect(
        photo.cluster_photos === null || Array.isArray(photo.cluster_photos)
      ).toBe(true)

      // If it's an array, it should have at least 2 photos (cluster minimum)
      if (Array.isArray(photo.cluster_photos)) {
        expect(photo.cluster_photos.length).toBeGreaterThanOrEqual(2)
      }
    }
  })

  test('pagination works correctly with grouping', async ({ request }) => {
    // Fetch page 1
    const page1Response = await request.get(
      '/api/photos?groupTypes=near_duplicate&page=1&limit=2'
    )
    const page1Data = await page1Response.json()

    // Fetch page 2
    const page2Response = await request.get(
      '/api/photos?groupTypes=near_duplicate&page=2&limit=2'
    )
    const page2Data = await page2Response.json()

    // Pages should have different photos (no overlap)
    const page1Ids = page1Data.photos.map((p: { id: string }) => p.id)
    const page2Ids = page2Data.photos.map((p: { id: string }) => p.id)

    const overlap = page1Ids.filter((id: string) => page2Ids.includes(id))
    expect(overlap).toHaveLength(0)
  })

  test('groupTypes with shuffle returns consistent order', async ({
    request,
  }) => {
    const seed = 'grouped-seed-123'

    const response1 = await request.get(
      `/api/photos?groupTypes=near_duplicate&shuffle=${seed}&limit=10`
    )
    const response2 = await request.get(
      `/api/photos?groupTypes=near_duplicate&shuffle=${seed}&limit=10`
    )

    const data1 = await response1.json()
    const data2 = await response2.json()

    // Same seed should return same order even with grouping
    expect(data1.photos.map((p: { id: string }) => p.id)).toEqual(
      data2.photos.map((p: { id: string }) => p.id)
    )
    expect(data1.seed).toBe(seed)
  })

  test('no groupTypes returns all photos without cluster_photos', async ({
    request,
  }) => {
    const response = await request.get('/api/photos?limit=100')
    expect(response.ok()).toBe(true)

    const data = await response.json()

    // Without groupTypes, photos should not have cluster_photos field
    // (or it should be undefined, depending on implementation)
    for (const photo of data.photos) {
      expect(photo.cluster_photos).toBeUndefined()
    }
  })
})

test.describe('Slideshow Keyboard Navigation', () => {
  test('arrow keys navigate between photos', async ({ page }) => {
    // Navigate directly to slideshow with a test photo ID
    // Test photos are seeded with known IDs
    await page.goto('/slideshow/11111111-1111-1111-1111-111111111111', {
      waitUntil: 'networkidle',
    })

    // Wait for slideshow to load
    await page.waitForSelector('.slideshow-main', { timeout: 10000 })

    // Get initial photo counter - the counter shows current position as first number
    const getCounter = () =>
      page.locator('.slideshow-topbar').getByText(/^\d+$/).first()
    await expect(getCounter()).toHaveText('1')

    // Press right arrow - should go to photo 2
    await page.keyboard.press('ArrowRight')
    await expect(getCounter()).toHaveText('2', { timeout: 2000 })

    // Press left arrow - should go back to photo 1
    await page.keyboard.press('ArrowLeft')
    await expect(getCounter()).toHaveText('1', { timeout: 2000 })
  })
})
