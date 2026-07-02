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

  it('draws the event edition, date and venue text', () => {
    const { ctx, calls } = createMockContext()
    composePoster(ctx, fakeSource, 4000, 3000, baseContent, {
      format: 'portrait',
    })
    const drawn = calls.fillText.map((c) => c.text)
    expect(drawn).toContain('23rd October 2025 @ 6:30PM')
    expect(drawn).toContain('Factory Theatre, Sydney')
    expect(drawn).toContain('Battle of the Tech Bands')
  })

  it('always draws the brand wordmark, even with an empty event name', () => {
    const { ctx, calls } = createMockContext()
    composePoster(
      ctx,
      fakeSource,
      4000,
      3000,
      { ...baseContent, name: '' },
      { format: 'portrait' }
    )
    const drawn = calls.fillText.map((c) => c.text)
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

  it('labels the partner and Youngcare logos as "Powered by" / "Supporting"', () => {
    const { ctx, calls } = createMockContext()
    const logo = { naturalWidth: 200, naturalHeight: 200 } as HTMLImageElement
    composePoster(
      ctx,
      fakeSource,
      4000,
      3000,
      { ...baseContent, partnerLogo: logo, youngcareLogo: logo },
      { format: 'portrait' }
    )
    const drawn = calls.fillText.map((c) => c.text)
    expect(drawn).toContain('POWERED BY')
    expect(drawn).toContain('SUPPORTING')
    // photo + partner + youngcare = 3 drawImage calls (no bottb logo here).
    expect(calls.drawImage.length).toBe(3)
  })

  it('draws a footer strip of every company logo and reserves space above it', () => {
    const { ctx, calls } = createMockContext()
    const logo = { naturalWidth: 200, naturalHeight: 100 } as HTMLImageElement
    composePoster(
      ctx,
      fakeSource,
      4000,
      3000,
      { ...baseContent, companyLogos: [logo, logo, logo] },
      { format: 'portrait' }
    )
    // photo + 3 company logos = 4 drawImage calls.
    expect(calls.drawImage.length).toBe(4)
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

  it('renders at a custom `dimensions` size for crisp previews', () => {
    const { ctx, calls } = createMockContext()
    const dimensions = { w: 300, h: 375 } // same 4:5 aspect as portrait
    composePoster(ctx, fakeSource, 4000, 3000, baseContent, {
      format: 'portrait',
      dimensions,
    })
    expect(calls.clearRect[0]).toEqual([0, 0, 300, 375])
  })
})
