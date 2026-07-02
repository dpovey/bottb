/**
 * Pure canvas composition for event posters. No React / DOM-framework code here
 * so the layout maths stays easy to reason about and test.
 *
 * A single {@link composePoster} renders one of three social formats, all with
 * the same visual language: a full-bleed event photo, a bottom scrim for
 * legibility, Bottb + optional sponsor logos across the top, an optional
 * competing-bands footer strip, and a left-aligned wordmark / edition / date /
 * venue block in the lower third.
 *
 * Sizes (research-backed for LinkedIn + Facebook):
 * - portrait  1080×1350 (4:5)   — biggest mobile-feed footprint on both.
 * - landscape 1200×628  (1.91:1)— link / OG share card.
 * - fbcover   1920×1005 (~1.91:1)— Facebook event cover, mobile-safe.
 */

import { drawCover, fitContain, naturalSize } from '@/lib/canvas'

export type LogoCorner = 'top-left' | 'top-right'

export type PosterFormat = 'portrait' | 'landscape' | 'fbcover'

export interface PosterDimensions {
  w: number
  h: number
}

/** Pixel dimensions for each export format. */
export const POSTER_FORMATS: Record<PosterFormat, PosterDimensions> = {
  portrait: { w: 1080, h: 1350 },
  landscape: { w: 1200, h: 628 },
  fbcover: { w: 1920, h: 1005 },
}

/** Family is registered by {@link import('../thumbnails/jost-font').loadJostFont}. */
const FONT_FAMILY = "'Jost', system-ui, sans-serif"

/** Fixed brand wordmark — always the dominant title, regardless of event name. */
const BRAND_TAGLINE = 'Battle of the Tech Bands'

type Source = CanvasImageSource

export interface PosterContent {
  /** Event edition/name (e.g. "Sydney Tech Battle 2025") — subtitle under the brand wordmark. */
  name: string
  /** Human-readable date label (e.g. "23rd October 2025 @ 6:30PM"). */
  date: string
  /** Venue / location line. */
  venue: string
  /** Square Bottb logo (black tile), already loaded. */
  bottbLogo: HTMLImageElement | null
  /** National-partner "powered by" logo, already loaded (may be wide or tall). */
  partnerLogo: HTMLImageElement | null
  /** Youngcare "supporting" logo, already loaded. */
  youngcareLogo?: HTMLImageElement | null
  /** Which corner the Bottb square sits in; the partner/Youngcare lockups take the other. */
  bottbCorner: LogoCorner
  /** Competing bands' company logos, already loaded, drawn as a bottom footer strip. */
  companyLogos?: HTMLImageElement[]
}

export interface PosterOptions {
  format: PosterFormat
  /** Focal point for cover-cropping the photo (0..1 on each axis). */
  focusX?: number
  focusY?: number
  /**
   * Render at this pixel size instead of `POSTER_FORMATS[format]` — used to
   * draw crisp, natively-sized on-screen previews (avoids the browser
   * CSS-downscaling a full-resolution canvas, which aliases fine text).
   * Must share the same aspect ratio as `format`.
   */
  dimensions?: PosterDimensions
}

/** Shrink the font size until the text fits `maxWidth` (down to a floor). */
function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  weight: number,
  startSize: number,
  maxWidth: number,
  minSize = 18
): number {
  let size = startSize
  ctx.font = `${weight} ${size}px ${FONT_FAMILY}`
  while (size > minSize && ctx.measureText(text).width > maxWidth) {
    size -= 2
    ctx.font = `${weight} ${size}px ${FONT_FAMILY}`
  }
  return size
}

/**
 * Greedy word-wrap `text` into at most `maxLines` lines that each fit
 * `maxWidth` at the current `ctx.font`. Overflowing words stay on the last
 * line (the caller shrinks the font to compensate).
 */
function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return []
  const lines: string[] = []
  let current = words[0]

  for (let i = 1; i < words.length; i++) {
    const candidate = `${current} ${words[i]}`
    if (
      ctx.measureText(candidate).width <= maxWidth ||
      lines.length === maxLines - 1
    ) {
      current = candidate
    } else {
      lines.push(current)
      current = words[i]
    }
  }
  lines.push(current)
  return lines.slice(0, maxLines)
}

