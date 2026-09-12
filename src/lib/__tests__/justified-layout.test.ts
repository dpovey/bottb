/**
 * Tests for the justified row layout used by the photo gallery.
 *
 * The invariants that matter visually:
 *  - every photo appears exactly once, in input order,
 *  - full rows are flush with both edges (widths + gaps === container width),
 *  - photos keep their aspect ratio,
 *  - the trailing row is left-aligned rather than stretched.
 */

import { describe, it, expect } from 'vitest'
import { computeJustifiedLayout, photoAspectRatio } from '../justified-layout'

const LANDSCAPE = 3 / 2
const PORTRAIT = 2 / 3

function flatIndices(rows: ReturnType<typeof computeJustifiedLayout>) {
  return rows.flatMap((row) => row.items.map((item) => item.index))
}

function rowWidth(
  row: ReturnType<typeof computeJustifiedLayout>[number],
  gap: number
) {
  return (
    row.items.reduce((sum, item) => sum + item.width, 0) +
    gap * (row.items.length - 1)
  )
}

describe('photoAspectRatio', () => {
  it('returns width / height', () => {
    expect(photoAspectRatio({ width: 3000, height: 2000 })).toBeCloseTo(1.5)
    expect(photoAspectRatio({ width: 2000, height: 3000 })).toBeCloseTo(
      0.667,
      2
    )
  })

  it('falls back to 3:2 when dimensions are missing or nonsense', () => {
    expect(photoAspectRatio({ width: null, height: null })).toBe(1.5)
    expect(photoAspectRatio({ width: 0, height: 100 })).toBe(1.5)
    expect(photoAspectRatio({ width: -10, height: 100 })).toBe(1.5)
  })
})

describe('computeJustifiedLayout', () => {
  const opts = { containerWidth: 1000, targetRowHeight: 240, gap: 12 }

  it('returns nothing before the container has been measured', () => {
    expect(
      computeJustifiedLayout([1.5, 1.5], { ...opts, containerWidth: 0 })
    ).toEqual([])
  })

  it('returns nothing for an empty gallery', () => {
    expect(computeJustifiedLayout([], opts)).toEqual([])
  })

  it('keeps every photo, once, in input order', () => {
    const aspects = Array.from({ length: 37 }, (_, i) =>
      i % 3 === 0 ? PORTRAIT : LANDSCAPE
    )
    const rows = computeJustifiedLayout(aspects, opts)

    expect(flatIndices(rows)).toEqual(aspects.map((_, i) => i))
  })

  it('makes every full row flush with the container width', () => {
    const aspects = Array.from({ length: 40 }, (_, i) =>
      i % 4 === 0 ? PORTRAIT : LANDSCAPE
    )
    const rows = computeJustifiedLayout(aspects, opts)

    // All but the trailing row are justified to the exact container width.
    for (const row of rows.slice(0, -1)) {
      expect(rowWidth(row, opts.gap)).toBe(opts.containerWidth)
    }
  })

  it('gives every photo in a row the same height', () => {
    const rows = computeJustifiedLayout(
      [LANDSCAPE, PORTRAIT, LANDSCAPE, LANDSCAPE, PORTRAIT, LANDSCAPE],
      opts
    )

    for (const row of rows) {
      for (const item of row.items) {
        expect(item.height).toBe(row.height)
      }
    }
  })

  it('preserves each photo aspect ratio', () => {
    const aspects = [LANDSCAPE, PORTRAIT, 1, 1.78, 0.8, LANDSCAPE, PORTRAIT]
    const rows = computeJustifiedLayout(aspects, opts)

    for (const row of rows) {
      // The last item in a justified row absorbs sub-pixel rounding drift, so
      // check the others, which are rounded straight from the ratio.
      for (const item of row.items.slice(0, -1)) {
        expect(item.width / item.height).toBeCloseTo(aspects[item.index], 1)
      }
    }
  })

  it('lands rows near the target height', () => {
    const aspects = Array.from({ length: 60 }, (_, i) =>
      i % 3 === 0 ? PORTRAIT : LANDSCAPE
    )
    const rows = computeJustifiedLayout(aspects, opts)

    for (const row of rows.slice(0, -1)) {
      expect(row.height).toBeGreaterThan(opts.targetRowHeight * 0.6)
      expect(row.height).toBeLessThan(opts.targetRowHeight * 1.6)
    }
  })

  it('leaves the trailing row at target height instead of stretching it', () => {
    // One lone landscape photo would fill 1000px (667px tall) if justified.
    const rows = computeJustifiedLayout([LANDSCAPE], opts)

    expect(rows).toHaveLength(1)
    expect(rows[0].height).toBe(opts.targetRowHeight)
    expect(rowWidth(rows[0], opts.gap)).toBeLessThan(opts.containerWidth)
  })

  it('clamps extreme aspect ratios so one photo cannot break a row', () => {
    const rows = computeJustifiedLayout([50, LANDSCAPE, LANDSCAPE], {
      ...opts,
      maxAspect: 3,
    })

    const panorama = rows[0].items[0]
    expect(panorama.width / panorama.height).toBeLessThanOrEqual(3.5)
  })

  it('puts fewer photos per row as the container narrows', () => {
    const aspects = Array.from({ length: 20 }, () => LANDSCAPE)

    const wide = computeJustifiedLayout(aspects, {
      ...opts,
      containerWidth: 1400,
    })
    const narrow = computeJustifiedLayout(aspects, {
      ...opts,
      containerWidth: 500,
    })

    expect(wide[0].items.length).toBeGreaterThan(narrow[0].items.length)
  })
})
