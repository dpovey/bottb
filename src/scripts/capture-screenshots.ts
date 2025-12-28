/**
 * Capture screenshots for documentation
 *
 * Usage: npm run capture-screenshots
 *
 * This script captures screenshots of key pages for the requirements documentation.
 * Screenshots are saved to doc/screenshots/
 */

import { chromium, type Browser, type Page } from 'playwright'
import path from 'path'
import fs from 'fs/promises'

const SCREENSHOT_DIR = path.join(process.cwd(), 'doc/screenshots')
const PORTS_TO_TRY = [3000, 3001, 3002, 3003, 3004, 3005]

interface ScreenshotConfig {
  name: string
  path: string
  viewport?: { width: number; height: number }
  fullPage?: boolean
  waitFor?: string
  clip?: { x: number; y: number; width: number; height: number }
  actions?: (page: Page) => Promise<void>
}

const screenshots: ScreenshotConfig[] = [
  // Home page
  {
    name: 'home-hero',
    path: '/',
    viewport: { width: 1440, height: 900 },
  },
  {
    name: 'home-mobile',
    path: '/',
    viewport: { width: 390, height: 844 },
  },

  // Navigation
  {
    name: 'nav-desktop',
    path: '/',
    viewport: { width: 1440, height: 80 },
    clip: { x: 0, y: 0, width: 1440, height: 80 },
  },

  // Events
  {
    name: 'events-list',
    path: '/events',
    viewport: { width: 1440, height: 900 },
  },

  // Photos
  {
    name: 'photos-gallery',
    path: '/photos',
    viewport: { width: 1440, height: 900 },
    waitFor: '.grid',
  },

  // Videos
  {
    name: 'videos-page',
    path: '/videos',
    viewport: { width: 1440, height: 900 },
  },

  // Songs
  {
    name: 'songs-table',
    path: '/songs',
    viewport: { width: 1440, height: 900 },
  },

  // Companies
  {
    name: 'companies-grid',
    path: '/companies',
    viewport: { width: 1440, height: 900 },
  },

  // Results
  {
    name: 'results-page',
    path: '/results',
    viewport: { width: 1440, height: 900 },
  },

  // Voting
  {
    name: 'vote-crowd',
    path: '/vote/crowd',
    viewport: { width: 1440, height: 900 },
  },

  // Admin
  {
    name: 'admin-login',
    path: '/admin/login',
    viewport: { width: 1440, height: 900 },
  },

  // Design system
  {
    name: 'design-system',
    path: '/design-system',
    viewport: { width: 1440, height: 900 },
    fullPage: true,
  },

  // About
  {
    name: 'about-page',
    path: '/about',
    viewport: { width: 1440, height: 900 },
  },
]

async function findRunningServer(): Promise<string> {
  // Check if BASE_URL is explicitly set
  if (process.env.BASE_URL) {
    console.log(`Using BASE_URL from environment: ${process.env.BASE_URL}`)
    return process.env.BASE_URL
  }

  // Try common Next.js ports
  for (const port of PORTS_TO_TRY) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 1000)

      const response = await fetch(`http://localhost:${port}`, {
        method: 'HEAD',
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (response.ok || response.status === 404) {
        console.log(`✓ Found Next.js server on port ${port}`)
        return `http://localhost:${port}`
      }
    } catch {
      // Port not responding, try next
    }
  }

  throw new Error(
    `No Next.js server found on ports ${PORTS_TO_TRY.join(', ')}.\n` +
      `Please start the dev server with 'npm run dev' or set BASE_URL environment variable.`
  )
}

async function ensureDir(dir: string): Promise<void> {
  try {
    await fs.access(dir)
  } catch {
    await fs.mkdir(dir, { recursive: true })
  }
}

async function captureScreenshot(
  browser: Browser,
  config: ScreenshotConfig,
  baseUrl: string
): Promise<void> {
  const context = await browser.newContext({
    viewport: config.viewport || { width: 1440, height: 900 },
    colorScheme: 'dark',
    deviceScaleFactor: 2, // Retina quality
  })

  const page = await context.newPage()

  try {
    console.log(`📸 Capturing: ${config.name}...`)

    await page.goto(`${baseUrl}${config.path}`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    })

    // Wait for specific element if specified
    if (config.waitFor) {
      try {
        await page.waitForSelector(config.waitFor, { timeout: 10000 })
      } catch {
        console.log(`  ⚠️  Selector not found: ${config.waitFor}`)
      }
    }

    // Execute custom actions if specified
    if (config.actions) {
      await config.actions(page)
    }

    // Add small delay for animations to settle
    await page.waitForTimeout(500)

    const screenshotPath = path.join(SCREENSHOT_DIR, `${config.name}.png`)
    await page.screenshot({
      path: screenshotPath,
      fullPage: config.fullPage ?? false,
      clip: config.clip,
    })

    console.log(`  ✅ Saved: ${config.name}.png`)
  } catch (error) {
    console.error(`  ❌ Failed: ${config.name} - ${(error as Error).message}`)
  } finally {
    await context.close()
  }
}

async function main(): Promise<void> {
  console.log('🚀 Starting screenshot capture...\n')

  // Auto-detect running server
  const baseUrl = await findRunningServer()
  console.log(`Output: ${SCREENSHOT_DIR}\n`)

  await ensureDir(SCREENSHOT_DIR)

  const browser = await chromium.launch({
    headless: true,
  })

  try {
    for (const config of screenshots) {
      await captureScreenshot(browser, config, baseUrl)
    }
  } finally {
    await browser.close()
  }

  console.log('\n✨ Screenshot capture complete!')
  console.log(`Screenshots saved to: ${SCREENSHOT_DIR}`)
}

main().catch(console.error)