/**
 * Draw a small uppercase caption above a logo (e.g. "POWERED BY" + the
 * partner's logo), matching the "Powered by" badge used on the website.
 * Returns the total height consumed so callers can stack lockups vertically.
 */
function drawSponsorLockup(
  ctx: CanvasRenderingContext2D,
  h: number,
  x: number,
  y: number,
  maxW: number,
  maxLogoH: number,
  label: string,
  logo: HTMLImageElement,
  align: 'left' | 'right'
): number {
  const labelSize = Math.max(10, Math.round(h * 0.018))
  const labelGap = Math.round(h * 0.012)
  ctx.font = `600 ${labelSize}px ${FONT_FAMILY}`
  ctx.textAlign = align
  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  ctx.fillText(
    label.toUpperCase(),
    align === 'right' ? x + maxW : x,
    y + labelSize
  )

  const { w: nw, h: nh } = naturalSize(logo)
  const fitted = fitContain(nw, nh, maxW, maxLogoH)
  const logoY = y + labelSize + labelGap
  const logoX = align === 'right' ? x + maxW - fitted.w : x
  ctx.drawImage(logo, logoX, logoY, fitted.w, fitted.h)

  ctx.textAlign = 'left'
  return labelSize + labelGap + fitted.h
}

/**
 * Draw the Bottb square in `bottbCorner`, and — stacked in the opposite
 * corner — a "Powered by" lockup for the national partner and a "Supporting"
 * lockup for Youngcare. Everything is proportional to `h` so it scales
 * across formats.
 */
function drawLogos(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  content: PosterContent
): void {
  const pad = Math.round(h * 0.055)
  const bottbSize = Math.round(h * 0.15)
  const bottbOnRight = content.bottbCorner === 'top-right'

  if (content.bottbLogo) {
    const x = bottbOnRight ? w - pad - bottbSize : pad
    ctx.drawImage(content.bottbLogo, x, pad, bottbSize, bottbSize)
  }

  const align = bottbOnRight ? 'left' : 'right'
  const sponsorX = bottbOnRight ? pad : w - pad - Math.round(w * 0.3)
  const sponsorW = Math.round(w * 0.3)
  let y = pad

  if (content.partnerLogo) {
    y +=
      drawSponsorLockup(
        ctx,
        h,
        sponsorX,
        y,
        sponsorW,
        Math.round(h * 0.075),
        'Powered by',
        content.partnerLogo,
        align
      ) + Math.round(h * 0.018)
  }

  if (content.youngcareLogo) {
    drawSponsorLockup(
      ctx,
      h,
      sponsorX,
      y,
      sponsorW,
      Math.round(h * 0.055),
      'Supporting',
      content.youngcareLogo,
      align
    )
  }
}

/**
 * Draw every competing band's company logo as a uniform-height, centred
 * footer strip along the bottom edge, shrinking to fit if there are many.
 * Returns the vertical space consumed so the text block above can make room.
 */
function drawCompanyLogos(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  logos: HTMLImageElement[]
): number {
  if (logos.length === 0) return 0

  const pad = Math.round(h * 0.055)
  const maxRowW = w - pad * 2
  const gap = Math.round(h * 0.025)
  const minLogoH = Math.round(h * 0.028)
  let logoH = Math.round(h * 0.05)

  const widthsAt = (lh: number) =>
    logos.map((img) => {
      const { w: nw, h: nh } = naturalSize(img)
      return nw * (lh / nh)
    })
  const rowWidth = (widths: number[]) =>
    widths.reduce((sum, lw) => sum + lw, 0) + gap * (logos.length - 1)

  let widths = widthsAt(logoH)
  while (rowWidth(widths) > maxRowW && logoH > minLogoH) {
    logoH -= 2
    widths = widthsAt(logoH)
  }

  const totalW = rowWidth(widths)
  let x = Math.max(pad, (w - totalW) / 2)
  const y = h - pad - logoH
  logos.forEach((img, i) => {
    ctx.drawImage(img, x, y, widths[i], logoH)
    x += widths[i] + gap
  })

  return logoH + Math.round(h * 0.03)
}

