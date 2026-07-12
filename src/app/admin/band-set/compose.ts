/**
 * Pure canvas composition for full-band-set video overlays. No React / DOM-
 * framework code here so the layout maths stays easy to reason about and
 * test.
 *
 * Two transparent overlays, both centred (unlike the corner-anchored song
 * overlay in `../thumbnails/compose.ts`), meant to be composited over the
 * very start of a band's full-set recording:
 *
 * - Title page — company + Bottb logos, band name, and event details.
 * - Credits page — company + Bottb logos and a centred list of band members.
 */

import { drawCover, fitContain, naturalSize } from '@/lib/canvas'
import { OV_H, OV_W } from '../thumbnails/compose'

export type LogoCorner = 'top-left' | 'top-right'

/** Family is registered by {@link import('../thumbnails/jost-font').loadJostFont}. */
const FONT_FAMILY = "'Jost', system-ui, sans-serif"

export { OV_H, OV_W }

export interface BrandLogos {
  /** Square Bottb logo (black tile), already loaded. */
  bottbLogo: HTMLImageElement | null
  /** Band / company logo, already loaded (may be wide or tall). */
  companyLogo: HTMLImageElement | null
  /** Which corner the Bottb square sits in; the company logo takes the other. */
  bottbCorner: LogoCorner
}

export interface TitleContent extends BrandLogos {
  bandName: string
  eventName: string
  eventDate: string
  eventVenue: string
}

