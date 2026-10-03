/**
 * "Filmic" style for the full-set title and credits cards: quiet, tracked-out
 * uppercase type in the manner of a film's opening and closing titles, as an
 * alternative to the Classic overlays in `./compose.ts`. Pure canvas
 * composition, like the rest of this folder.
 *
 * - Title — an opaque black card (the edit fades it into the picture): a
 *   "presents" line, the band's own logo keyed to white, "from" + the company
 *   logo(s), and a "live at" line. No corner logos and no sponsor row.
 * - Credits — a transparent overlay meant to sit over a darkened, blurred final
 *   wide shot (optionally with that darkening baked in): band name, an optional
 *   role | name roster, a "recorded live at" line, and one centred logo row.
 *
 * The spec was drawn at 1920×1080, so every size below is that pixel value
 * times `s = h / 1080` and the layout renders identically at 4K or a preview.
 */

import {
  drawCover,
  drawLogoRow,
  fitContain,
  layoutLogoRow,
  type LogoSource,
  naturalSize,
} from '@/lib/canvas'
import {
  type CreditsMember,
  FONT_FAMILY,
  OV_H,
  OV_W,
  PV_H,
  PV_W,
} from './compose'
import { safeInsets } from '../video-safe-area'

/** Which look the set title and credits cards use. */
export type SetCardStyle = 'classic' | 'filmic'

/** Where and when the set was played, as printed on both cards. */
export interface FilmicPlace {
  /** e.g. "The Factory Theatre". */
  venue: string
  /** e.g. "Sydney" — see {@link cityFromEventName}. Skipped if the venue already names it. */
  city: string
  /** e.g. "23 October 2025" — see {@link filmicDate}. */
  date: string
}

export interface FilmicTitleContent extends FilmicPlace {
  /** Drawn as tracked type only when there is no band logo. */
  bandName: string
  /**
   * The band's own logo, ideally white on transparent already (see
   * `keyOpaqueLogo` in `@/lib/canvas`) — it is drawn as supplied.
   */
  bandLogo?: LogoSource | null
  /** Every company behind the band, in full colour, trimmed. */
  companyLogos: LogoSource[]
}

export interface FilmicCreditsContent extends FilmicPlace {
  bandName: string
  /** Shown in the order given; entries with a blank `name` are ignored. */
  members: CreditsMember[]
  /** Off, or on with no named members, gives the sponsors-and-venue variant. */
  showMembers: boolean
  /** Bake a full-frame dark scrim into the PNG (default on in the UI). */
  scrim: boolean
  companyLogos: LogoSource[]
  /** White horizontal Bottb wordmark (`bottb-horizontal.png`). */
  bottbLogo: LogoSource | null
  /** National-partner "Powered by" logo. */
  partnerLogo?: LogoSource | null
  /** Youngcare "Supporting" logo. */
  youngcareLogo?: LogoSource | null
}

/** Full-frame darkening baked into the credits PNG when `scrim` is on. */
const SCRIM = 'rgba(0,0,0,0.66)'

const white = (alpha: number) => `rgba(255,255,255,${alpha})`

/**
 * The city from an event name that carries no city field of its own:
 * "Sydney 2025" → "Sydney". Drops any four-digit year.
 */
