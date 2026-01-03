import { test, expect, Page } from '@playwright/test'

/**
 * E2E tests for slideshow responsiveness across different viewports
 *
 * Tests cover:
 * - Desktop viewport with portrait/landscape photos
 * - Mobile portrait viewport
 * - Mobile landscape viewport
 * - Viewport resize scenarios (the main issue: resize not working correctly)
 * - Browser-specific differences (Chrome vs Firefox)
 *
 * Issues being tested (from user reports):
 * 1. Photos chopped in half on desktop (portrait photos)
 * 2. Resize broken on mobile (goes to half size)
 * 3. Black space on mobile (too much padding)
 * 4. Zoomed in when rotated (incorrect scaling after orientation change)
 * 5. Chrome vs Firefox rendering differences
 */

// Common viewport sizes for testing
const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  desktopWide: { width: 1920, height: 1080 },
  tabletPortrait: { width: 768, height: 1024 },
  tabletLandscape: { width: 1024, height: 768 },
  mobilePortrait: { width: 390, height: 844 }, // iPhone 14 Pro
  mobileLandscape: { width: 844, height: 390 }, // iPhone 14 Pro rotated
  mobileSmallPortrait: { width: 375, height: 667 }, // iPhone SE
  mobileSmallLandscape: { width: 667, height: 375 }, // iPhone SE rotated
}

/**
 * Helper to get the slideshow image dimensions and check for issues
 */
async function getSlideshowImageMetrics(page: Page) {
  // Wait for the slideshow to be visible
  await page.waitForSelector('.slideshow-main', { timeout: 10000 })

  // Get viewport dimensions
  const viewport = page.viewportSize()
  if (!viewport) throw new Error('No viewport size')

  // Get the slideshow main container dimensions
  const mainContainer = page.locator('.slideshow-main')
  const containerBox = await mainContainer.boundingBox()
  if (!containerBox) throw new Error('No slideshow-main container found')

  // Get the image element inside the ACTIVE slide (Swiper marks it with swiper-slide-active)
  const slideImage = page.locator('.swiper-slide-active img').first()
  await slideImage.waitFor({ state: 'visible', timeout: 10000 })

  // Give the image a moment to render at final size
  await page.waitForTimeout(500)

  const imageBox = await slideImage.boundingBox()
  if (!imageBox) throw new Error('No slideshow image found in active slide')

  // Get computed styles on the image
  const imageStyles = await slideImage.evaluate((el) => {
    const computed = window.getComputedStyle(el)
    return {
      objectFit: computed.objectFit,
      maxWidth: computed.maxWidth,
      maxHeight: computed.maxHeight,
      width: computed.width,
      height: computed.height,
    }
  })

  // Get the Swiper container dimensions
  const swiperContainer = page.locator('.swiper').first()
  const swiperBox = await swiperContainer.boundingBox()

  // Check for horizontal overflow
  const htmlScrollWidth = await page.evaluate(
    () => document.documentElement.scrollWidth
  )
  const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth)
  const hasHorizontalOverflow =
    htmlScrollWidth > viewport.width || bodyScrollWidth > viewport.width

  return {
    viewport,
    containerBox,
    imageBox,
    swiperBox,
    imageStyles,
    hasHorizontalOverflow,
    htmlScrollWidth,
    bodyScrollWidth,
  }
}

/**
 * Helper to check that the image fits properly within its container
 */
function assertImageFitsContainer(
  metrics: Awaited<ReturnType<typeof getSlideshowImageMetrics>>
) {
  const { viewport, imageBox, swiperBox, hasHorizontalOverflow } = metrics

  // Image should not exceed viewport width
  expect(
    imageBox.width,
    'Image width should not exceed viewport width'
  ).toBeLessThanOrEqual(viewport.width)

  // Image should not exceed viewport height (allowing for topbar ~4rem)
  const maxImageHeight = viewport.height - 64 // ~4rem topbar
  expect(
    imageBox.height,
    'Image height should not exceed available viewport height'
  ).toBeLessThanOrEqual(maxImageHeight + 10) // 10px tolerance

  // Image should not overflow its Swiper container
  if (swiperBox) {
    expect(
      imageBox.width,
      'Image should fit within Swiper container width'
    ).toBeLessThanOrEqual(
      swiperBox.width + 2 // 2px tolerance for rounding
    )
    expect(
      imageBox.height,
      'Image should fit within Swiper container height'
    ).toBeLessThanOrEqual(
      swiperBox.height + 2 // 2px tolerance for rounding
    )
  }

  // No horizontal overflow - this was a reported issue
  expect(
    hasHorizontalOverflow,
    'Page should not have horizontal overflow'
  ).toBe(false)

  return true
}