export interface CreditsContent extends BrandLogos {
  bandName: string
  /** One line per credit, e.g. "Jane Doe — Vocals"; blank lines are ignored. */
  members: string[]
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
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
 * Draw the Bottb square in `bottbCorner` and the company logo in the
 * opposite corner, vertically centred on the square. Proportional to `h`.
 */
function drawCornerLogos(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  { bottbLogo, companyLogo, bottbCorner }: BrandLogos
): void {
  const pad = Math.round(h * 0.055)
  const bottbSize = Math.round(h * 0.17)
  const centerY = pad + bottbSize / 2
  const bottbOnRight = bottbCorner === 'top-right'

  if (bottbLogo) {
    const x = bottbOnRight ? w - pad - bottbSize : pad
    ctx.drawImage(bottbLogo, x, pad, bottbSize, bottbSize)
  }

  if (companyLogo) {
    const { w: nw, h: nh } = naturalSize(companyLogo)
    const fitted = fitContain(
      nw,
      nh,
      Math.round(w * 0.28),
      Math.round(h * 0.14)
    )
    const x = bottbOnRight ? pad : w - pad - fitted.w
    const y = centerY - fitted.h / 2
    ctx.drawImage(companyLogo, x, y, fitted.w, fitted.h)
  }
}

function setTextStyle(ctx: CanvasRenderingContext2D, h: number): void {
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.shadowColor = 'rgba(0,0,0,0.85)'
  ctx.shadowBlur = Math.round(h * 0.014)
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = Math.round(h * 0.006)
  ctx.fillStyle = '#ffffff'
}

function resetTextStyle(ctx: CanvasRenderingContext2D): void {
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0
}

/**
 * Draw the title-page adornments — corner logos plus a centred band name and
 * event details — onto a `w`×`h` area. Everything is proportional to `h`.
 */
function drawTitleAdornments(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  content: TitleContent
): void {
  drawCornerLogos(ctx, w, h, content)

  const centerX = w / 2
  const maxTextW = Math.round(w * 0.82)
  const bandName = content.bandName.trim()
  const eventName = content.eventName.trim()
  const dateVenue = [content.eventDate.trim(), content.eventVenue.trim()]
    .filter(Boolean)
    .join('  ·  ')

  setTextStyle(ctx, h)
  let baseline = Math.round(h * 0.42)

  if (bandName) {
    const size = fitFont(
      ctx,
      bandName,
      800,
      Math.round(h * 0.13),
      maxTextW * 1.6
    )
    ctx.font = `800 ${size}px ${FONT_FAMILY}`
    const lines = wrapLines(ctx, bandName, maxTextW, 2)
    const lineHeight = size * 1.1
    for (const line of lines) {
      baseline += lineHeight
      ctx.fillText(line, centerX, baseline)
    }
    baseline += Math.round(h * 0.03)
  }

  if (eventName) {
    const size = fitFont(ctx, eventName, 600, Math.round(h * 0.05), maxTextW)
    ctx.font = `600 ${size}px ${FONT_FAMILY}`
    baseline += size * 1.3
    ctx.fillText(eventName, centerX, baseline)
  }

  if (dateVenue) {
    const size = fitFont(ctx, dateVenue, 500, Math.round(h * 0.038), maxTextW)
    ctx.font = `500 ${size}px ${FONT_FAMILY}`
    baseline += size * 1.5
    ctx.fillText(dateVenue, centerX, baseline)
  }

  resetTextStyle(ctx)
}

/**
 * Draw the credits-page adornments — corner logos, the band name as a
 * heading, and a centred, auto-shrunk list of member credits.
 */
function drawCreditsAdornments(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  content: CreditsContent
): void {
  drawCornerLogos(ctx, w, h, content)

  const centerX = w / 2
  const maxTextW = Math.round(w * 0.82)
  const bandName = content.bandName.trim()
  const members = content.members.map((m) => m.trim()).filter(Boolean)

  setTextStyle(ctx, h)
  let baseline = Math.round(h * 0.34)

  if (bandName) {
    const size = fitFont(ctx, bandName, 800, Math.round(h * 0.075), maxTextW)
    ctx.font = `800 ${size}px ${FONT_FAMILY}`
    baseline += size
    ctx.fillText(bandName, centerX, baseline)
    baseline += Math.round(size * 0.6)
  }

  const label = 'BAND MEMBERS'
  const labelSize = Math.max(12, Math.round(h * 0.026))
  ctx.font = `600 ${labelSize}px ${FONT_FAMILY}`
  baseline += labelSize * 1.4
  ctx.fillText(label, centerX, baseline)
  baseline += Math.round(h * 0.045)

  if (members.length > 0) {
    // Shrink line height (and therefore font size) as the roster grows so a
    // long list still fits between the heading and the bottom margin.
    const bottomLimit = h * 0.92
    const availableH = Math.max(bottomLimit - baseline, h * 0.1)
    const lineHeight = clamp(availableH / members.length, h * 0.035, h * 0.11)
    const startSize = Math.round(clamp(lineHeight * 0.6, h * 0.02, h * 0.055))

    for (const member of members) {
      const size = fitFont(ctx, member, 500, startSize, maxTextW)
      ctx.font = `500 ${size}px ${FONT_FAMILY}`
      baseline += lineHeight
      ctx.fillText(member, centerX, baseline)
    }
  }

  resetTextStyle(ctx)
}

/**
 * Render the title-page overlay onto a transparent `w`×`h` canvas (defaults
 * to 4K). No frame, no scrims — intended to be exported as a PNG and
 * composited over the start of the full-set video.
 */
export function composeTitleOverlay(
  ctx: CanvasRenderingContext2D,
  content: TitleContent,
  w: number = OV_W,
  h: number = OV_H
): void {
  ctx.clearRect(0, 0, w, h)
  drawTitleAdornments(ctx, w, h, content)
}

/**
 * Render the credits-page overlay onto a transparent `w`×`h` canvas
 * (defaults to 4K).
 */
export function composeCreditsOverlay(
  ctx: CanvasRenderingContext2D,
  content: CreditsContent,
  w: number = OV_W,
  h: number = OV_H
): void {
  ctx.clearRect(0, 0, w, h)
  drawCreditsAdornments(ctx, w, h, content)
}

/** Preview canvas — 16:9, matches the overlay's aspect ratio at a screen-friendly size. */
export const PV_W = 1920
export const PV_H = 1080

/**
 * Draw a video frame (or a flat fill if none is available yet) with
 * top/bottom scrims for legibility, then hand off to `draw` for the
 * adornments — matches the on-screen preview treatment used by the other
 * admin generators. `source` lets the admin check the overlay reads clearly
 * against the actual footage; it plays no part in the exported PNG.
 */
function drawPreviewFrame(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource | null,
  sourceW: number,
  sourceH: number,
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
): void {
  ctx.clearRect(0, 0, w, h)

  if (source) {
    drawCover(ctx, source, sourceW, sourceH, 0, 0, w, h)
  } else {
    ctx.fillStyle = '#0a0a0a'
    ctx.fillRect(0, 0, w, h)
  }

  const top = ctx.createLinearGradient(0, 0, 0, h * 0.3)
  top.addColorStop(0, 'rgba(0,0,0,0.45)')
  top.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = top
  ctx.fillRect(0, 0, w, h * 0.3)

  const bottom = ctx.createLinearGradient(0, h * 0.3, 0, h)
  bottom.addColorStop(0, 'rgba(0,0,0,0)')
  bottom.addColorStop(1, 'rgba(0,0,0,0.55)')
  ctx.fillStyle = bottom
  ctx.fillRect(0, h * 0.3, w, h * 0.7)

  draw(ctx, w, h)
}

/** Render a title-page preview (frame + scrims + adornments) into `ctx`. */
export function composeTitlePreview(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource | null,
  sourceW: number,
  sourceH: number,
  content: TitleContent,
  w: number = PV_W,
  h: number = PV_H
): void {
  drawPreviewFrame(ctx, source, sourceW, sourceH, w, h, (c, cw, ch) =>
    drawTitleAdornments(c, cw, ch, content)
  )
}

/** Render a credits-page preview (frame + scrims + adornments) into `ctx`. */
export function composeCreditsPreview(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource | null,
  sourceW: number,
  sourceH: number,
  content: CreditsContent,
  w: number = PV_W,
  h: number = PV_H
): void {
  drawPreviewFrame(ctx, source, sourceW, sourceH, w, h, (c, cw, ch) =>
    drawCreditsAdornments(c, cw, ch, content)
  )
}
