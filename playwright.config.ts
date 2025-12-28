import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright configuration for E2E tests
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // Test directory
  testDir: './e2e',

  // Test file pattern
  testMatch: '**/*.spec.ts',

  // Maximum time one test can run
  timeout: 30 * 1000,

  // Maximum time expect() should wait
  expect: {
    timeout: 5000,
  },

  // Run tests in parallel - disabled for DB consistency
  fullyParallel: false,
  workers: 1,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Reporter
  reporter: process.env.CI ? 'github' : 'html',

  // Shared settings for all projects
  use: {
    // Base URL for navigation - port 3001 for E2E to avoid conflicts
    baseURL: 'http://localhost:3001',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Uncomment to test on more browsers
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  // Run local dev server before starting the tests
  // Uses port 3001 to avoid conflicts with normal dev server
  webServer: {
    command: 'next dev --port 3001',
    url: 'http://localhost:3001',
    reuseExistingServer: false, // Always start fresh to ensure test DB is used
    timeout: 120 * 1000, // 2 minutes for dev server to start
    env: {
      // Use local Docker postgres - our sql.ts wrapper handles this
      POSTGRES_URL: 'postgres://test:test@localhost:5433/bottb_test',
      DATABASE_URL: 'postgres://test:test@localhost:5433/bottb_test',
      // NextAuth requires these for JWT signing
      AUTH_SECRET: 'test-secret-for-e2e-testing-at-least-32-chars',
      NEXTAUTH_URL: 'http://localhost:3001',
    },
  },

  // Output directory for test artifacts
  outputDir: 'test-results/',
})
