/**
 * SEO utility functions
 */

/**
 * Default OpenGraph image configuration
 * Used as a fallback when pages don't have a specific hero image
 */
export const DEFAULT_OG_IMAGE = {
  url: '/images/logos/bottb-horizontal.png',
  width: 1200,
  height: 630,
  alt: 'Battle of the Tech Bands',
}

/**
 * Get the base URL for the site
 * Prioritizes NEXT_PUBLIC_BASE_URL, falls back to Vercel URL or localhost
 */
export function getBaseUrl(): string {
  // Explicit base URL takes priority
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL
  }

  // Vercel production URL
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }

  // Vercel preview/branch URL
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }

  // Local development fallback
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000'
  }

  // Default fallback (should not happen in production)
  return 'https://bottb.com'
}
