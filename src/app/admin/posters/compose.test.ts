import { describe, expect, it } from 'vitest'
import {
  composePoster,
  POSTER_FORMATS,
  type PosterContent,
  type PosterFormat,
} from './compose'

/**
 * A minimal recording stand-in for a 2D canvas context. jsdom has no real
 * canvas, and {@link composePoster} only needs the handful of methods below,
 * so we record the drawImage / fillText / rect calls we care about.
 */
function createMockContext() {
  const calls = {
    fillText: [] as { text: string; x: number; y: number }[],
    drawImage: [] as unknown[][],
    fillRect: [] as number[][],
    clearRect: [] as number[][],
    gradients: 0,
  }
  const ctx = {
    // Mutable state properties composePoster assigns to.
    font: '',
    fillStyle: '' as string | CanvasGradient,
    textAlign: 'left',
    textBaseline: 'alphabetic',
    shadowColor: '',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    clearRect: (...a: number[]) => calls.clearRect.push(a),
    fillRect: (...a: number[]) => calls.fillRect.push(a),
    createLinearGradient: () => {
      calls.gradients++
      return { addColorStop: () => {} }
    },
    drawImage: (...a: unknown[]) => calls.drawImage.push(a),
    // Width scales with text length so wrapping/shrinking logic exercises.
    measureText: (t: string) => ({ width: t.length * 10 }),
    fillText: (text: string, x: number, y: number) =>
      calls.fillText.push({ text, x, y }),
  }
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls }
}

const baseContent: PosterContent = {
  name: 'Battle of the Tech Bands',
  date: '23rd October 2025 @ 6:30PM',
  venue: 'Factory Theatre, Sydney',
  bottbLogo: null,
  partnerLogo: null,
  bottbCorner: 'top-right',
}

// A fake "image" — composePoster/drawImage never inspect its shape.
const fakeSource = {} as CanvasImageSource

describe('composePoster', () => {
  const formats: PosterFormat[] = ['portrait', 'landscape', 'fbcover']

  it('exposes the LinkedIn/Facebook target dimensions', () => {
    expect(POSTER_FORMATS.portrait).toEqual({ w: 1080, h: 1350 })
    expect(POSTER_FORMATS.landscape).toEqual({ w: 1200, h: 628 })
    expect(POSTER_FORMATS.fbcover).toEqual({ w: 1920, h: 1005 })
  })

  it.each(formats)('clears the full %s canvas before drawing', (format) => {
    const { ctx, calls } = createMockContext()
    composePoster(ctx, fakeSource, 4000, 3000, baseContent, { format })
    const { w, h } = POSTER_FORMATS[format]
    expect(calls.clearRect[0]).toEqual([0, 0, w, h])
  })

  it('draws the event name, date and venue text', () => {
    const { ctx, calls } = createMockContext()
    composePoster(ctx, fakeSource, 4000, 3000, baseContent, {
      format: 'portrait',
    })
    const drawn = calls.fillText.map((c) => c.text)
    expect(drawn).toContain('23rd October 2025 @ 6:30PM')
    expect(drawn).toContain('Factory Theatre, Sydney')
    // The long name wraps across (up to) two lines; every word survives.
    expect(drawn.join(' ')).toContain('Battle')
    expect(drawn.join(' ')).toContain('Bands')
  })

  it('paints top and bottom scrims over the photo', () => {
    const { ctx, calls } = createMockContext()
    composePoster(ctx, fakeSource, 4000, 3000, baseContent, {
      format: 'landscape',
    })
    // One drawImage for the cover photo; two gradient scrims.
    expect(calls.drawImage.length).toBe(1)
    expect(calls.gradients).toBe(2)
  })

  it('draws both logos when supplied, in opposite corners', () => {
    const { ctx, calls } = createMockContext()
    const logo = { naturalWidth: 200, naturalHeight: 200 } as HTMLImageElement
    composePoster(
      ctx,
      fakeSource,
      4000,
      3000,
      { ...baseContent, bottbLogo: logo, partnerLogo: logo },
      { format: 'portrait' }
    )
    // photo + bottb + partner = 3 drawImage calls.
    expect(calls.drawImage.length).toBe(3)
  })

  it('fills a placeholder background when no photo is provided', () => {
    const { ctx, calls } = createMockContext()
    composePoster(ctx, null, 0, 0, baseContent, { format: 'fbcover' })
    expect(calls.drawImage.length).toBe(0)
    // Placeholder fill + two scrims.
    expect(calls.fillRect.length).toBeGreaterThanOrEqual(3)
  })

  it('does not throw on empty text content', () => {
    const { ctx } = createMockContext()
    expect(() =>
      composePoster(
        ctx,
        fakeSource,
        4000,
        3000,
        { ...baseContent, name: '', date: '', venue: '' },
        { format: 'portrait' }
      )
    ).not.toThrow()
  })
})
