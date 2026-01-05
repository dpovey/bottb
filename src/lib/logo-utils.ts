/**
 * Utilities for responsive logo sizing
 *
 * These helpers ensure company and band logos are served at appropriate sizes
 * for different display contexts and device pixel ratios.
 *
 * Next.js Image component automatically generates srcsets, but the `sizes`
 * attribute must accurately describe the rendered size for optimal loading.
 */

/**
 * Responsive sizes configuration for logo contexts.
 *
 * Format: `sizes` attribute value following media query syntax
 * Each entry describes the actual rendered width at different viewports.
 *
 * Key insight: we multiply by device pixel ratio to get physical pixels.
 * A 180px CSS width on a 2x display needs a 360px image.
 */
export const logoSizes = {
  /**
   * Marquee logos on homepage
   * - Mobile: ~120px wide
   * - Desktop: ~180px wide
   * - Account for 3x retina displays (540px max)
   */
  marquee: '(max-width: 768px) 120px, 180px',

  /**
   * Company card main logo
   * - Small mobile: up to 200px
   * - Desktop: up to 320px (constrained by card width)
   * - Account for 2x retina (640px max needed)
   */
  cardLogo: '(max-width: 640px) 200px, 320px',

  /**
   * Company card icon (32px square)
   * - Fixed size across all viewports
   * - Account for 3x retina (96px max)
   */
  cardIcon: '32px',

  /**
   * Company icon in various UI elements
   * Different fixed sizes, all need retina support
   */
  icon: {
    xs: '16px', // 48px max for 3x
    sm: '20px', // 60px max for 3x
    md: '24px', // 72px max for 3x
    lg: '32px', // 96px max for 3x
  },

  /**
   * Company page header logo
   * - Prominently displayed, needs to be crisp
   * - Mobile: up to 200px
   * - Desktop: up to 320px
   */
  pageHeader: '(max-width: 640px) 200px, 320px',

  /**
   * Band thumbnail sizes
   * These are CSS pixel sizes, Next.js Image needs higher values
   * to generate appropriate srcset for retina displays.
   */
  bandThumbnail: {
    xs: '32px', // 96px max for 3x
    sm: '48px', // 144px max for 3x
    md: '(max-width: 768px) 56px, 64px', // responsive
    lg: '64px', // 192px max for 3x
    xl: '(max-width: 768px) 96px, 128px', // responsive
    xxl: '(max-width: 640px) 160px, 192px', // responsive
    hero: '(max-width: 768px) 128px, 160px', // responsive
  },
} as const

/**
 * Get the intrinsic width to request from Next.js Image.
 *
 * We set width higher than CSS display size to ensure Next.js generates
 * a srcset with images large enough for high-DPI displays.
 *
 * Rule of thumb: max display width × 3 (for 3x retina)
 */
export const logoIntrinsicWidths = {
  /** Marquee: 180px display × 3 = 540px */
  marquee: { width: 540, height: 144 },

  /** Card logo: 320px display × 2 = 640px (2x is sufficient for logos) */
  cardLogo: { width: 640, height: 128 },

  /** Card icon: 32px × 3 = 96px */
  cardIcon: { width: 96, height: 96 },

  /** Page header: 320px × 2 = 640px */
  pageHeader: { width: 640, height: 128 },

  /** Icon sizes (width × 3 for 3x support) */
  icon: {
    xs: { width: 48, height: 48 },
    sm: { width: 60, height: 60 },
    md: { width: 72, height: 72 },
    lg: { width: 96, height: 96 },
  },

  /** Band thumbnail sizes (width × 3 for largest breakpoint) */
  bandThumbnail: {
    xs: { width: 96, height: 96 },
    sm: { width: 144, height: 144 },
    md: { width: 192, height: 192 }, // 64px × 3
    lg: { width: 192, height: 192 },
    xl: { width: 384, height: 384 }, // 128px × 3
    xxl: { width: 576, height: 576 }, // 192px × 3
    hero: { width: 480, height: 480 }, // 160px × 3
  },
} as const
