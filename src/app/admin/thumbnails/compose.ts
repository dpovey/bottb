/**
 * Pure canvas composition for social thumbnails. No React / DOM-framework code
 * here so the layout maths stays easy to reason about and test.
 *
 * - Landscape (YouTube / LinkedIn): 1920×1080, frame + brand overlays
 *   (logos + artist/song text).
 * - Vertical (Instagram/Facebook Reel, Stories, vertical LinkedIn): 1080×1920,
 *   clean frame, no overlays — either filled (cropped) or fitted (letterboxed).
 */

import {
  drawCover,
  drawLogoRow,
  fitContain,
  wrapLines,
  type LogoSource,
} from '@/lib/canvas'
import { MIN_TYPE, safeInsets } from '../video-safe-area'

export type LogoCorner = 'top-left' | 'top-right'

/** How a vertical frame handles a source of a different aspect ratio. */
export type InstagramMode = 'fill' | 'fit'

export const YT_W = 1920
export const YT_H = 1080
export const IG_W = 1080
export const IG_H = 1920

/** Family is registered by {@link import('./jost-font').loadJostFont}. */
const FONT_FAMILY = "'Jost', system-ui, sans-serif"

export interface ThumbnailContent {
  /** The act being credited — normally the song's original artist. */
  artist: string
  song: string
  /**
   * The particular version performed, when the band is covering someone
   * else's cover (e.g. artist "Sabrina Carpenter", version "Good Neighbours
   * version"). Drawn small and dim under the artist; omit when there is only
   * one act to credit.
   */
  version?: string
  /** Square Bottb logo (black tile), already loaded. */
  bottbLogo: HTMLImageElement | null
  /**
   * Every company behind the band, already loaded (may be wide or tall),
   * ideally trimmed of transparent padding ({@link trimTransparent}).
   * Multi-company bands (e.g. ShipReX = Rex Software + URBAN X) get all of
   * them side by side; most bands have one.
   */
  companyLogos: LogoSource[]
  /** Which corner the Bottb square sits in; the company logos take the other. */
  bottbCorner: LogoCorner
}

type Source = CanvasImageSource

/**
 * Draw just the brand adornments — the two logos across the top and the
 * artist + song bottom-left — scaled to a `w`×`h` 16:9 area. Everything is
 * proportional to the frame, so this renders identically at any resolution.
 * Used by both the YouTube thumbnail and the transparent intro overlay.
 *
 * Margins come from `../video-safe-area`: the sides are a fraction of *width*
 * (so they aren't squashed on a 16:9 frame) and the bottom is deeper than the
 * top so the artist/song block clears the YouTube control bar.
 */
function drawAdornments(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  content: ThumbnailContent
): void {
  const safe = safeInsets(w, h)

  // --- Logos -----------------------------------------------------------------
  const bottbSize = Math.round(h * 0.17)
  const centerY = safe.top + bottbSize / 2
  const bottbOnRight = content.bottbCorner === 'top-right'

  if (content.bottbLogo) {
    const x = bottbOnRight ? w - safe.x - bottbSize : safe.x
    ctx.drawImage(content.bottbLogo, x, safe.top, bottbSize, bottbSize)
  }

  // Company logos take the opposite corner, vertically centred on the square.
  // One logo gets the usual 26% of the width; a multi-company row may spread
  // to 40% before it is shrunk.
  const single = content.companyLogos.length === 1
  drawLogoRow(ctx, content.companyLogos, {
    x: bottbOnRight ? safe.x : w - safe.x,
    align: bottbOnRight ? 'left' : 'right',
    centerY,
    maxW: Math.round(w * (single ? 0.26 : 0.4)),
    maxH: Math.round(h * 0.14),
    gap: Math.round(w * 0.02),
  })

  // --- Text (artist + song) --------------------------------------------------
  const artist = content.artist.trim()
  const song = content.song.trim()
  const maxTextW = w - safe.x * 2

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.shadowColor = 'rgba(0,0,0,0.85)'
  ctx.shadowBlur = Math.round(h * 0.014)
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = Math.round(h * 0.006)
  ctx.fillStyle = '#ffffff'

  // The block is drawn bottom-up from the bottom safe margin, so it always
  // sits on that margin however many lines the artist needs. Visually, top to
  // bottom, that reads: artist, version, song.
  let baseline = h - safe.bottom

  if (song) {
    const size = fitFont(
      ctx,
      song,
      500,
      Math.round(h * 0.078),
      maxTextW,
      Math.round(h * MIN_TYPE.primary)
    )
    ctx.font = `500 ${size}px ${FONT_FAMILY}`
    ctx.fillText(song, safe.x, baseline)
    baseline -= size * 1.25
  }

  const version = content.version?.trim()
  if (version) {
    const size = fitFont(
      ctx,
      version,
      500,
      Math.round(h * 0.048),
      maxTextW,
      Math.round(h * MIN_TYPE.label)
    )
    ctx.font = `500 ${size}px ${FONT_FAMILY}`
    const priorFill = ctx.fillStyle
    ctx.fillStyle = 'rgba(255,255,255,0.78)'
    ctx.fillText(version, safe.x, baseline)
    ctx.fillStyle = priorFill
    baseline -= size * 1.5
  }

  if (artist) {
    const { size, lines } = fitArtist(ctx, artist, h, maxTextW)
    ctx.font = `700 ${size}px ${FONT_FAMILY}`
    for (let i = lines.length - 1; i >= 0; i--) {
      ctx.fillText(lines[i], safe.x, baseline)
      baseline -= size * 1.12
    }
  }

  // Reset shadow so callers aren't surprised.
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0
}

