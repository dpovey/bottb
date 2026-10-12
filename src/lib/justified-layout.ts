/**
 * Justified row layout — the layout photo sites (Flickr, Google Photos) use to
 * show photos at their real aspect ratio instead of cropping them to squares.
 *
 * Photos are packed left-to-right into rows. Every photo in a row shares the
 * same height, and the row's widths add up to exactly the container width, so
 * both edges of the gallery stay flush. Rows aim for `targetRowHeight` and
 * drift a little either side of it depending on what fits.
 *
 * DOM order is preserved (unlike masonry columns), which matters here because
 * clicking a photo opens the slideshow at that photo's index.
 */

export interface JustifiedLayoutOptions {
  /** Width available for the whole row, in CSS pixels */
  containerWidth: number
  /** Row height to aim for; actual rows land near it */
  targetRowHeight: number
  /** Gap between photos and between rows, in CSS pixels */
  gap: number
  /**
   * Aspect ratios outside this range are clamped, so one extreme panorama or
   * a 1-pixel-wide image can't collapse a whole row.
   */
  minAspect?: number
  maxAspect?: number
}

export interface JustifiedItem {
  /** Index into the input array */
  index: number
  width: number
  height: number
}

export interface JustifiedRow {
  items: JustifiedItem[]
  height: number
}

export const DEFAULT_MIN_ASPECT = 0.4
export const DEFAULT_MAX_ASPECT = 3.5

/** Aspect ratio (width / height) for a photo, falling back to 3:2 landscape. */
export function photoAspectRatio(photo: {
  width: number | null
  height: number | null
}): number {
  const { width, height } = photo
  if (!width || !height || width <= 0 || height <= 0) return 1.5
  return width / height
}

/**
 * Pack aspect ratios into justified rows.
 *
 * Returns an empty array when the container hasn't been measured yet, so
 * callers can render nothing rather than a wrongly-sized first pass.
 */
export function computeJustifiedLayout(
  aspects: number[],
  {
    containerWidth,
    targetRowHeight,
    gap,
    minAspect = DEFAULT_MIN_ASPECT,
    maxAspect = DEFAULT_MAX_ASPECT,
  }: JustifiedLayoutOptions
): JustifiedRow[] {
  if (containerWidth <= 0 || targetRowHeight <= 0 || aspects.length === 0) {
    return []
  }

  const clamped = aspects.map((a) =>
    Math.min(
      maxAspect,
      Math.max(minAspect, Number.isFinite(a) && a > 0 ? a : 1.5)
    )
  )

  // Height a row of `count` items whose aspects sum to `aspectSum` would take
  // once the inter-item gaps are removed from the available width.
  const rowHeight = (aspectSum: number, count: number) => {
    const available = containerWidth - gap * (count - 1)
    return available > 0 ? available / aspectSum : targetRowHeight
  }

  const rows: JustifiedRow[] = []
  let rowIndices: number[] = []
  let aspectSum = 0

  for (let i = 0; i < clamped.length; i++) {
    const withHeight = rowHeight(aspectSum + clamped[i], rowIndices.length + 1)

    if (withHeight >= targetRowHeight || rowIndices.length === 0) {
      // Still taller than we're aiming for: the row has room for more.
      rowIndices.push(i)
      aspectSum += clamped[i]
      continue
    }

    // Adding this photo overshoots. Keep whichever row lands closer to target.
    const withoutHeight = rowHeight(aspectSum, rowIndices.length)
    if (
      Math.abs(withHeight - targetRowHeight) <=
      Math.abs(withoutHeight - targetRowHeight)
    ) {
      rowIndices.push(i)
      aspectSum += clamped[i]
      rows.push(buildRow(rowIndices, clamped, withHeight, containerWidth, gap))
      rowIndices = []
      aspectSum = 0
    } else {
      rows.push(
        buildRow(rowIndices, clamped, withoutHeight, containerWidth, gap)
      )
      rowIndices = [i]
      aspectSum = clamped[i]
    }
  }

  // Trailing row: left-aligned at the target height rather than stretched to
  // fill, so two leftover photos don't blow up to banner size.
  if (rowIndices.length > 0) {
    const full = rowHeight(aspectSum, rowIndices.length)
    rows.push(
      buildRow(
        rowIndices,
        clamped,
        Math.min(targetRowHeight, full),
        containerWidth,
        gap,
        // Only a row that fills the width should be snapped to it exactly.
        full <= targetRowHeight
      )
    )
  }

  return rows
}

/**
 * Turn a row's indices into laid-out items. Widths are rounded to whole pixels
 * and any rounding drift is absorbed by the last item, so a justified row adds
 * up to the container width exactly.
 */
function buildRow(
  indices: number[],
  aspects: number[],
  height: number,
  containerWidth: number,
  gap: number,
  justify = true
): JustifiedRow {
  const roundedHeight = Math.round(height)
  const items: JustifiedItem[] = indices.map((index) => ({
    index,
    width: Math.round(aspects[index] * roundedHeight),
    height: roundedHeight,
  }))

  if (justify && items.length > 0) {
    const target = containerWidth - gap * (items.length - 1)
    const actual = items.reduce((sum, item) => sum + item.width, 0)
    items[items.length - 1].width += target - actual
  }

  return { items, height: roundedHeight }
}

/**
 * Aspect ratio for a tile in a fixed-height photo row (the photo strips), or
 * `null` when the photo's dimensions are unknown. Callers fall back to a
 * square, focal-point-cropped tile for `null`, which is how every strip
 * looked before photos kept their shape.
 *
 * Extremes are clamped to the same range as the gallery, so a panorama
 * can't take over a row; the image's object-cover crops the excess.
 */
export function rowTileAspect(photo: {
  width: number | null
  height: number | null
}): number | null {
  const { width, height } = photo
  if (!width || !height || width <= 0 || height <= 0) return null
  return Math.min(
    DEFAULT_MAX_ASPECT,
    Math.max(DEFAULT_MIN_ASPECT, width / height)
  )
}

/** Width of a row tile at `rowHeight`; an unknown aspect means a square. */
export function rowTileWidth(aspect: number | null, rowHeight: number): number {
  return Math.round((aspect ?? 1) * rowHeight)
}

export interface RowHeightBreakpoint {
  /** Largest viewport width (CSS px) this height applies to; omit for the rest */
  maxViewportWidth?: number
  /** Row height at this breakpoint, in CSS px */
  height: number
}

/**
 * `sizes` attribute for an image in a fixed-height row, so the browser picks
 * a srcset candidate for the tile's real width rather than a generic vw
 * guess. `growth` allows for layouts that stretch tiles past their basis
 * width to fill a line (flex-grow justified rows).
 */
export function rowImageSizes(
  aspect: number | null,
  breakpoints: RowHeightBreakpoint[],
  growth = 1
): string {
  return breakpoints
    .map(({ maxViewportWidth, height }) => {
      const width = `${Math.ceil(rowTileWidth(aspect, height) * growth)}px`
      return maxViewportWidth === undefined
        ? width
        : `(max-width: ${maxViewportWidth}px) ${width}`
    })
    .join(', ')
}
