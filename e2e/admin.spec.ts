import { test, expect } from '@playwright/test'

/**
 * E2E tests for admin authentication and event management
 *
 * Prerequisites:
 * - Test database seeded with admin user (admin@test.com / testpassword123)
 * - Test database seeded with test events
 */

test.describe('Admin Authentication', () => {
  test.beforeEach(async ({ context }) => {
    // Clear cookies to ensure logged-out state
    await context.clearCookies()
  })

  test('shows login page when not authenticated', async ({ page }) => {
    await page.goto('/admin/login')

    await expect(page.getByText('Welcome Back')).toBeVisible()
    await expect(
      page.getByText('Sign in to your account to continue')
    ).toBeVisible()
    await expect(page.getByPlaceholder('you@example.com')).toBeVisible()
    await expect(page.getByPlaceholder('••••••••')).toBeVisible()
  })

  test('shows error for invalid credentials', async ({ page }) => {
    await page.goto('/admin/login')

    // Fill in wrong credentials
    await page.getByPlaceholder('you@example.com').fill('wrong@email.com')
    await page.getByPlaceholder('••••••••').fill('wrongpassword')

    // Submit form
    await page.getByRole('button', { name: /Sign In/i }).click()

    // Should show error
    await expect(page.getByText(/Invalid email or password/i)).toBeVisible({
      timeout: 10000,
    })
  })

  test('can login with valid admin credentials', async ({ page }) => {
    await page.goto('/admin/login')

    // Fill in test admin credentials from fixtures
    await page.getByPlaceholder('you@example.com').fill('admin@test.com')
    await page.getByPlaceholder('••••••••').fill('testpassword123')

    // Submit form
    await page.getByRole('button', { name: /Sign In/i }).click()

    // Should redirect to admin dashboard
    await expect(page).toHaveURL('/admin', { timeout: 15000 })
  })

  test('admin dashboard shows event management', async ({ page }) => {
    // Login first
    await page.goto('/admin/login')
    await page.getByPlaceholder('you@example.com').fill('admin@test.com')
    await page.getByPlaceholder('••••••••').fill('testpassword123')
    await page.getByRole('button', { name: /Sign In/i }).click()

    // Wait for redirect
    await expect(page).toHaveURL('/admin', { timeout: 15000 })

    // Wait for page to fully load
    await page.waitForLoadState('networkidle')

    // Should see admin dashboard content - look for dashboard-specific content
    await expect(
      page
        .getByRole('heading', { name: /Admin/i })
        .or(page.getByRole('heading', { name: /Dashboard/i }))
        .or(page.getByRole('heading', { name: /Events/i }))
        .first()
    ).toBeVisible({ timeout: 10000 })
  })

  test('redirects unauthenticated users from admin pages', async ({ page }) => {
    // Try to access admin dashboard directly
    await page.goto('/admin')

    // Should be redirected or show login
    await page.waitForLoadState('networkidle')

    // Either redirected to login or see access denied
    const currentUrl = page.url()
    const hasLoginPath =
      currentUrl.includes('/login') || currentUrl.includes('/api/auth')

    // If not redirected, should at least not show admin content to non-authenticated users
    if (!hasLoginPath) {
      // Page should show some auth-related content
      await expect(
        page.getByText(/sign in/i).or(page.getByText(/loading/i))
      ).toBeVisible()
    }
  })
})
