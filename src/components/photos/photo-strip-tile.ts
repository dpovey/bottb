import type { CSSProperties } from 'react'
import { rowImageSizes, type RowHeightBreakpoint } from '@/lib/justified-layout'

/**
 * Sizing for photo strip tiles: a fixed row height per breakpoint, with each
 * tile's width set from its photo's aspect ratio through the `--tile-aspect`
 * custom property. Pure CSS, so the server render already reserves each
 * tile's final box and nothing shifts when images arrive.
 *
 * Rows are a little shorter than the old squares (160/208/240px against
 * 192/224/256px) so a 3:2 or 1.57:1 landscape still fits the same thumbnail
 * file the square crop loaded: 400px on 1x desktops, 800px on 2x screens and
 * 3x phones. Portraits get narrower and load less than before.
 *
 * Keep the class heights and `PHOTO_STRIP_ROW_HEIGHTS` in step.
 */
export const PHOTO_STRIP_TILE_CLASS =
  'shrink-0 rounded-lg h-40 w-[calc(var(--tile-aspect)*10rem)] sm:h-52 sm:w-[calc(var(--tile-aspect)*13rem)] md:h-60 md:w-[calc(var(--tile-aspect)*15rem)]'

/** Row heights matching `PHOTO_STRIP_TILE_CLASS`, for image `sizes`. */
export const PHOTO_STRIP_ROW_HEIGHTS: RowHeightBreakpoint[] = [
  { maxViewportWidth: 639, height: 160 },
  { maxViewportWidth: 767, height: 208 },
  { height: 240 },
]

/** Inline style carrying a tile's aspect ratio; unknown means square. */
export function photoStripTileStyle(aspect: number | null): CSSProperties {
  return { '--tile-aspect': aspect ?? 1 } as CSSProperties
}

/** `sizes` for a strip tile's image at its real rendered width. */
export function photoStripImageSizes(aspect: number | null): string {
  return rowImageSizes(aspect, PHOTO_STRIP_ROW_HEIGHTS)
}
