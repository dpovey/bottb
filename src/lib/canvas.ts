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

/** Intrinsic size of an image, with a square fallback for dimensionless SVGs. */
export function naturalSize(img: HTMLImageElement): { w: number; h: number } {
  // SVGs without intrinsic dimensions report 0 — fall back to a square.
  const w = img.naturalWidth || img.width || 1
  const h = img.naturalHeight || img.height || 1
  return { w, h }
}
