/**
 * SEO utility functions
 */

// SEO title/description constants
export const SITE_NAME = 'Battle of the Tech Bands'
export const SITE_SUFFIX_FULL = ` | ${SITE_NAME}` // 27 chars
export const SITE_SUFFIX_SHORT = ' | BOTTB' // 8 chars
export const MAX_TITLE_LENGTH = 60
export const MAX_DESC_LENGTH = 160
export const MIN_DESC_LENGTH = 50

/**
 * Build an SEO-optimized title that fits within character limits.
 * Uses tiered suffix approach: full → short → none, preserving the unique content.
 */
export function buildSeoTitle(baseTitle: string): string {
  // Try full suffix first
  if (baseTitle.length + SITE_SUFFIX_FULL.length <= MAX_TITLE_LENGTH) {
    return `${baseTitle}${SITE_SUFFIX_FULL}`
  }

  // Fall back to short suffix
  if (baseTitle.length + SITE_SUFFIX_SHORT.length <= MAX_TITLE_LENGTH) {
    return `${baseTitle}${SITE_SUFFIX_SHORT}`
  }

  // No suffix if title is still too long - prioritize the content
  if (baseTitle.length <= MAX_TITLE_LENGTH) {
    return baseTitle
  }

  // Truncate only as last resort (shouldn't happen with reasonable base titles)
  return baseTitle.slice(0, MAX_TITLE_LENGTH - 1) + '…'
}

/**
 * Build an SEO-optimized description that fits within character limits.
 * Truncates at word boundary when possible.
 */
export function buildSeoDescription(description: string): string {
  if (description.length <= MAX_DESC_LENGTH) {
    return description
  }

  // Try to break at word boundary
  const truncated = description.slice(0, MAX_DESC_LENGTH - 1)
  const lastSpace = truncated.lastIndexOf(' ')

  // If we can break at a word boundary reasonably close to the limit, do it
  if (lastSpace > MAX_DESC_LENGTH - 30) {
    return truncated.slice(0, lastSpace) + '…'
  }

  return truncated + '…'
}

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
