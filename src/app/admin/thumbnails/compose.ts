/**
 * Pure canvas composition for social thumbnails. No React / DOM-framework code
 * here so the layout maths stays easy to reason about and test.
 *
 * - YouTube: 1280×720, frame + brand overlays (logos + artist/song text).
 * - Instagram (Reel/Story): 1080×1920, clean centre-cropped frame, no overlays.
 */

export type LogoCorner = 'top-left' | 'top-right'

export const YT_W = 1280
export const YT_H = 720
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

/** Draw `src` to fill the destination rect, centre-cropping (object-fit: cover). */
function drawCover(
  ctx: CanvasRenderingContext2D,
  src: Source,
  sw: number,
  sh: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number
): void {
  if (!sw || !sh) return
  const scale = Math.max(dw / sw, dh / sh)
  const w = sw * scale
  const h = sh * scale
  ctx.drawImage(src, dx + (dw - w) / 2, dy + (dh - h) / 2, w, h)
}

/** Scale (down only) to fit inside a box, preserving aspect ratio. */
function fitContain(
  natW: number,
  natH: number,
  maxW: number,
  maxH: number
): { w: number; h: number } {
  if (!natW || !natH) return { w: maxW, h: maxH }
  const scale = Math.min(maxW / natW, maxH / natH)
  return { w: natW * scale, h: natH * scale }
}

function naturalSize(img: HTMLImageElement): { w: number; h: number } {
  // SVGs without intrinsic dimensions report 0 — fall back to a square.
  const w = img.naturalWidth || img.width || 1
  const h = img.naturalHeight || img.height || 1
  return { w, h }
}

/**
 * Render the YouTube thumbnail (1280×720) into `ctx`. The frame is drawn
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

  const pad = Math.round(YT_H * 0.055)

  // --- Logos -----------------------------------------------------------------
  const bottbSize = Math.round(YT_H * 0.17)
  const centerY = pad + bottbSize / 2
  const bottbOnRight = content.bottbCorner === 'top-right'

  if (content.bottbLogo) {
    const x = bottbOnRight ? YT_W - pad - bottbSize : pad
    ctx.drawImage(content.bottbLogo, x, pad, bottbSize, bottbSize)
  }

  if (content.companyLogo) {
    const { w: nw, h: nh } = naturalSize(content.companyLogo)
    const { w, h } = fitContain(
      nw,
      nh,
      Math.round(YT_W * 0.28),
      Math.round(YT_H * 0.14)
    )
    // Company logo takes the opposite corner, vertically centred on the square.
    const x = bottbOnRight ? pad : YT_W - pad - w
    const y = centerY - h / 2
    ctx.drawImage(content.companyLogo, x, y, w, h)
  }

  // --- Text (artist + song) --------------------------------------------------
  const artist = content.artist.trim()
  const song = content.song.trim()
  const maxTextW = YT_W - pad * 2

  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.shadowColor = 'rgba(0,0,0,0.85)'
  ctx.shadowBlur = Math.round(YT_H * 0.014)
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = Math.round(YT_H * 0.006)
  ctx.fillStyle = '#ffffff'

  let baseline = YT_H - pad

  if (song) {
    const size = fitFont(ctx, song, 500, Math.round(YT_H * 0.058), maxTextW)
    ctx.font = `500 ${size}px ${FONT_FAMILY}`
    ctx.fillText(song, pad, baseline)
    baseline -= size * 1.25
  }

  if (artist) {
    const size = fitFont(ctx, artist, 700, Math.round(YT_H * 0.1), maxTextW)
    ctx.font = `700 ${size}px ${FONT_FAMILY}`
    ctx.fillText(artist, pad, baseline)
  }

  // Reset shadow so callers aren't surprised.
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0
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

/**
 * Render the Instagram Reel/Story thumbnail (1080×1920): a clean,
 * centre-cropped frame with no overlays.
 */
export function composeInstagram(
  ctx: CanvasRenderingContext2D,
  source: Source | null,
  sourceW: number,
  sourceH: number
): void {
  ctx.clearRect(0, 0, IG_W, IG_H)
  if (source) {
    drawCover(ctx, source, sourceW, sourceH, 0, 0, IG_W, IG_H)
  } else {
    ctx.fillStyle = '#0a0a0a'
    ctx.fillRect(0, 0, IG_W, IG_H)
  }
}
