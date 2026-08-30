/**
 * Shared, framework-free canvas helpers used by the browser-side image tools
 * (thumbnail generator, event-poster generator). Kept pure so the layout maths
 * stays easy to reason about and test.
 */

type Source = CanvasImageSource

/** Load an image element from a URL, resolving once it has decoded. */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`))
    img.src = src
  })
}

/**
 * Draw `src` to fill the destination rect, cropping to a focal point
 * (object-fit: cover + object-position). `focusX`/`focusY` run 0..1, where 0.5
 * is centred, 0 anchors the left/top edge and 1 the right/bottom edge.
 */
export function drawCover(
  ctx: CanvasRenderingContext2D,
  src: Source,
  sw: number,
  sh: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  focusX = 0.5,
  focusY = 0.5
): void {
  if (!sw || !sh) return
  const scale = Math.max(dw / sw, dh / sh)
  const w = sw * scale
  const h = sh * scale
  // (dw - w) and (dh - h) are <= 0 (the overflow); the focal fraction slides
  // the source within that overflow.
  ctx.drawImage(src, dx + (dw - w) * focusX, dy + (dh - h) * focusY, w, h)
}

/**
 * How far (in destination pixels) a cover-fitted source can slide on each axis.
 * Used to map a drag gesture on the preview back into focal-point fractions.
 */
export function coverSlack(
  sw: number,
  sh: number,
  dw: number,
  dh: number
): { slackX: number; slackY: number } {
  if (!sw || !sh) return { slackX: 0, slackY: 0 }
  const scale = Math.max(dw / sw, dh / sh)
  return {
    slackX: Math.max(0, sw * scale - dw),
    slackY: Math.max(0, sh * scale - dh),
  }
}

/** Scale (down only) to fit inside a box, preserving aspect ratio. */
export function fitContain(
  natW: number,
  natH: number,
  maxW: number,
  maxH: number
): { w: number; h: number } {
  if (!natW || !natH) return { w: maxW, h: maxH }
  const scale = Math.min(maxW / natW, maxH / natH)
  return { w: natW * scale, h: natH * scale }
}

/** An already-decoded image, or a canvas holding one (e.g. a trimmed logo). */
export type LogoSource = HTMLImageElement | HTMLCanvasElement

/** Intrinsic size of an image or canvas, with a square fallback for dimensionless SVGs. */
export function naturalSize(img: LogoSource): { w: number; h: number } {
  // SVGs without intrinsic dimensions report 0 — fall back to a square.
  // Canvases have no naturalWidth at all, so fall through to width/height.
  const source = img as Partial<HTMLImageElement> & LogoSource
  const w = source.naturalWidth || img.width || 1
  const h = source.naturalHeight || img.height || 1
  return { w, h }
}

/**
 * Crop away an image's fully-transparent padding, returning a canvas holding
 * just the visible pixels. Logo files often bake in generous margins, which
 * makes side-by-side logos look misaligned and unevenly sized. Returns the
 * original image untouched when it can't be read (no 2D context, zero size,
 * or a cross-origin taint) or when there is nothing to trim.
 */
export function trimTransparent(img: HTMLImageElement): LogoSource {
  const { w, h } = naturalSize(img)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return img
    ctx.drawImage(img, 0, 0, w, h)
    const data = ctx.getImageData(0, 0, w, h).data

    let top = h
    let bottom = -1
    let left = w
    let right = -1
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] > 8) {
          if (y < top) top = y
          if (y > bottom) bottom = y
          if (x < left) left = x
          if (x > right) right = x
        }
      }
    }
    if (bottom < 0) return img // fully transparent — nothing to trim to
    if (top === 0 && left === 0 && bottom === h - 1 && right === w - 1) {
      return img
    }
    const trimmed = document.createElement('canvas')
    trimmed.width = right - left + 1
    trimmed.height = bottom - top + 1
    const tctx = trimmed.getContext('2d')
    if (!tctx) return img
    tctx.drawImage(canvas, -left, -top)
    return trimmed
  } catch {
    return img // cross-origin taint, or canvas unavailable
  }
}

/**
 * Greedy word-wrap `text` into at most `maxLines` lines that each fit
 * `maxWidth` at the current `ctx.font`. Overflowing words stay on the last
 * line (callers shrink the font to compensate).
 */
export function wrapLines(
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

export interface LogoRowOptions {
  /** Left edge of the row when `align` is 'left'; right edge when 'right'. */
  x: number
  centerY: number
  align: 'left' | 'right'
  /** Total width available for the whole row (logos + gaps). */
  maxW: number
  /** Tallest any single logo may be. */
  maxH: number
  /** Gap between logos, in px. */
  gap: number
}

/**
 * Draw several logos side by side (e.g. every company behind a multi-company
 * band), each scaled to fit `maxH` tall, then shrunk together if the row would
 * overflow `maxW`. Logos are vertically centred on `centerY` and packed from
 * the `align` edge, so the first logo is always closest to that edge.
 * Returns the width the row actually occupies.
 */
export function drawLogoRow(
  ctx: CanvasRenderingContext2D,
  logos: LogoSource[],
  { x, centerY, align, maxW, maxH, gap }: LogoRowOptions
): number {
  if (logos.length === 0) return 0
  // Equal-area sizing: height-fitting every logo makes a wide wordmark tower
  // over a compact mark, so give each logo the same pixel area instead. The
  // squarest logo gets the full `maxH` and wider ones come out shorter, which
  // is much closer to how the logos read side by side.
  const aspects = logos.map((img) => {
    const { w, h } = naturalSize(img)
    return w / h
  })
  const area = maxH * maxH * Math.min(...aspects)
  let sizes = aspects.map((a) => {
    const h = Math.min(maxH, Math.sqrt(area / a))
    return fitContain(a, 1, maxW, h)
  })
  const totalGap = gap * (sizes.length - 1)
  const rowW = sizes.reduce((sum, s) => sum + s.w, 0) + totalGap
  if (rowW > maxW) {
    const scale = (maxW - totalGap) / (rowW - totalGap)
    sizes = sizes.map((s) => ({ w: s.w * scale, h: s.h * scale }))
  }
  const finalW = sizes.reduce((sum, s) => sum + s.w, 0) + totalGap

  let cursor = align === 'left' ? x : x - finalW
  logos.forEach((img, i) => {
    const { w, h } = sizes[i]
    ctx.drawImage(img, cursor, centerY - h / 2, w, h)
    cursor += w + gap
  })
  return finalW
}