export function cityFromEventName(eventName: string): string {
  return eventName
    .replace(/\b(19|20)\d{2}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * A date label in the cards' "D Month YYYY" form: drops a trailing
 * "@ 6:30PM" time and ordinal suffixes ("23rd October 2025" → "23 October 2025").
 */
export function filmicDate(label: string): string {
  return label
    .replace(/\s*@\s*\d{1,2}:\d{2}\s*[AaPp]\.?[Mm]\.?$/, '')
    .replace(/\b(\d{1,2})(st|nd|rd|th)\b/gi, '$1')
    .trim()
}

/** The venue, plus the city when the venue text does not already name it. */
function venueWithCity(venue: string, city: string, joiner: string): string {
  const v = venue.trim()
  const c = city.trim()
  if (!v) return c
  if (!c || v.toLowerCase().includes(c.toLowerCase())) return v
  return `${v}${joiner}${c}`
}

const DOT = '  ·  '

/** "LIVE AT <VENUE>  ·  <CITY>  ·  <DATE>" for the title card. */
function liveLine({ venue, city, date }: FilmicPlace): string {
  const place = venue.trim()
    ? `Live at ${venueWithCity(venue, city, DOT)}`
    : city.trim()
      ? `Live in ${city.trim()}`
      : ''
  return [place, date.trim()].filter(Boolean).join(DOT).toUpperCase()
}

/** "RECORDED LIVE AT <VENUE>, <CITY>  ·  <DATE>" for the credits card. */
function recordedLine({ venue, city, date }: FilmicPlace): string {
  const place = venueWithCity(venue, city, ', ')
  return [place && `Recorded live at ${place}`, date.trim()]
    .filter(Boolean)
    .join(DOT)
    .toUpperCase()
}

// --- Tracked type ------------------------------------------------------------

type SpacedContext = CanvasRenderingContext2D & { letterSpacing?: string }

/** Native `ctx.letterSpacing` (Chrome, Firefox, Safari 18, @napi-rs/canvas). */
function supportsLetterSpacing(ctx: CanvasRenderingContext2D): boolean {
  return 'letterSpacing' in ctx
}

/** Width of the inked text at `tracking` px between letters (no trailing gap). */
function trackedWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  tracking: number
): number {
  if (!text) return 0
  const c = ctx as SpacedContext
  if (supportsLetterSpacing(ctx)) {
    c.letterSpacing = `${tracking}px`
    const width = ctx.measureText(text).width - tracking
    c.letterSpacing = '0px'
    return width
  }
  return ctx.measureText(text).width + tracking * ([...text].length - 1)
}

/**
 * Draw `text` with `tracking` px between letters, aligned on `x`. Uses the
 * native `letterSpacing` where there is one; it adds the gap after every glyph,
 * the last included, so the anchor shifts by that trailing gap to keep the ink
 * itself centred or flush. Elsewhere it falls back to one glyph at a time.
 */
function drawTracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  tracking: number,
  align: 'left' | 'center' | 'right' = 'center'
): void {
  if (!text) return
  if (supportsLetterSpacing(ctx)) {
    const c = ctx as SpacedContext
    c.letterSpacing = `${tracking}px`
    ctx.textAlign = align
    const shift =
      align === 'center' ? tracking / 2 : align === 'right' ? tracking : 0
    ctx.fillText(text, x + shift, y)
    c.letterSpacing = '0px'
    return
  }
  const width = trackedWidth(ctx, text, tracking)
  let cursor =
    align === 'center' ? x - width / 2 : align === 'right' ? x - width : x
  ctx.textAlign = 'left'
  for (const ch of text) {
    ctx.fillText(ch, cursor, y)
    cursor += ctx.measureText(ch).width + tracking
  }
}

interface TrackedStyle {
  weight: number
  /** Font size in px at the current frame size. */
  size: number
  /** Letter-spacing in px at the current frame size. */
  tracking: number
}

/**
 * Set the font and, if the text is wider than `maxW`, shrink size and tracking
 * together (down to `minScale` of the design size) until it fits.
 */
function fitTracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  { weight, size, tracking }: TrackedStyle,
  maxW: number,
  minScale = 0.6
): TrackedStyle {
  let scale = 1
  const apply = () => {
    ctx.font = `${weight} ${Math.round(size * scale)}px ${FONT_FAMILY}`
  }
  apply()
  while (scale > minScale && trackedWidth(ctx, text, tracking * scale) > maxW) {
    scale -= 0.04
    apply()
  }
  return { weight, size: Math.round(size * scale), tracking: tracking * scale }
}

/** Fit, colour and draw one line of tracked type. */
function drawTrackedLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  style: TrackedStyle,
  alpha: number,
  maxW: number,
  align: 'left' | 'center' | 'right' = 'center'
): void {
  if (!text) return
  const fitted = fitTracked(ctx, text, style, maxW)
  ctx.fillStyle = white(alpha)
  drawTracked(ctx, text, x, y, fitted.tracking, align)
}

function resetEffects(ctx: CanvasRenderingContext2D): void {
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0
  ctx.textBaseline = 'alphabetic'
}

// --- Title -------------------------------------------------------------------