/**
 * Draw the wordmark / edition / date / venue block, bottom-left, stacked from
 * the baseline upwards so the largest element (the brand wordmark) sits
 * highest. The wordmark wraps to a maximum of two lines. All sizing is
 * proportional to `h`. `bottomInset` reserves space above the baseline for
 * the company-logo footer strip, when present.
 */
function drawText(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  content: PosterContent,
  bottomInset = 0
): void {
  const pad = Math.round(h * 0.055)
  const maxTextW = w - pad * 2
  const edition = content.name.trim()
  const date = content.date.trim()
  const venue = content.venue.trim()

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.shadowColor = 'rgba(0,0,0,0.85)'
  ctx.shadowBlur = Math.round(h * 0.014)
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = Math.round(h * 0.006)
  ctx.fillStyle = '#ffffff'

  let baseline = h - pad - bottomInset

  // Venue (smallest, at the bottom).
  if (venue) {
    const size = fitFont(ctx, venue, 500, Math.round(h * 0.042), maxTextW)
    ctx.font = `500 ${size}px ${FONT_FAMILY}`
    ctx.fillText(venue, pad, baseline)
    baseline -= size * 1.4
  }

  // Date.
  if (date) {
    const size = fitFont(ctx, date, 600, Math.round(h * 0.05), maxTextW)
    ctx.font = `600 ${size}px ${FONT_FAMILY}`
    ctx.fillText(date, pad, baseline)
    baseline -= size * 1.4
  }

  // Event edition (e.g. "Sydney Tech Battle 2025") — subtitle under the wordmark.
  if (edition) {
    const size = fitFont(ctx, edition, 600, Math.round(h * 0.055), maxTextW)
    ctx.font = `600 ${size}px ${FONT_FAMILY}`
    ctx.fillText(edition, pad, baseline)
    baseline -= size * 1.5
  }

  // Brand wordmark (dominant, up to two lines, drawn bottom-up so it reads top-down).
  {
    const size = fitFont(
      ctx,
      BRAND_TAGLINE,
      800,
      Math.round(h * 0.1),
      maxTextW * 2
    )
    ctx.font = `800 ${size}px ${FONT_FAMILY}`
    const lines = wrapLines(ctx, BRAND_TAGLINE, maxTextW, 2)
    const lineHeight = size * 1.1
    for (let i = lines.length - 1; i >= 0; i--) {
      ctx.fillText(lines[i], pad, baseline)
      baseline -= lineHeight
    }
  }

  // Reset shadow so callers aren't surprised.
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0
}

/**
 * Render an event poster of the given `format` into `ctx`: the photo cover-
 * cropped to the focal point, a bottom scrim, logos across the top, a
 * competing-bands footer strip, and the wordmark/edition/date/venue block in
 * the lower third.
 */
export function composePoster(
  ctx: CanvasRenderingContext2D,
  source: Source | null,
  sourceW: number,
  sourceH: number,
  content: PosterContent,
  { format, focusX = 0.5, focusY = 0.5, dimensions }: PosterOptions
): void {
  const { w, h } = dimensions ?? POSTER_FORMATS[format]
  ctx.clearRect(0, 0, w, h)

  // Background photo (or flat fill until one is chosen).
  if (source) {
    drawCover(ctx, source, sourceW, sourceH, 0, 0, w, h, focusX, focusY)
  } else {
    ctx.fillStyle = '#0a0a0a'
    ctx.fillRect(0, 0, w, h)
  }

  // Top scrim — keeps logos readable over bright photos.
  const top = ctx.createLinearGradient(0, 0, 0, h * 0.3)
  top.addColorStop(0, 'rgba(0,0,0,0.5)')
  top.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = top
  ctx.fillRect(0, 0, w, h * 0.3)

  // Bottom scrim — keeps the title/date/venue text readable.
  const bottom = ctx.createLinearGradient(0, h * 0.45, 0, h)
  bottom.addColorStop(0, 'rgba(0,0,0,0)')
  bottom.addColorStop(1, 'rgba(0,0,0,0.85)')
  ctx.fillStyle = bottom
  ctx.fillRect(0, h * 0.45, w, h * 0.55)

  drawLogos(ctx, w, h, content)
  const bottomInset = drawCompanyLogos(ctx, w, h, content.companyLogos ?? [])
  drawText(ctx, w, h, content, bottomInset)
}