test.describe('Slideshow Responsive Behavior', () => {
  // Navigate to slideshow before each test
  test.beforeEach(async ({ page }) => {
    // Navigate directly to slideshow with a test photo ID
    // Test photos are seeded with known IDs (11111111-1111-1111-1111-111111111111, etc.)
    await page.goto('/slideshow/11111111-1111-1111-1111-111111111111', {
      waitUntil: 'networkidle',
    })

    // Wait for slideshow to fully load - with retry logic for resilience
    // The slideshow shows "Loading photo..." before .slideshow-main appears
    const maxRetries = 3
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // First check if we're stuck on "Loading photo..." state
        const loadingText = page.locator('text=Loading photo...')
        const isLoading = await loadingText.isVisible().catch(() => false)

        if (isLoading && attempt < maxRetries) {
          // Reload the page to retry loading
          await page.reload({ waitUntil: 'networkidle' })
        }

        // Wait for slideshow to be ready
        await page.waitForSelector('.slideshow-main', { timeout: 15000 })
        break // Success!
      } catch (error) {
        if (attempt === maxRetries) {
          throw error
        }
        // On failure, reload and try again
        await page.reload({ waitUntil: 'networkidle' })
      }
    }
  })

  test.describe('Desktop Viewports', () => {
    test('slideshow displays correctly at desktop resolution', async ({
      page,
    }) => {
      await page.setViewportSize(VIEWPORTS.desktop)
      await page.waitForTimeout(500) // Allow layout to settle

      const metrics = await getSlideshowImageMetrics(page)
      assertImageFitsContainer(metrics)

      // Take a screenshot for visual verification
      await page.screenshot({
        path: 'test-results/slideshow-desktop.png',
        fullPage: false,
      })
    })

    test('slideshow displays correctly at wide desktop resolution', async ({
      page,
    }) => {
      await page.setViewportSize(VIEWPORTS.desktopWide)
      await page.waitForTimeout(500)

      const metrics = await getSlideshowImageMetrics(page)
      assertImageFitsContainer(metrics)
    })
  })

  test.describe('Tablet Viewports', () => {
    test('slideshow displays correctly in tablet portrait', async ({
      page,
    }) => {
      await page.setViewportSize(VIEWPORTS.tabletPortrait)
      await page.waitForTimeout(500)

      const metrics = await getSlideshowImageMetrics(page)
      assertImageFitsContainer(metrics)

      // Take a screenshot for visual verification
      await page.screenshot({
        path: 'test-results/slideshow-tablet-portrait.png',
        fullPage: false,
      })
    })

    test('slideshow displays correctly in tablet landscape', async ({
      page,
    }) => {
      await page.setViewportSize(VIEWPORTS.tabletLandscape)
      await page.waitForTimeout(500)

      const metrics = await getSlideshowImageMetrics(page)
      assertImageFitsContainer(metrics)
    })
  })

  test.describe('Mobile Viewports', () => {
    test('slideshow displays correctly in mobile portrait', async ({
      page,
    }) => {
      await page.setViewportSize(VIEWPORTS.mobilePortrait)
      await page.waitForTimeout(500)

      const metrics = await getSlideshowImageMetrics(page)

      assertImageFitsContainer(metrics)

      // Specific check: image should use most of the available width on mobile
      // Allow for some padding but not excessive black space
      const widthUsagePercent =
        (metrics.imageBox.width / metrics.viewport.width) * 100
      expect(
        widthUsagePercent,
        'Image should use at least 80% of viewport width on mobile portrait (no excessive black space)'
      ).toBeGreaterThan(80)

      await page.screenshot({
        path: 'test-results/slideshow-mobile-portrait.png',
        fullPage: false,
      })
    })

    test('slideshow displays correctly in mobile landscape', async ({
      page,
    }) => {
      await page.setViewportSize(VIEWPORTS.mobileLandscape)
      await page.waitForTimeout(500)

      const metrics = await getSlideshowImageMetrics(page)
      assertImageFitsContainer(metrics)

      // In landscape, height is constrained - image should use available height
      // Check that image height is reasonable (at least 60% of viewport height)
      const heightUsagePercent =
        (metrics.imageBox.height / metrics.viewport.height) * 100
      expect(
        heightUsagePercent,
        'Image should use significant viewport height in mobile landscape'
      ).toBeGreaterThan(60)

      await page.screenshot({
        path: 'test-results/slideshow-mobile-landscape.png',
        fullPage: false,
      })
    })

    test('slideshow displays correctly on small mobile portrait', async ({
      page,
    }) => {
      await page.setViewportSize(VIEWPORTS.mobileSmallPortrait)
      await page.waitForTimeout(500)

      const metrics = await getSlideshowImageMetrics(page)
      assertImageFitsContainer(metrics)
    })

    test('slideshow displays correctly on small mobile landscape', async ({
      page,
    }) => {
      await page.setViewportSize(VIEWPORTS.mobileSmallLandscape)
      await page.waitForTimeout(500)

      const metrics = await getSlideshowImageMetrics(page)
      assertImageFitsContainer(metrics)
    })
  })

  test.describe('Viewport Resize Scenarios (Main Issue Area)', () => {
    test('resizing from desktop to mobile portrait maintains layout', async ({
      page,
    }) => {
      // Start at desktop
      await page.setViewportSize(VIEWPORTS.desktop)
      await page.waitForTimeout(500)

      const desktopMetrics = await getSlideshowImageMetrics(page)
      assertImageFitsContainer(desktopMetrics)

      // Resize to mobile portrait
      await page.setViewportSize(VIEWPORTS.mobilePortrait)
      await page.waitForTimeout(1000) // Extra time for resize handling

      const mobileMetrics = await getSlideshowImageMetrics(page)
      assertImageFitsContainer(mobileMetrics)

      // Take screenshot after resize
      await page.screenshot({
        path: 'test-results/slideshow-resize-desktop-to-mobile.png',
        fullPage: false,
      })
    })

    test('resizing from mobile portrait to landscape maintains layout', async ({
      page,
    }) => {
      // Start at mobile portrait
      await page.setViewportSize(VIEWPORTS.mobilePortrait)
      await page.waitForTimeout(500)

      const portraitMetrics = await getSlideshowImageMetrics(page)
      assertImageFitsContainer(portraitMetrics)

      // Simulate rotation to landscape
      await page.setViewportSize(VIEWPORTS.mobileLandscape)
      await page.waitForTimeout(1000) // Extra time for resize/rotation handling

      const landscapeMetrics = await getSlideshowImageMetrics(page)
      assertImageFitsContainer(landscapeMetrics)

      // Image should not be "zoomed in" or cropped after rotation
      // It should fit entirely within the viewport
      expect(
        landscapeMetrics.imageBox.width,
        'Image should fit within viewport width after rotation'
      ).toBeLessThanOrEqual(landscapeMetrics.viewport.width)
      expect(
        landscapeMetrics.imageBox.height,
        'Image should fit within viewport height after rotation'
      ).toBeLessThanOrEqual(landscapeMetrics.viewport.height)

      await page.screenshot({
        path: 'test-results/slideshow-resize-portrait-to-landscape.png',
        fullPage: false,
      })
    })

    test('resizing from mobile landscape back to portrait maintains layout', async ({
      page,
    }) => {
      // Start at mobile landscape
      await page.setViewportSize(VIEWPORTS.mobileLandscape)
      await page.waitForTimeout(500)

      const landscapeMetrics = await getSlideshowImageMetrics(page)
      assertImageFitsContainer(landscapeMetrics)

      // Simulate rotation back to portrait
      await page.setViewportSize(VIEWPORTS.mobilePortrait)
      await page.waitForTimeout(1000)

      const portraitMetrics = await getSlideshowImageMetrics(page)
      assertImageFitsContainer(portraitMetrics)

      await page.screenshot({
        path: 'test-results/slideshow-resize-landscape-to-portrait.png',
        fullPage: false,
      })
    })

    test('multiple resize cycles maintain correct layout', async ({ page }) => {
      // This tests for issues where resizing accumulates errors
      const viewportSequence = [
        VIEWPORTS.desktop,
        VIEWPORTS.mobilePortrait,
        VIEWPORTS.mobileLandscape,
        VIEWPORTS.mobilePortrait,
        VIEWPORTS.tabletPortrait,
        VIEWPORTS.desktop,
      ]

      for (const viewport of viewportSequence) {
        await page.setViewportSize(viewport)
        await page.waitForTimeout(500)

        const metrics = await getSlideshowImageMetrics(page)
        assertImageFitsContainer(metrics)
      }
    })

    test('rapid resize does not break layout', async ({ page }) => {
      // Simulate rapid viewport changes (like drag-resizing browser)
      const startViewport = VIEWPORTS.desktop
      const endViewport = VIEWPORTS.mobilePortrait

      await page.setViewportSize(startViewport)
      await page.waitForTimeout(300)

      // Interpolate between viewports
      const steps = 5
      for (let i = 1; i <= steps; i++) {
        const progress = i / steps
        const width = Math.round(
          startViewport.width +
            (endViewport.width - startViewport.width) * progress
        )
        const height = Math.round(
          startViewport.height +
            (endViewport.height - startViewport.height) * progress
        )
        await page.setViewportSize({ width, height })
        await page.waitForTimeout(100) // Rapid changes
      }

      // Final settle time
      await page.waitForTimeout(500)

      // Layout should be correct at the end
      const finalMetrics = await getSlideshowImageMetrics(page)
      assertImageFitsContainer(finalMetrics)
    })
  })

  test.describe('Image Aspect Ratio Handling', () => {
    test('portrait image displays correctly in landscape viewport', async ({
      page,
    }) => {
      // This tests the reported issue of portrait photos being "chopped in half"
      await page.setViewportSize(VIEWPORTS.desktop) // Wide landscape viewport
      await page.waitForTimeout(500)

      const metrics = await getSlideshowImageMetrics(page)

      // Image should maintain aspect ratio with object-contain
      expect(
        metrics.imageStyles.objectFit,
        'Image should use object-contain'
      ).toBe('contain')

      // Image should be fully visible (not cropped)
      assertImageFitsContainer(metrics)
    })

    test('landscape image displays correctly in portrait viewport', async ({
      page,
    }) => {
      await page.setViewportSize(VIEWPORTS.mobilePortrait) // Tall portrait viewport
      await page.waitForTimeout(500)

      const metrics = await getSlideshowImageMetrics(page)

      // Image should maintain aspect ratio
      expect(
        metrics.imageStyles.objectFit,
        'Image should use object-contain'
      ).toBe('contain')

      // Image should fit without overflow
      assertImageFitsContainer(metrics)
    })
  })

  test.describe('No Horizontal Overflow', () => {
    test('no horizontal scroll in any viewport size', async ({ page }) => {
      for (const [name, viewport] of Object.entries(VIEWPORTS)) {
        await page.setViewportSize(viewport)
        await page.waitForTimeout(300)

        const metrics = await getSlideshowImageMetrics(page)
        expect(
          metrics.hasHorizontalOverflow,
          `No horizontal overflow expected in ${name} viewport`
        ).toBe(false)
        expect(
          metrics.htmlScrollWidth,
          `HTML scrollWidth should match viewport in ${name}`
        ).toBeLessThanOrEqual(viewport.width + 1) // 1px tolerance
      }
    })
  })
})

