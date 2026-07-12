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

/** Site accent (Vibrant Gold, `--color-accent` in DESIGN.md) — used sparingly. */
const ACCENT_COLOR = '#F5A623'

export { OV_H, OV_W }

export interface BrandLogos {
  /** Square Bottb logo (black tile), already loaded. */
  bottbLogo: HTMLImageElement | null
  /** Band / company logo, already loaded (may be wide or tall). */
  companyLogo: HTMLImageElement | null
  /** Which corner the Bottb square sits in; the company logo takes the other. */
  bottbCorner: LogoCorner
  /** National-partner "Powered by" logo (e.g. Jumbo Interactive), already loaded. */
  partnerLogo?: HTMLImageElement | null
  /** Youngcare "Supporting" logo, already loaded. */
  youngcareLogo?: HTMLImageElement | null
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

/** Sets a small amount of letter-spacing where the browser supports it (no-op otherwise). */
function setLetterSpacing(ctx: CanvasRenderingContext2D, px: number): void {
  const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string }
  if ('letterSpacing' in c) c.letterSpacing = `${px}px`
}

/**
 * A soft elliptical vignette behind the text block, so the overlay stays
 * legible when composited over a bright or busy video frame — the exported
 * PNG has no full-frame scrim (that would hide the footage), just this
 * generous, low-opacity "plate" under the copy.
 */
function drawTextPlate(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number
): void {
  ctx.save()
  ctx.translate(centerX, centerY)
  ctx.scale(radiusX / radiusY, 1)
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radiusY)
  gradient.addColorStop(0, 'rgba(0,0,0,0.42)')
  gradient.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = gradient
  ctx.fillRect(-radiusY * 2, -radiusY * 2, radiusY * 4, radiusY * 4)
  ctx.restore()
}

/** A short, centred accent-coloured rule — a small "designed" beat between text blocks. */
function drawAccentRule(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  y: number,
  width: number,
  thickness: number
): void {
  ctx.fillStyle = ACCENT_COLOR
  ctx.fillRect(centerX - width / 2, y, width, thickness)
}

/** Split "Jane Doe — Vocals" into a name and an optional role. */
function parseMemberLine(line: string): { name: string; role?: string } {
  const parts = line.split(/\s+[-–—]\s+/)
  if (parts.length < 2) return { name: line }
  return { name: parts[0], role: parts.slice(1).join(' – ') }
}

/**
 * Draw a compact, centred "Powered by / Supporting" sponsor row along the
 * bottom edge — subordinate in scale to the hero content above it.
 */
