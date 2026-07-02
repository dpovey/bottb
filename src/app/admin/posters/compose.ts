/**
 * Pure canvas composition for event posters. No React / DOM-framework code here
 * so the layout maths stays easy to reason about and test.
 *
 * A single {@link composePoster} renders one of three social formats, all with
 * the same visual language: a full-bleed event photo, a bottom scrim for
 * legibility, Bottb + optional national-partner logos across the top, and a
 * left-aligned title / date / venue block in the lower third.
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

type Source = CanvasImageSource

export interface PosterContent {
  /** Event name — the dominant element. */
  name: string
  /** Human-readable date label (e.g. "23rd October 2025 @ 6:30PM"). */
  date: string
  /** Venue / location line. */
  venue: string
  /** Square Bottb logo (black tile), already loaded. */
  bottbLogo: HTMLImageElement | null
  /** National-partner "powered by" logo, already loaded (may be wide or tall). */
  partnerLogo: HTMLImageElement | null
  /** Which corner the Bottb square sits in; the partner logo takes the other. */
  bottbCorner: LogoCorner
}

export interface PosterOptions {
  format: PosterFormat
  /** Focal point for cover-cropping the photo (0..1 on each axis). */
  focusX?: number
  focusY?: number
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
 * Draw the two logos across the top: the Bottb square in `bottbCorner`, and the
 * national-partner logo fitted into the opposite corner, vertically centred on
 * the square. Everything is proportional to `h` so it scales across formats.
 */
function drawLogos(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  content: PosterContent
): void {
  const pad = Math.round(h * 0.055)
  const bottbSize = Math.round(h * 0.15)
  const centerY = pad + bottbSize / 2
  const bottbOnRight = content.bottbCorner === 'top-right'

  if (content.bottbLogo) {
    const x = bottbOnRight ? w - pad - bottbSize : pad
    ctx.drawImage(content.bottbLogo, x, pad, bottbSize, bottbSize)
  }

  if (content.partnerLogo) {
    const { w: nw, h: nh } = naturalSize(content.partnerLogo)
    const fitted = fitContain(
      nw,
      nh,
      Math.round(w * 0.28),
      Math.round(h * 0.13)
    )
    const x = bottbOnRight ? pad : w - pad - fitted.w
    const y = centerY - fitted.h / 2
    ctx.drawImage(content.partnerLogo, x, y, fitted.w, fitted.h)
  }
}

/**
 * Draw the title / date / venue block, bottom-left, stacked from the baseline
 * upwards so the largest element (the title) sits highest. The title wraps to a
 * maximum of two lines. All sizing is proportional to `h`.
 */
function drawText(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  content: PosterContent
): void {
  const pad = Math.round(h * 0.055)
  const maxTextW = w - pad * 2
  const name = content.name.trim()
  const date = content.date.trim()
  const venue = content.venue.trim()

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.shadowColor = 'rgba(0,0,0,0.85)'
  ctx.shadowBlur = Math.round(h * 0.014)
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = Math.round(h * 0.006)
  ctx.fillStyle = '#ffffff'

  let baseline = h - pad

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

  // Event name (dominant, up to two lines, drawn bottom-up so it reads top-down).
  if (name) {
    const size = fitFont(ctx, name, 700, Math.round(h * 0.1), maxTextW * 2)
    ctx.font = `700 ${size}px ${FONT_FAMILY}`
    const lines = wrapLines(ctx, name, maxTextW, 2)
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
 * cropped to the focal point, a bottom scrim, logos across the top, and the
 * title/date/venue block in the lower third.
 */
export function composePoster(
  ctx: CanvasRenderingContext2D,
  source: Source | null,
  sourceW: number,
  sourceH: number,
  content: PosterContent,
  { format, focusX = 0.5, focusY = 0.5 }: PosterOptions
): void {
  const { w, h } = POSTER_FORMATS[format]
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
  drawText(ctx, w, h, content)
}