/**
 * Render the YouTube thumbnail (1920×1080) into `ctx`. The frame is drawn
 * centre-cropped to 16:9, with top/bottom scrims for legibility, the two logos
 * across the top, and the artist + song bottom-left in white with a drop shadow.
 */
export function composeYouTube(
  ctx: CanvasRenderingContext2D,
  source: Source | null,
  sourceW: number,
  sourceH: number,
  content: ThumbnailContent
): void {
  ctx.clearRect(0, 0, YT_W, YT_H)

  // Background frame (or flat fill if no video yet).
  if (source) {
    drawCover(ctx, source, sourceW, sourceH, 0, 0, YT_W, YT_H)
  } else {
    ctx.fillStyle = '#0a0a0a'
    ctx.fillRect(0, 0, YT_W, YT_H)
  }

  // Top scrim — keeps logos readable over bright frames.
  const top = ctx.createLinearGradient(0, 0, 0, YT_H * 0.3)
  top.addColorStop(0, 'rgba(0,0,0,0.45)')
  top.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = top
  ctx.fillRect(0, 0, YT_W, YT_H * 0.3)

  // Bottom scrim — keeps the artist/song text readable.
  const bottom = ctx.createLinearGradient(0, YT_H * 0.45, 0, YT_H)
  bottom.addColorStop(0, 'rgba(0,0,0,0)')
  bottom.addColorStop(1, 'rgba(0,0,0,0.8)')
  ctx.fillStyle = bottom
  ctx.fillRect(0, YT_H * 0.45, YT_W, YT_H * 0.55)

  drawAdornments(ctx, YT_W, YT_H, content)
}

/** 4K (UHD) overlay canvas — 16:9, matches the YouTube layout proportions. */
export const OV_W = 3840
export const OV_H = 2160

/**
 * Render just the adornments (logos + artist/song) onto a transparent 16:9
 * canvas, sized `w`×`h` (defaults to 4K). No frame, no scrims — intended to be
 * exported as a PNG and composited over the start of a video.
 */
export function composeOverlay(
  ctx: CanvasRenderingContext2D,
  content: ThumbnailContent,
  w: number = OV_W,
  h: number = OV_H
): void {
  ctx.clearRect(0, 0, w, h)
  drawAdornments(ctx, w, h, content)
}

/**
 * Size and break the artist line.
 *
 * A name that only just overruns should tighten up rather than break, so this
 * first tries to hold one line, shrinking by up to a fifth. Past that it falls
 * back to two lines and keeps shrinking, never below the hero floor in
 * `MIN_TYPE` — beyond that point a name is better slightly wide than
 * unreadable at thumbnail scale.
 */
function fitArtist(
  ctx: CanvasRenderingContext2D,
  artist: string,
  h: number,
  maxWidth: number
): { size: number; lines: string[] } {
  const start = Math.round(h * 0.125)
  const floor = Math.round(h * MIN_TYPE.hero)

  // Shrink a little to try to hold a single line.
  const oneLine = fitFont(
    ctx,
    artist,
    700,
    start,
    maxWidth,
    Math.max(floor, Math.round(start * 0.8))
  )
  ctx.font = `700 ${oneLine}px ${FONT_FAMILY}`
  if (ctx.measureText(artist).width <= maxWidth) {
    return { size: oneLine, lines: [artist] }
  }

  // Still too wide: allow two lines, measured against the wider box they span.
  const size = fitFont(ctx, artist, 700, oneLine, maxWidth * 1.9, floor)
  ctx.font = `700 ${size}px ${FONT_FAMILY}`
  return { size, lines: wrapLines(ctx, artist, maxWidth, 2) }
}

/**
 * Shrink the font size until the text fits `maxWidth`, but never below
 * `minSize` — a very long name is better slightly wide than unreadable at
 * thumbnail scale (see `MIN_TYPE` in `../video-safe-area`).
 */
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

export interface InstagramOptions {
  /** Focal point for `fill` cropping (0..1 on each axis). */
  focusX?: number
  focusY?: number
  /**
   * `fill` (default) crops the frame to cover the 9:16 box at the focal point.
   * `fit` letterboxes the whole frame over a blurred fill — used when a
   * landscape clip shouldn't be cropped. A vertical source fills the box
   * naturally, so `fill` leaves it untouched.
   */
  mode?: InstagramMode
}

/**
 * Render the vertical 1080×1920 thumbnail (Instagram/Facebook Reel, Stories,
 * vertical LinkedIn): a clean frame with no overlays.
 */
export function composeInstagram(
  ctx: CanvasRenderingContext2D,
  source: Source | null,
  sourceW: number,
  sourceH: number,
  { focusX = 0.5, focusY = 0.5, mode = 'fill' }: InstagramOptions = {}
): void {
  ctx.clearRect(0, 0, IG_W, IG_H)

  if (!source) {
    ctx.fillStyle = '#0a0a0a'
    ctx.fillRect(0, 0, IG_W, IG_H)
    return
  }

  if (mode === 'fit') {
    // Blurred, slightly-overscanned cover behind the fitted frame so the bars
    // read as a soft backdrop rather than hard black.
    ctx.save()
    ctx.filter = 'blur(48px)'
    drawCover(ctx, source, sourceW, sourceH, 0, 0, IG_W, IG_H, 0.5, 0.5)
    ctx.restore()
    ctx.fillStyle = 'rgba(0,0,0,0.3)'
    ctx.fillRect(0, 0, IG_W, IG_H)

    const { w, h } = fitContain(sourceW, sourceH, IG_W, IG_H)
    ctx.drawImage(source, (IG_W - w) / 2, (IG_H - h) / 2, w, h)
    return
  }

  drawCover(ctx, source, sourceW, sourceH, 0, 0, IG_W, IG_H, focusX, focusY)
}