function drawSponsorRow(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  partnerLogo: HTMLImageElement | null | undefined,
  youngcareLogo: HTMLImageElement | null | undefined
): void {
  const groups = [
    partnerLogo && { label: 'POWERED BY', logo: partnerLogo },
    youngcareLogo && { label: 'SUPPORTING', logo: youngcareLogo },
  ].filter((g): g is { label: string; logo: HTMLImageElement } => Boolean(g))
  if (groups.length === 0) return

  const logoH = Math.round(h * 0.05)
  const labelSize = Math.max(11, Math.round(h * 0.02))
  const labelGap = Math.round(h * 0.012)
  const groupGap = Math.round(w * 0.045)
  const bottom = Math.round(h * 0.955)

  ctx.font = `600 ${labelSize}px ${FONT_FAMILY}`
  setLetterSpacing(ctx, 1)

  const widths = groups.map(({ label, logo }) => {
    const { w: nw, h: nh } = naturalSize(logo)
    return Math.max(ctx.measureText(label).width, nw * (logoH / nh))
  })
  const totalW =
    widths.reduce((a, b) => a + b, 0) + groupGap * (groups.length - 1)
  let x = (w - totalW) / 2

  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  ctx.shadowColor = 'rgba(0,0,0,0.85)'
  ctx.shadowBlur = Math.round(h * 0.01)
  ctx.shadowOffsetY = Math.round(h * 0.004)

  groups.forEach(({ label, logo }, i) => {
    const gw = widths[i]
    ctx.fillText(label, x + gw / 2, bottom - logoH - labelGap)
    const { w: nw, h: nh } = naturalSize(logo)
    const logoW = nw * (logoH / nh)
    ctx.drawImage(logo, x + (gw - logoW) / 2, bottom - logoH, logoW, logoH)
    x += gw + groupGap
  })

  setLetterSpacing(ctx, 0)
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
  drawTextPlate(ctx, w / 2, h * 0.48, w * 0.42, h * 0.26)
  drawCornerLogos(ctx, w, h, content)

  const centerX = w / 2
  const maxTextW = Math.round(w * 0.82)
  const bandName = content.bandName.trim()
  const eventName = content.eventName.trim()
  // Date and venue only — the exact time isn't meaningful on a title card.
  const dateVenue = [content.eventDate.trim(), content.eventVenue.trim()]
    .filter(Boolean)
    .join('  ·  ')

  setTextStyle(ctx, h)
  let baseline = Math.round(h * 0.4)

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
    baseline += Math.round(h * 0.035)
    drawAccentRule(ctx, centerX, baseline, w * 0.06, Math.round(h * 0.004))
    baseline += Math.round(h * 0.035)
  }

  if (eventName) {
    const size = fitFont(ctx, eventName, 600, Math.round(h * 0.048), maxTextW)
    ctx.font = `600 ${size}px ${FONT_FAMILY}`
    const priorFill = ctx.fillStyle
    ctx.fillStyle = ACCENT_COLOR
    baseline += size * 1.2
    ctx.fillText(eventName, centerX, baseline)
    ctx.fillStyle = priorFill
  }

  if (dateVenue) {
    const size = fitFont(ctx, dateVenue, 500, Math.round(h * 0.034), maxTextW)
    ctx.font = `500 ${size}px ${FONT_FAMILY}`
    const priorFill = ctx.fillStyle
    ctx.fillStyle = 'rgba(255,255,255,0.82)'
    baseline += size * 1.5
    ctx.fillText(dateVenue, centerX, baseline)
    ctx.fillStyle = priorFill
  }

  resetTextStyle(ctx)
  drawSponsorRow(ctx, w, h, content.partnerLogo, content.youngcareLogo)
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
  drawTextPlate(ctx, w / 2, h * 0.52, w * 0.4, h * 0.4)
  drawCornerLogos(ctx, w, h, content)

  const centerX = w / 2
  const maxTextW = Math.round(w * 0.82)
  const bandName = content.bandName.trim()
  const members = content.members.map((m) => m.trim()).filter(Boolean)
  const parsed = members.map(parseMemberLine)

  setTextStyle(ctx, h)
  let baseline = Math.round(h * 0.3)

  if (bandName) {
    const size = fitFont(ctx, bandName, 800, Math.round(h * 0.07), maxTextW)
    ctx.font = `800 ${size}px ${FONT_FAMILY}`
    baseline += size
    ctx.fillText(bandName, centerX, baseline)
    baseline += Math.round(size * 0.55)
  }

  const label = 'BAND MEMBERS'
  const labelSize = Math.max(12, Math.round(h * 0.024))
  ctx.font = `600 ${labelSize}px ${FONT_FAMILY}`
  ctx.fillStyle = ACCENT_COLOR
  setLetterSpacing(ctx, 2)
  baseline += labelSize * 1.4
  ctx.fillText(label, centerX, baseline)
  setLetterSpacing(ctx, 0)
  ctx.fillStyle = '#ffffff'
  baseline += Math.round(h * 0.05)

  if (parsed.length > 0) {
    // Roster entries with a role get ~1.7x the vertical space of a plain
    // name line (room for name + role stacked); shrink as the roster grows
    // so a long list still fits above the sponsor row / bottom margin.
    const bottomLimit =
      h * (content.partnerLogo || content.youngcareLogo ? 0.84 : 0.92)
    const availableH = Math.max(bottomLimit - baseline, h * 0.1)
    const weights = parsed.map((m) => (m.role ? 1.7 : 1))
    const totalWeight = weights.reduce((a, b) => a + b, 0)
    const unit = clamp(availableH / totalWeight, h * 0.028, h * 0.09)

    parsed.forEach(({ name, role }, i) => {
      const entryH = unit * weights[i]
      if (role) {
        const nameSize = fitFont(
          ctx,
          name,
          600,
          Math.round(entryH * 0.42),
          maxTextW
        )
        ctx.font = `600 ${nameSize}px ${FONT_FAMILY}`
        ctx.fillStyle = '#ffffff'
        baseline += entryH * 0.55
        ctx.fillText(name, centerX, baseline)

        const roleSize = fitFont(
          ctx,
          role,
          500,
          Math.round(entryH * 0.26),
          maxTextW
        )
        ctx.font = `500 ${roleSize}px ${FONT_FAMILY}`
        ctx.fillStyle = ACCENT_COLOR
        setLetterSpacing(ctx, 0.5)
        baseline += roleSize * 1.2
        ctx.fillText(role.toUpperCase(), centerX, baseline)
        setLetterSpacing(ctx, 0)
        baseline += entryH * 0.15
      } else {
        const nameSize = fitFont(
          ctx,
          name,
          500,
          Math.round(entryH * 0.55),
          maxTextW
        )
        ctx.font = `500 ${nameSize}px ${FONT_FAMILY}`
        ctx.fillStyle = '#ffffff'
        baseline += entryH * 0.75
        ctx.fillText(name, centerX, baseline)
        baseline += entryH * 0.25
      }
    })
  }

  resetTextStyle(ctx)
  drawSponsorRow(ctx, w, h, content.partnerLogo, content.youngcareLogo)
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