// Browser-specific tests to catch Chrome vs Firefox differences
test.describe('Browser-Specific Behavior', () => {
  test('slideshow responsive behavior is consistent', async ({
    page,
    browserName,
  }) => {
    // Navigate directly to slideshow with a test photo ID
    await page.goto('/slideshow/11111111-1111-1111-1111-111111111111', {
      waitUntil: 'networkidle',
    })

    // Wait for slideshow to be ready
    await page.waitForSelector('.slideshow-main', { timeout: 10000 })

    // Test all viewport sizes and record metrics
    const results: Record<
      string,
      ReturnType<typeof assertImageFitsContainer>
    > = {}

    for (const [name, viewport] of Object.entries(VIEWPORTS)) {
      await page.setViewportSize(viewport)
      await page.waitForTimeout(500)

      try {
        const metrics = await getSlideshowImageMetrics(page)
        results[name] = assertImageFitsContainer(metrics)
      } catch (error) {
        console.error(`${browserName} failed at ${name} viewport:`, error)
        throw error
      }
    }

    // Take a screenshot with browser name for comparison
    await page.setViewportSize(VIEWPORTS.mobilePortrait)
    await page.waitForTimeout(500)
    await page.screenshot({
      path: `test-results/slideshow-${browserName}-mobile-portrait.png`,
      fullPage: false,
    })
  })
})