/** Exactly what the opening card says above the band logo. */
export const PRESENTS_LINE = 'BATTLE OF THE TECH BANDS PRESENTS'

function drawFilmicTitle(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  content: FilmicTitleContent
): void {
  const s = h / 1080
  const cx = w / 2
  const maxTextW = w - safeInsets(w, h).x * 2
  resetEffects(ctx)

  drawTrackedLine(
    ctx,
    PRESENTS_LINE,
    cx,
    h * 0.34,
    { weight: 400, size: 22 * s, tracking: 8 * s },
    0.7,
    maxTextW
  )

  // The hero: the band's logo in a box ~0.195 H tall from 0.385 H, centred in
  // that box when it is width-limited; otherwise the name, set large.
  const boxTop = h * 0.385
  const boxH = h * 0.195
  const bandLogo = content.bandLogo ?? null
  if (bandLogo) {
    const { w: nw, h: nh } = naturalSize(bandLogo)
    const fit = fitContain(nw, nh, w * 0.5, boxH)
    ctx.drawImage(
      bandLogo,
      cx - fit.w / 2,
      boxTop + (boxH - fit.h) / 2,
      fit.w,
      fit.h
    )
  } else {
    const name = content.bandName.trim().toUpperCase()
    if (name) {
      const fitted = fitTracked(
        ctx,
        name,
        { weight: 500, size: 76 * s, tracking: 14 * s },
        maxTextW,
        0.5
      )
      ctx.fillStyle = white(0.95)
      // Cap height is ~0.7 em in Jost, so this centres the caps in the box.
      drawTracked(
        ctx,
        name,
        cx,
        boxTop + boxH / 2 + fitted.size * 0.35,
        fitted.tracking
      )
    }
  }

  if (content.companyLogos.length > 0) {
    drawTrackedLine(
      ctx,
      'FROM',
      cx,
      h * 0.64,
      { weight: 400, size: 18 * s, tracking: 9 * s },
      0.65,
      maxTextW
    )
    const logoH = h * 0.06
    drawLogoRow(ctx, content.companyLogos, {
      x: cx,
      align: 'center',
      centerY: h * 0.66 + logoH / 2,
      maxW: w * 0.4,
      maxH: logoH,
      gap: 48 * s,
    })
  }

  drawTrackedLine(
    ctx,
    liveLine(content),
    cx,
    h * 0.8,
    { weight: 300, size: 21 * s, tracking: 4.5 * s },
    0.6,
    maxTextW
  )
}

/**
 * Render the Filmic opening card onto a `w`×`h` canvas (default 4K). Opaque
 * black — the edit dissolves it into the first shot.
 */
export function composeFilmicTitle(
  ctx: CanvasRenderingContext2D,
  content: FilmicTitleContent,
  w: number = OV_W,
  h: number = OV_H
): void {
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, w, h)
  drawFilmicTitle(ctx, w, h, content)
}

/** The title card is opaque, so its preview is simply the card. */
export function composeFilmicTitlePreview(
  ctx: CanvasRenderingContext2D,
  content: FilmicTitleContent,
  w: number = PV_W,
  h: number = PV_H
): void {
  composeFilmicTitle(ctx, content, w, h)
}

// --- Credits -----------------------------------------------------------------

interface RowItem {
  logos: LogoSource[]
  /** Drawn width / height of the logo (or the company group). */
  logoW: number
  logoH: number
  caption?: string
  /** Overall slot width: the wider of the logo and its caption. */
  width: number
}

