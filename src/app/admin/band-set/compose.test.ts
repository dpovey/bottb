import { describe, expect, it } from 'vitest'
import {
  composeCreditsOverlay,
  composeCreditsPreview,
  composeTitleOverlay,
  composeTitlePreview,
  OV_H,
  OV_W,
  PV_H,
  PV_W,
  type CreditsContent,
  type TitleContent,
} from './compose'

/**
 * A minimal recording stand-in for a 2D canvas context. jsdom has no real
 * canvas, and the compose functions only need the handful of methods below,
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
    createRadialGradient: () => {
      calls.gradients++
      return { addColorStop: () => {} }
    },
    save: () => {},
    restore: () => {},
    translate: () => {},
    scale: () => {},
    drawImage: (...a: unknown[]) => calls.drawImage.push(a),
    // Width scales with text length so wrapping/shrinking logic exercises.
    measureText: (t: string) => ({ width: t.length * 10 }),
    fillText: (text: string, x: number, y: number) =>
      calls.fillText.push({ text, x, y }),
  }
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls }
}

const baseTitle: TitleContent = {
  bandName: 'The Null Pointers',
  eventName: 'Sydney Tech Battle 2025',
  eventDate: '23rd October 2025',
  eventVenue: 'Factory Theatre, Sydney',
  bottbLogo: null,
  companyLogo: null,
  bottbCorner: 'top-right',
}

const baseCredits: CreditsContent = {
  bandName: 'The Null Pointers',
  members: ['Jane Doe — Vocals', 'John Smith — Guitar', ''],
  bottbLogo: null,
  companyLogo: null,
  bottbCorner: 'top-right',
}

const fakeSource = {} as CanvasImageSource
const fakeLogo = { naturalWidth: 200, naturalHeight: 200 } as HTMLImageElement

describe('composeTitleOverlay', () => {
  it('exposes the 4K overlay dimensions', () => {
    expect(OV_W).toBe(3840)
    expect(OV_H).toBe(2160)
  })

  it('clears the full canvas without drawing a video frame', () => {
    const { ctx, calls } = createMockContext()
    composeTitleOverlay(ctx, baseTitle)
    expect(calls.clearRect[0]).toEqual([0, 0, OV_W, OV_H])
    expect(calls.drawImage.length).toBe(0)
    // The legibility vignette behind the text is still a gradient fill.
    expect(calls.gradients).toBeGreaterThan(0)
  })

  it('draws the band name and event details', () => {
    const { ctx, calls } = createMockContext()
    composeTitleOverlay(ctx, baseTitle)
    const drawn = calls.fillText.map((c) => c.text)
    expect(drawn).toContain('The Null Pointers')
    expect(drawn).toContain('Sydney Tech Battle 2025')
    expect(drawn.join(' ')).toContain('23rd October 2025')
    expect(drawn.join(' ')).toContain('Factory Theatre, Sydney')
  })

  it('draws both logos when supplied, in opposite corners', () => {
    const { ctx, calls } = createMockContext()
    composeTitleOverlay(ctx, {
      ...baseTitle,
      bottbLogo: fakeLogo,
      companyLogo: fakeLogo,
    })
    expect(calls.drawImage.length).toBe(2)
  })

  it('renders at a custom size', () => {
    const { ctx, calls } = createMockContext()
    composeTitleOverlay(ctx, baseTitle, 1920, 1080)
    expect(calls.clearRect[0]).toEqual([0, 0, 1920, 1080])
  })

  it('does not throw on empty text content', () => {
    const { ctx } = createMockContext()
    expect(() =>
      composeTitleOverlay(ctx, {
        ...baseTitle,
        bandName: '',
        eventName: '',
        eventDate: '',
        eventVenue: '',
      })
    ).not.toThrow()
  })

  it('draws a "Powered by / Supporting" sponsor row when logos are supplied', () => {
    const { ctx, calls } = createMockContext()
    composeTitleOverlay(ctx, {
      ...baseTitle,
      partnerLogo: fakeLogo,
      youngcareLogo: fakeLogo,
    })
    const drawn = calls.fillText.map((c) => c.text)
    expect(drawn).toContain('POWERED BY')
    expect(drawn).toContain('SUPPORTING')
    // No corner logos here, so both drawImage calls are the sponsor logos.
    expect(calls.drawImage.length).toBe(2)
  })

  it('omits the sponsor row entirely when no sponsor logos are supplied', () => {
    const { ctx, calls } = createMockContext()
    composeTitleOverlay(ctx, baseTitle)
    const drawn = calls.fillText.map((c) => c.text)
    expect(drawn).not.toContain('POWERED BY')
    expect(drawn).not.toContain('SUPPORTING')
  })
})

describe('composeCreditsOverlay', () => {
  it('clears the full canvas without drawing a frame', () => {
    const { ctx, calls } = createMockContext()
    composeCreditsOverlay(ctx, baseCredits)
    expect(calls.clearRect[0]).toEqual([0, 0, OV_W, OV_H])
    expect(calls.drawImage.length).toBe(0)
  })

  it('draws the band name, a heading, and each member split into name + role', () => {
    const { ctx, calls } = createMockContext()
    composeCreditsOverlay(ctx, baseCredits)
    const drawn = calls.fillText.map((c) => c.text)
    expect(drawn).toContain('The Null Pointers')
    expect(drawn).toContain('BAND MEMBERS')
    expect(drawn).toContain('Jane Doe')
    expect(drawn).toContain('VOCALS')
    expect(drawn).toContain('John Smith')
    expect(drawn).toContain('GUITAR')
    // The blank line in `members` contributes nothing.
    expect(drawn).not.toContain('')
  })

  it('draws a name-only member with no role line', () => {
    const { ctx, calls } = createMockContext()
    composeCreditsOverlay(ctx, { ...baseCredits, members: ['Jane Doe'] })
    const drawn = calls.fillText.map((c) => c.text)
    expect(drawn).toContain('Jane Doe')
    expect(drawn).not.toContain('VOCALS')
  })

  it('does not throw with an empty member list', () => {
    const { ctx } = createMockContext()
    expect(() =>
      composeCreditsOverlay(ctx, { ...baseCredits, members: [] })
    ).not.toThrow()
  })

  it('shrinks the per-member line height as the roster grows', () => {
    const short = createMockContext()
    composeCreditsOverlay(short.ctx, {
      ...baseCredits,
      members: ['Jane Doe', 'John Smith'],
    })
    const long = createMockContext()
    const roster = Array.from({ length: 15 }, (_, i) => `Member ${i}`)
    composeCreditsOverlay(long.ctx, { ...baseCredits, members: roster })

    const gapBetween = (calls: { text: string; y: number }[]) => {
      const memberYs = calls
        .filter(
          (c) => c.text.startsWith('Member') || /^(Jane|John)/.test(c.text)
        )
        .map((c) => c.y)
      return memberYs.length > 1 ? memberYs[1] - memberYs[0] : 0
    }

    expect(gapBetween(long.calls.fillText)).toBeLessThan(
      gapBetween(short.calls.fillText)
    )
  })
})

describe('preview variants', () => {
  it('exposes 16:9 preview dimensions', () => {
    expect(PV_W).toBe(1920)
    expect(PV_H).toBe(1080)
  })

  it('composeTitlePreview draws a video frame, scrims, and the title adornments', () => {
    const { ctx, calls } = createMockContext()
    composeTitlePreview(ctx, fakeSource, 4000, 3000, baseTitle)
    expect(calls.clearRect[0]).toEqual([0, 0, PV_W, PV_H])
    expect(calls.drawImage.length).toBe(1) // the video frame; no logos supplied
    // Two frame scrims (top/bottom) plus the legibility vignette behind the text.
    expect(calls.gradients).toBe(3)
    expect(calls.fillText.map((c) => c.text)).toContain('The Null Pointers')
  })

  it('composeCreditsPreview fills a placeholder background with no source', () => {
    const { ctx, calls } = createMockContext()
    composeCreditsPreview(ctx, null, 0, 0, baseCredits)
    expect(calls.drawImage.length).toBe(0)
    expect(calls.fillRect.length).toBeGreaterThanOrEqual(3)
  })
})
