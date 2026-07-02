/**
 * Pure canvas composition for social thumbnails. No React / DOM-framework code
 * here so the layout maths stays easy to reason about and test.
 *
 * - Landscape (YouTube / LinkedIn): 1920×1080, frame + brand overlays
 *   (logos + artist/song text).
 * - Vertical (Instagram/Facebook Reel, Stories, vertical LinkedIn): 1080×1920,
 *   clean frame, no overlays — either filled (cropped) or fitted (letterboxed).
 */

import { drawCover, fitContain, naturalSize } from '@/lib/canvas'

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
  artist: string
  song: string
  /** Square Bottb logo (black tile), already loaded. */
  bottbLogo: HTMLImageElement | null
  /** Band / company logo, already loaded (may be wide or tall). */
  companyLogo: HTMLImageElement | null
  /** Which corner the Bottb square sits in; the company logo takes the other. */
  bottbCorner: LogoCorner
}

type Source = CanvasImageSource

/**
 * Draw just the brand adornments — the two logos across the top and the
 * artist + song bottom-left — scaled to a `w`×`h` 16:9 area. Everything is
 * proportional to `h`, so this renders identically at any resolution. Used by
 * both the YouTube thumbnail and the transparent intro overlay.
 */
function drawAdornments(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  content: ThumbnailContent
): void {
  const pad = Math.round(h * 0.055)

  // --- Logos -----------------------------------------------------------------
  const bottbSize = Math.round(h * 0.17)
  const centerY = pad + bottbSize / 2
  const bottbOnRight = content.bottbCorner === 'top-right'

  if (content.bottbLogo) {
    const x = bottbOnRight ? w - pad - bottbSize : pad
    ctx.drawImage(content.bottbLogo, x, pad, bottbSize, bottbSize)
  }

  if (content.companyLogo) {
    const { w: nw, h: nh } = naturalSize(content.companyLogo)
    const fitted = fitContain(
      nw,
      nh,
      Math.round(w * 0.28),
      Math.round(h * 0.14)
    )
    // Company logo takes the opposite corner, vertically centred on the square.
    const x = bottbOnRight ? pad : w - pad - fitted.w
    const y = centerY - fitted.h / 2
    ctx.drawImage(content.companyLogo, x, y, fitted.w, fitted.h)
  }

  // --- Text (artist + song) --------------------------------------------------
  const artist = content.artist.trim()
  const song = content.song.trim()
  const maxTextW = w - pad * 2

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.shadowColor = 'rgba(0,0,0,0.85)'
  ctx.shadowBlur = Math.round(h * 0.014)
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = Math.round(h * 0.006)
  ctx.fillStyle = '#ffffff'

  let baseline = h - pad

  if (song) {
    const size = fitFont(ctx, song, 500, Math.round(h * 0.058), maxTextW)
    ctx.font = `500 ${size}px ${FONT_FAMILY}`
    ctx.fillText(song, pad, baseline)
    baseline -= size * 1.25
  }

  if (artist) {
    const size = fitFont(ctx, artist, 700, Math.round(h * 0.1), maxTextW)
    ctx.font = `700 ${size}px ${FONT_FAMILY}`
    ctx.fillText(artist, pad, baseline)
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

/** Shrink the font size until the text fits `maxWidth` (down to a floor). */
function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  weight: number,
  startSize: number,
  maxWidth: number
): number {
  let size = startSize
  ctx.font = `${weight} ${size}px ${FONT_FAMILY}`
  while (size > 18 && ctx.measureText(text).width > maxWidth) {
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