/** The credits' logo row: company | Bottb | Powered by | Supporting. */
function layoutCreditsRow(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  content: FilmicCreditsContent,
  captionStyle: TrackedStyle
): { items: RowItem[]; gap: number; scale: number } {
  const s = h / 1080
  const items: RowItem[] = []
  const single = (logo: LogoSource, height: number, caption?: string) => {
    const { w: nw, h: nh } = naturalSize(logo)
    const box = fitContain(nw, nh, w * 0.16, height)
    ctx.font = `${captionStyle.weight} ${captionStyle.size}px ${FONT_FAMILY}`
    const captionW = caption
      ? trackedWidth(ctx, caption, captionStyle.tracking)
      : 0
    items.push({
      logos: [logo],
      logoW: box.w,
      logoH: box.h,
      caption,
      width: Math.max(box.w, captionW),
    })
  }

  if (content.companyLogos.length > 0) {
    const row = layoutLogoRow(content.companyLogos, {
      maxW: w * 0.26,
      maxH: h * 0.055,
      gap: 40 * s,
    })
    items.push({
      logos: content.companyLogos,
      logoW: row.width,
      logoH: row.height,
      width: row.width,
    })
  }
  if (content.bottbLogo) single(content.bottbLogo, h * 0.069)
  if (content.partnerLogo) single(content.partnerLogo, h * 0.05, 'POWERED BY')
  if (content.youngcareLogo) {
    single(content.youngcareLogo, h * 0.052, 'SUPPORTING')
  }

  // Shrink logos and gaps together if the row would overrun the safe width.
  const gap = 110 * s
  const total =
    items.reduce((sum, item) => sum + item.width, 0) +
    gap * Math.max(0, items.length - 1)
  const maxW = w - safeInsets(w, h).x * 2
  const scale = total > maxW ? maxW / total : 1
  return { items, gap: gap * scale, scale }
}

/** Gap from a captioned logo's top to its caption's baseline, at 1080p. */
const CAPTION_GAP = 15

/** Space the credits' logo row needs above and below its centre line. */
function creditsRowExtent(
  items: RowItem[],
  scale: number,
  s: number,
  captionSize: number
): { above: number; below: number } {
  const half = Math.max(0, ...items.map((i) => (i.logoH * scale) / 2))
  const captioned = items.filter((i) => i.caption)
  const captionHalf = Math.max(
    0,
    ...captioned.map((i) => (i.logoH * scale) / 2)
  )
  return {
    above: captioned.length
      ? Math.max(half, captionHalf + CAPTION_GAP * s + captionSize * 0.7)
      : half,
    below: half,
  }
}

function drawCreditsRow(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  centerY: number,
  { items, gap, scale }: ReturnType<typeof layoutCreditsRow>,
  captionStyle: TrackedStyle
): void {
  if (items.length === 0) return
  const s = h / 1080
  const total =
    items.reduce((sum, item) => sum + item.width * scale, 0) +
    gap * (items.length - 1)
  // Captions share one baseline, set by the tallest captioned logo.
  const captionHalf = Math.max(
    0,
    ...items.filter((i) => i.caption).map((i) => (i.logoH * scale) / 2)
  )
  const captionY = centerY - captionHalf - CAPTION_GAP * s

  let x = (w - total) / 2
  for (const item of items) {
    const slotW = item.width * scale
    const mid = x + slotW / 2
    if (item.logos.length > 1) {
      drawLogoRow(ctx, item.logos, {
        x: mid,
        align: 'center',
        centerY,
        maxW: item.logoW * scale,
        maxH: item.logoH * scale,
        gap: 40 * s * scale,
      })
    } else {
      const lw = item.logoW * scale
      const lh = item.logoH * scale
      ctx.drawImage(item.logos[0], mid - lw / 2, centerY - lh / 2, lw, lh)
    }
    if (item.caption) {
      ctx.font = `${captionStyle.weight} ${captionStyle.size}px ${FONT_FAMILY}`
      ctx.fillStyle = white(0.55)
      drawTracked(ctx, item.caption, mid, captionY, captionStyle.tracking)
    }
    x += slotW + gap
  }
}

