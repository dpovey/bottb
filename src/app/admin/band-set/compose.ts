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

import { drawCover, fitContain, naturalSize, wrapLines } from '@/lib/canvas'
import { OV_H, OV_W } from '../thumbnails/compose'
import { MIN_TYPE, safeInsets } from '../video-safe-area'

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

export interface CreditsMember {
  name: string
  /** e.g. "Vocals", "Guitar" — optional. */
  role?: string
}

export interface CreditsContent extends BrandLogos {
  bandName: string
  /** Entries with a blank `name` are ignored. */
  members: CreditsMember[]
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

/** Height of the Bottb square as a fraction of the frame height. */
const LOGO_H = 0.17

/**
 * Draw the Bottb square in `bottbCorner` and the company logo in the
 * opposite corner, vertically centred on the square. Inset by the shared
 * safe-area margins so neither logo hangs off the edge of a cropped or
 * overscanned frame.
 */
function drawCornerLogos(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  { bottbLogo, companyLogo, bottbCorner }: BrandLogos
): void {
  const safe = safeInsets(w, h)
  const bottbSize = Math.round(h * LOGO_H)
  const centerY = safe.top + bottbSize / 2
  const bottbOnRight = bottbCorner === 'top-right'

  if (bottbLogo) {
    const x = bottbOnRight ? w - safe.x - bottbSize : safe.x
    ctx.drawImage(bottbLogo, x, safe.top, bottbSize, bottbSize)
  }

  if (companyLogo) {
    const { w: nw, h: nh } = naturalSize(companyLogo)
    const fitted = fitContain(
      nw,
      nh,
      Math.round(w * 0.26),
      Math.round(h * 0.14)
    )
    const x = bottbOnRight ? safe.x : w - safe.x - fitted.w
    const y = centerY - fitted.h / 2
    ctx.drawImage(companyLogo, x, y, fitted.w, fitted.h)
  }
}

/** Sponsor-row metrics, as fractions of the frame height. */
const SPONSOR_LOGO_H = 0.055
const SPONSOR_LABEL_H = 0.026
const SPONSOR_LABEL_GAP = 0.012
/** Total height the sponsor row occupies, as a fraction of the frame height. */
const SPONSOR_BLOCK_H = SPONSOR_LOGO_H + SPONSOR_LABEL_GAP + SPONSOR_LABEL_H

/**
 * The band of the frame available for centred copy: below the corner logos and
 * above the sponsor row (or the bottom safe margin when there are no sponsors).
 * Both pages measure their text block and centre it in here, so growing the
 * type doesn't push the copy down into the player's control bar.
 */
function contentRegion(
  w: number,
  h: number,
  hasSponsors: boolean
): { top: number; bottom: number } {
  const safe = safeInsets(w, h)
  return {
    top: safe.top + Math.round(h * LOGO_H) + Math.round(h * 0.035),
    bottom:
      h -
      safe.bottom -
      (hasSponsors ? Math.round(h * (SPONSOR_BLOCK_H + 0.04)) : 0),
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

/** The last whitespace-separated token of a name, for surname sorting. */
function surnameOf(name: string): string {
  const parts = name.trim().split(/\s+/)
  return parts[parts.length - 1] ?? ''
}

/** Sort credits alphabetically by surname (last name), case-insensitively. */
function sortBySurname(members: CreditsMember[]): CreditsMember[] {
  return [...members].sort((a, b) =>
    surnameOf(a.name).localeCompare(surnameOf(b.name), undefined, {
      sensitivity: 'base',
    })
  )
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

  const logoH = Math.round(h * SPONSOR_LOGO_H)
  const labelSize = Math.max(11, Math.round(h * SPONSOR_LABEL_H))
  const labelGap = Math.round(h * SPONSOR_LABEL_GAP)
  const groupGap = Math.round(w * 0.045)
  // Sits on the bottom safe margin, clear of the YouTube control bar — the old
  // 0.955 baseline put these logos directly behind the scrubber.
  const bottom = h - safeInsets(w, h).bottom

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
  const centerX = w / 2
  const safe = safeInsets(w, h)
  const maxTextW = w - safe.x * 2
  const bandName = content.bandName.trim()
  const eventName = content.eventName.trim()
  // Date and venue only — the exact time isn't meaningful on a title card.
  const dateVenue = [content.eventDate.trim(), content.eventVenue.trim()]
    .filter(Boolean)
    .join('  ·  ')

  // --- Measure ---------------------------------------------------------------
  // Sizes are resolved up front so the whole stack can be centred in the
  // available band rather than growing downwards from a fixed baseline.
  const region = contentRegion(
    w,
    h,
    Boolean(content.partnerLogo || content.youngcareLogo)
  )

  let nameSize = bandName
    ? fitFont(
        ctx,
        bandName,
        800,
        Math.round(h * 0.145),
        // Allowed to measure against a wider box than it wraps to: at this
        // size a long name is expected to break over two lines.
        maxTextW * 1.6,
        Math.round(h * MIN_TYPE.hero)
      )
    : 0
  let nameLines: string[] = []
  if (bandName) {
    ctx.font = `800 ${nameSize}px ${FONT_FAMILY}`
    nameLines = wrapLines(ctx, bandName, maxTextW, 2)
    // A name that wraps to two lines can outgrow the region; the name
    // dominates the stack, so scaling it alone is enough to bring it back.
    if (nameLines.length > 1) {
      const overflow =
        nameLines.length * nameSize * 1.1 - (region.bottom - region.top) * 0.55
      if (overflow > 0) {
        nameSize = Math.max(
          Math.round(h * MIN_TYPE.hero),
          Math.round(nameSize - overflow / nameLines.length)
        )
        ctx.font = `800 ${nameSize}px ${FONT_FAMILY}`
        nameLines = wrapLines(ctx, bandName, maxTextW, 2)
      }
    }
  }
  const nameLineH = nameSize * 1.1

  const eventSize = eventName
    ? fitFont(
        ctx,
        eventName,
        600,
        Math.round(h * 0.058),
        maxTextW,
        Math.round(h * MIN_TYPE.primary)
      )
    : 0
  const dateSize = dateVenue
    ? fitFont(
        ctx,
        dateVenue,
        500,
        Math.round(h * 0.044),
        maxTextW,
        Math.round(h * MIN_TYPE.secondary)
      )
    : 0

  const ruleGap = Math.round(h * 0.035)
  const ruleH = Math.round(h * 0.005)
  const blockH =
    nameLines.length * nameLineH +
    (nameLines.length ? ruleGap * 2 + ruleH : 0) +
    (eventSize ? eventSize * 1.2 : 0) +
    (dateSize ? dateSize * 1.5 : 0)

  // --- Place -----------------------------------------------------------------
  const top = Math.max(region.top, (region.top + region.bottom - blockH) / 2)

  drawTextPlate(
    ctx,
    centerX,
    top + blockH / 2,
    w * 0.44,
    Math.max(h * 0.24, blockH * 0.78)
  )
  drawCornerLogos(ctx, w, h, content)

  // --- Draw ------------------------------------------------------------------
  setTextStyle(ctx, h)
  let baseline = top

  if (nameLines.length) {
    ctx.font = `800 ${nameSize}px ${FONT_FAMILY}`
    for (const line of nameLines) {
      baseline += nameLineH
      ctx.fillText(line, centerX, baseline)
    }
    baseline += ruleGap
    drawAccentRule(ctx, centerX, baseline, w * 0.06, ruleH)
    baseline += ruleGap
  }

  if (eventSize) {
    ctx.font = `600 ${eventSize}px ${FONT_FAMILY}`
    ctx.fillStyle = ACCENT_COLOR
    baseline += eventSize * 1.2
    ctx.fillText(eventName, centerX, baseline)
  }

  if (dateSize) {
    ctx.font = `500 ${dateSize}px ${FONT_FAMILY}`
    ctx.fillStyle = 'rgba(255,255,255,0.82)'
    baseline += dateSize * 1.5
    ctx.fillText(dateVenue, centerX, baseline)
  }

  resetTextStyle(ctx)
  drawSponsorRow(ctx, w, h, content.partnerLogo, content.youngcareLogo)
}

/**
 * Draw one member's name (+ optional role beneath it, in the accent colour)
 * centred at `centerX`, occupying `entryH` of vertical space starting at
 * `baseline`.
 */
function drawMemberEntry(
  ctx: CanvasRenderingContext2D,
  h: number,
  centerX: number,
  baseline: number,
  entryH: number,
  maxTextW: number,
  { name, role }: CreditsMember
): void {
  if (role) {
    const nameSize = fitFont(
      ctx,
      name,
      600,
      Math.round(entryH * 0.42),
      maxTextW,
      Math.round(h * MIN_TYPE.secondary)
    )
    ctx.font = `600 ${nameSize}px ${FONT_FAMILY}`
    ctx.fillStyle = '#ffffff'
    ctx.fillText(name, centerX, baseline + entryH * 0.55)

    const roleSize = fitFont(
      ctx,
      role,
      500,
      Math.round(entryH * 0.3),
      maxTextW,
      Math.round(h * MIN_TYPE.label)
    )
    ctx.font = `500 ${roleSize}px ${FONT_FAMILY}`
    ctx.fillStyle = ACCENT_COLOR
    setLetterSpacing(ctx, 0.5)
    ctx.fillText(
      role.toUpperCase(),
      centerX,
      baseline + entryH * 0.55 + roleSize * 1.2
    )
    setLetterSpacing(ctx, 0)
  } else {
    const nameSize = fitFont(
      ctx,
      name,
      500,
      Math.round(entryH * 0.55),
      maxTextW,
      Math.round(h * MIN_TYPE.secondary)
    )
    ctx.font = `500 ${nameSize}px ${FONT_FAMILY}`
    ctx.fillStyle = '#ffffff'
    ctx.fillText(name, centerX, baseline + entryH * 0.75)
  }
}

/** Weight a member entry: a role needs ~1.7x the vertical space of a bare name. */
function memberWeight(member: CreditsMember): number {
  return member.role ? 1.7 : 1
}

/** Stack a column of member entries starting at `startBaseline`. */
function drawMemberColumn(
  ctx: CanvasRenderingContext2D,
  h: number,
  centerX: number,
  startBaseline: number,
  maxTextW: number,
  members: CreditsMember[],
  unit: number
): void {
  let baseline = startBaseline
  for (const member of members) {
    const entryH = unit * memberWeight(member)
    drawMemberEntry(ctx, h, centerX, baseline, entryH, maxTextW, member)
    baseline += entryH
  }
}

/** Most columns worth splitting a roster across before names get too narrow. */
const MAX_COLUMNS = 3

/** Deal `members` into `count` balanced, top-to-bottom columns. */
function splitColumns(
  members: CreditsMember[],
  count: number
): CreditsMember[][] {
  const perColumn = Math.ceil(members.length / count)
  return Array.from({ length: count }, (_, i) =>
    members.slice(i * perColumn, (i + 1) * perColumn)
  ).filter((column) => column.length > 0)
}

/** The tallest column's weight — all columns share one line height. */
function tallestColumnWeight(columns: CreditsMember[][]): number {
  return Math.max(
    0,
    ...columns.map((column) =>
      column.reduce((sum, m) => sum + memberWeight(m), 0)
    )
  )
}

/**
 * Pick the fewest columns whose line height still clears `minUnit`. A single
 * centred list reads best, so we only go wide when staying narrow would push
 * the names below legible size — which is what a long single column used to
 * do. Past {@link MAX_COLUMNS} an unusually large roster shrinks instead.
 */
function chooseColumnCount(
  members: CreditsMember[],
  availableH: number,
  minUnit: number
): number {
  for (let count = 1; count < MAX_COLUMNS; count++) {
    const weight = tallestColumnWeight(splitColumns(members, count))
    if (weight === 0 || availableH / weight >= minUnit) return count
  }
  return MAX_COLUMNS
}

/**
 * Draw the credits-page adornments — corner logos, the band name as a
 * heading, and an auto-shrunk, surname-sorted list of member credits
 * (single centred column, or two columns once the roster gets long).
 */
function drawCreditsAdornments(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  content: CreditsContent
): void {
  const centerX = w / 2
  const safe = safeInsets(w, h)
  const maxTextW = w - safe.x * 2
  const bandName = content.bandName.trim()
  const members = sortBySurname(
    content.members
      .map((m) => ({ name: m.name.trim(), role: m.role?.trim() || undefined }))
      .filter((m) => m.name)
  )

  // --- Measure the heading ---------------------------------------------------
  const nameSize = bandName
    ? fitFont(
        ctx,
        bandName,
        800,
        Math.round(h * 0.08),
        maxTextW,
        Math.round(h * MIN_TYPE.hero)
      )
    : 0
  const label = 'FEATURING'
  const labelSize = Math.max(12, Math.round(h * 0.028))
  const labelGap = Math.round(h * 0.038)
  const headingH = (nameSize ? nameSize * 1.45 : 0) + labelSize * 1.4 + labelGap

  // --- Measure the member block ----------------------------------------------
  const region = contentRegion(
    w,
    h,
    Boolean(content.partnerLogo || content.youngcareLogo)
  )
  const availableH = Math.max(region.bottom - region.top - headingH, h * 0.1)
  // A role entry stacks a name over a role, so it needs ~1.7 units; `unit` is
  // the line height that entry weighting is measured in. The floor is the
  // smallest unit that still yields a legible name (0.42 × 1.7 × unit).
  const minUnit = h * 0.05
  const columns = splitColumns(
    members,
    chooseColumnCount(members, availableH, minUnit)
  )
  const columnCount = Math.max(columns.length, 1)
  const colWeight = tallestColumnWeight(columns)
  // Never exceed `availableH`: overshooting would run the roster into the
  // sponsor row, so an oversized roster shrinks past the floor instead.
  const unit = colWeight
    ? Math.min(availableH / colWeight, h * (columnCount > 1 ? 0.085 : 0.1))
    : 0
  const blockH = headingH + unit * colWeight

  // --- Place -----------------------------------------------------------------
  const top = Math.max(region.top, (region.top + region.bottom - blockH) / 2)

  drawTextPlate(
    ctx,
    centerX,
    top + blockH / 2,
    w * 0.44,
    Math.max(h * 0.3, blockH * 0.7)
  )
  drawCornerLogos(ctx, w, h, content)

  // --- Draw ------------------------------------------------------------------
  setTextStyle(ctx, h)
  let baseline = top

  if (nameSize) {
    ctx.font = `800 ${nameSize}px ${FONT_FAMILY}`
    baseline += nameSize
    ctx.fillText(bandName, centerX, baseline)
    baseline += nameSize * 0.55
  }

  ctx.font = `600 ${labelSize}px ${FONT_FAMILY}`
  ctx.fillStyle = ACCENT_COLOR
  setLetterSpacing(ctx, 2)
  baseline += labelSize * 1.4
  ctx.fillText(label, centerX, baseline)
  setLetterSpacing(ctx, 0)
  ctx.fillStyle = '#ffffff'
  baseline += labelGap

  // Each column takes an equal share of the safe width; names are centred in
  // their share, with a gutter kept clear between neighbours.
  const colW = maxTextW / columnCount
  const colTextW = Math.round(colW - w * 0.03)
  columns.forEach((column, i) => {
    drawMemberColumn(
      ctx,
      h,
      safe.x + colW * (i + 0.5),
      baseline,
      colTextW,
      column,
      unit
    )
  })

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