function drawFilmicCredits(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  content: FilmicCreditsContent
): void {
  const s = h / 1080
  const cx = w / 2
  const safe = safeInsets(w, h)
  const maxTextW = w - safe.x * 2
  resetEffects(ctx)

  const members = content.showMembers
    ? content.members
        .map((m) => ({ name: m.name.trim(), role: m.role?.trim() ?? '' }))
        .filter((m) => m.name)
    : []

  const nameStyle = { weight: 500, size: 30 * s, tracking: 8 * s }
  const recordedStyle = { weight: 300, size: 20 * s, tracking: 4 * s }
  const captionStyle = { weight: 400, size: 15 * s, tracking: 4 * s }
  const row = layoutCreditsRow(ctx, w, h, content, captionStyle)
  const extent = creditsRowExtent(row.items, row.scale, s, captionStyle.size)

  // Vertical rhythm, from the approved mockup at 1080p: the "recorded" line
  // sits ~128 px below the last member row, and the logo row's centre line
  // ~153 px below that.
  const recordedToRow = 153 * s
  let nameY: number
  let recordedY: number
  let rowY: number
  let rowGap = 50 * s
  const firstRowY = h * 0.272

  if (members.length > 0) {
    nameY = h * 0.17
    const lowestRowY = h - safe.bottom - extent.below
    // Squeeze the roster (rows and type together) if it would push the logo
    // row below the bottom safe margin.
    const maxLast = lowestRowY - recordedToRow - 128 * s
    if (members.length > 1) {
      rowGap = Math.min(rowGap, (maxLast - firstRowY) / (members.length - 1))
    }
    const lastY = firstRowY + rowGap * (members.length - 1)
    recordedY = Math.max(h * 0.613, lastY + rowGap * 2.56)
    rowY = recordedY + recordedToRow
  } else {
    // Sponsors-and-venue only: the same three elements, re-centred as a block
    // so the card does not sit empty at the top.
    const nameToRecorded = 110 * s
    const capH = nameStyle.size * 0.7
    const blockH =
      capH +
      nameToRecorded +
      recordedToRow +
      (row.items.length ? extent.below : 0)
    const top = (h - blockH) / 2
    nameY = top + capH
    recordedY = nameY + nameToRecorded
    rowY = recordedY + recordedToRow
  }

  drawTrackedLine(
    ctx,
    content.bandName.trim().toUpperCase(),
    cx,
    nameY,
    nameStyle,
    0.92,
    maxTextW
  )

  if (members.length > 0) {
    const typeScale = Math.min(1, rowGap / (50 * s))
    const gutter = 22 * s
    const halfW = cx - gutter - safe.x
    const anyRole = members.some((m) => m.role)
    members.forEach((member, i) => {
      const y = firstRowY + rowGap * i
      if (anyRole && member.role) {
        drawTrackedLine(
          ctx,
          member.role.toUpperCase(),
          cx - gutter,
          y,
          {
            weight: 400,
            size: 19 * s * typeScale,
            tracking: 4 * s * typeScale,
          },
          0.55,
          halfW,
          'right'
        )
      }
      drawTrackedLine(
        ctx,
        member.name,
        anyRole ? cx + gutter : cx,
        y,
        { weight: 400, size: 30 * s * typeScale, tracking: 0 },
        0.95,
        anyRole ? halfW : maxTextW,
        anyRole ? 'left' : 'center'
      )
    })
  }

  drawTrackedLine(
    ctx,
    recordedLine(content),
    cx,
    recordedY,
    recordedStyle,
    0.7,
    maxTextW
  )

  drawCreditsRow(ctx, w, h, rowY, row, captionStyle)
}

/**
 * Render the Filmic closing credits onto a transparent `w`×`h` canvas
 * (default 4K), with the dark scrim baked in when `content.scrim` is set.
 */
export function composeFilmicCredits(
  ctx: CanvasRenderingContext2D,
  content: FilmicCreditsContent,
  w: number = OV_W,
  h: number = OV_H
): void {
  ctx.clearRect(0, 0, w, h)
  if (content.scrim) {
    ctx.fillStyle = SCRIM
    ctx.fillRect(0, 0, w, h)
  }
  drawFilmicCredits(ctx, w, h, content)
}

/**
 * Preview the credits as they will sit in the edit: the reference frame,
 * blurred where the browser supports canvas filters, under the overlay.
 */
export function composeFilmicCreditsPreview(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource | null,
  sourceW: number,
  sourceH: number,
  content: FilmicCreditsContent,
  w: number = PV_W,
  h: number = PV_H
): void {
  ctx.clearRect(0, 0, w, h)
  if (source) {
    const blurred = 'filter' in ctx
    if (blurred) ctx.filter = `blur(${Math.round(h * 0.012)}px)`
    drawCover(ctx, source, sourceW, sourceH, 0, 0, w, h)
    if (blurred) ctx.filter = 'none'
  } else {
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(0, 0, w, h)
  }
  if (content.scrim) {
    ctx.fillStyle = SCRIM
    ctx.fillRect(0, 0, w, h)
  }
  drawFilmicCredits(ctx, w, h, content)
}
