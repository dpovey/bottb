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
  type CreditsMember,
  type TitleContent,
} from './compose'

/**
 * A minimal recording stand-in for a 2D canvas context. jsdom has no real
 * canvas, and the compose functions only need the handful of methods below,
 * so we record the drawImage / fillText / rect calls we care about.
 */
function createMockContext() {
  const calls = {
    fillText: [] as { text: string; x: number; y: number; font: string }[],
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
      calls.fillText.push({ text, x, y, font: ctx.font }),
  }
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls }
}

const baseTitle: TitleContent = {
  bandName: 'The Null Pointers',
  eventName: 'Sydney Tech Battle 2025',
  eventDate: '23rd October 2025',
  eventVenue: 'Factory Theatre, Sydney',
  bottbLogo: null,
  companyLogos: [],
  bottbCorner: 'top-right',
}

const baseCredits: CreditsContent = {
  bandName: 'The Null Pointers',
  members: [
    { name: 'John Smith', role: 'Guitar' },
    { name: 'Jane Doe', role: 'Vocals' },
    { name: '', role: '' },
  ],
  bottbLogo: null,
  companyLogos: [],
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
      companyLogos: [fakeLogo],
    })
    expect(calls.drawImage.length).toBe(2)
  })

  it('draws every company logo side by side for a multi-company band', () => {
    const { ctx, calls } = createMockContext()
    const wideLogo = {
      naturalWidth: 600,
      naturalHeight: 200,
    } as HTMLImageElement
    composeTitleOverlay(ctx, {
      ...baseTitle,
      bottbLogo: fakeLogo,
      companyLogos: [fakeLogo, wideLogo],
      bottbCorner: 'top-right',
    })
    // Bottb square + two company logos.
    expect(calls.drawImage).toHaveLength(3)
    const nums = (call: unknown[]) => call.slice(1).map(Number)
    const [bx] = nums(calls.drawImage[0])
    const [fx, fy, fw, fh] = nums(calls.drawImage[1])
    const [sx, sy, , sh] = nums(calls.drawImage[2])
    // Packed left-to-right from the left edge, not overlapping, same centre line.
    expect(sx).toBeGreaterThanOrEqual(fx + fw)
    expect(fy + fh / 2).toBeCloseTo(sy + sh / 2, 5)
    // Equal-area sizing: the 3:1 wordmark renders shorter than the square
    // mark rather than towering over it at the same height.
    expect(sh).toBeLessThan(fh)
    expect(sh).toBeCloseTo(fh / Math.sqrt(3), 0)
    // The whole row stays clear of the Bottb square on the right.
    expect(sx).toBeLessThan(bx)
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

  it('draws the band name, a "FEATURING" heading, and each member split into name + role', () => {
    const { ctx, calls } = createMockContext()
    composeCreditsOverlay(ctx, baseCredits)
    const drawn = calls.fillText.map((c) => c.text)
    expect(drawn).toContain('The Null Pointers')
    expect(drawn).toContain('FEATURING')
    expect(drawn).toContain('Jane Doe')
    expect(drawn).toContain('VOCALS')
    expect(drawn).toContain('John Smith')
    expect(drawn).toContain('GUITAR')
    // The blank entry in `members` contributes nothing.
    expect(drawn).not.toContain('')
  })

  it('sorts members alphabetically by surname', () => {
    const { ctx, calls } = createMockContext()
    // baseCredits lists John Smith before Jane Doe; Doe should draw first.
    composeCreditsOverlay(ctx, baseCredits)
    const drawn = calls.fillText.map((c) => c.text)
    expect(drawn.indexOf('Jane Doe')).toBeLessThan(drawn.indexOf('John Smith'))
  })

  it('draws a name-only member with no role line', () => {
    const { ctx, calls } = createMockContext()
    composeCreditsOverlay(ctx, {
      ...baseCredits,
      members: [{ name: 'Jane Doe' }],
    })
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

  it('shrinks the per-member line height as a (single-column) roster grows', () => {
    const short = createMockContext()
    composeCreditsOverlay(short.ctx, {
      ...baseCredits,
      members: [{ name: 'Doe' }, { name: 'Smith' }],
    })
    const long = createMockContext()
    // Below TWO_COLUMN_THRESHOLD, so this stays a single column.
    const roster: CreditsMember[] = Array.from({ length: 5 }, (_, i) => ({
      name: `Member${i}`,
    }))
    composeCreditsOverlay(long.ctx, { ...baseCredits, members: roster })

    const gapBetween = (calls: { text: string; y: number }[]) => {
      const memberYs = calls
        .filter(
          (c) => c.text.startsWith('Member') || /^(Doe|Smith)/.test(c.text)
        )
        .map((c) => c.y)
      return memberYs.length > 1 ? memberYs[1] - memberYs[0] : 0
    }

    expect(gapBetween(long.calls.fillText)).toBeLessThan(
      gapBetween(short.calls.fillText)
    )
  })

  it('keeps a roster that fits in a single centred column', () => {
    const { ctx, calls } = createMockContext()
    const roster: CreditsMember[] = Array.from({ length: 5 }, (_, i) => ({
      name: `Member${i}`,
    }))
    composeCreditsOverlay(ctx, { ...baseCredits, members: roster })
    const xs = new Set(
      calls.fillText.filter((c) => c.text.startsWith('Member')).map((c) => c.x)
    )
    expect(xs.size).toBe(1)
  })

  it('splits into columns rather than shrinking a long roster', () => {
    const { ctx, calls } = createMockContext()
    // Role entries need ~1.7x the height of a bare name, so a roster this size
    // cannot hold the legibility floor in one column.
    const roster: CreditsMember[] = Array.from({ length: 12 }, (_, i) => ({
      name: `Member${i}`,
      role: 'Guitar',
    }))
    composeCreditsOverlay(ctx, { ...baseCredits, members: roster })
    const memberCalls = calls.fillText.filter((c) =>
      c.text.startsWith('Member')
    )
    expect(memberCalls).toHaveLength(12)
    const xs = new Set(memberCalls.map((c) => c.x))
    expect(xs.size).toBeGreaterThan(1)
    expect(xs.size).toBeLessThanOrEqual(3)
  })

  it('keeps a large roster clear of the sponsor row', () => {
    const { ctx, calls } = createMockContext()
    const roster: CreditsMember[] = Array.from({ length: 12 }, (_, i) => ({
      name: `Member${i}`,
      role: 'Guitar',
    }))
    composeCreditsOverlay(ctx, {
      ...baseCredits,
      members: roster,
      partnerLogo: fakeLogo,
      youngcareLogo: fakeLogo,
    })
    const lowestMember = Math.max(
      ...calls.fillText
        .filter((c) => c.text.startsWith('Member'))
        .map((c) => c.y)
    )
    const sponsorLabel = calls.fillText.find((c) => c.text === 'POWERED BY')
    expect(sponsorLabel).toBeDefined()
    expect(lowestMember).toBeLessThan(sponsorLabel!.y)
  })
})

describe('safe areas', () => {
  /**
   * Everything must sit inside SMPTE HD title-safe (the inner 90%) so it
   * survives cropping, and clear of the bottom of the frame where the YouTube
   * player draws its scrubber and control bar.
   */
  const TITLE_SAFE = 0.05
  const CONTROL_BAR = 0.9

  it('insets the corner logos from every edge', () => {
    const { ctx, calls } = createMockContext()
    composeTitleOverlay(ctx, {
      ...baseTitle,
      bottbLogo: fakeLogo,
      companyLogos: [fakeLogo],
    })
    expect(calls.drawImage).toHaveLength(2)
    for (const [, x, y, w, h] of calls.drawImage as number[][]) {
      expect(x).toBeGreaterThanOrEqual(OV_W * TITLE_SAFE)
      expect(y).toBeGreaterThanOrEqual(OV_H * TITLE_SAFE)
      expect(x + w).toBeLessThanOrEqual(OV_W * (1 - TITLE_SAFE))
      expect(y + h).toBeLessThanOrEqual(OV_H * (1 - TITLE_SAFE))
    }
  })

  it('keeps the sponsor row above the YouTube control bar', () => {
    const { ctx, calls } = createMockContext()
    composeTitleOverlay(ctx, {
      ...baseTitle,
      partnerLogo: fakeLogo,
      youngcareLogo: fakeLogo,
    })
    // Sponsor logos are the only images drawn here (no corner logos supplied).
    for (const [, , y, , h] of calls.drawImage as number[][]) {
      expect(y + h).toBeLessThanOrEqual(OV_H * CONTROL_BAR)
    }
    for (const call of calls.fillText) {
      expect(call.y).toBeLessThanOrEqual(OV_H * CONTROL_BAR)
    }
  })

  it('keeps credits text above the YouTube control bar', () => {
    const { ctx, calls } = createMockContext()
    composeCreditsOverlay(ctx, {
      ...baseCredits,
      partnerLogo: fakeLogo,
      youngcareLogo: fakeLogo,
    })
    for (const call of calls.fillText) {
      expect(call.y).toBeLessThanOrEqual(OV_H * CONTROL_BAR)
    }
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

describe('band logo on the title page', () => {
  /** Pixel size baked into a `ctx.font` shorthand string. */
  const fontSize = (font: string) =>
    parseFloat(font.match(/(\d+)px/)?.[1] ?? '0')
  const nameFont = (calls: { text: string; font: string }[]) =>
    fontSize(calls.find((c) => c.text === 'The Null Pointers')!.font)

  it('draws the band logo in addition to the corner logos', () => {
    const { ctx, calls } = createMockContext()
    composeTitleOverlay(ctx, {
      ...baseTitle,
      bottbLogo: fakeLogo,
      companyLogos: [fakeLogo],
      bandLogo: fakeLogo,
    })
    expect(calls.drawImage).toHaveLength(3)
  })

  it('steps the band name back to a supporting size', () => {
    const withLogo = createMockContext()
    composeTitleOverlay(withLogo.ctx, { ...baseTitle, bandLogo: fakeLogo })
    const without = createMockContext()
    composeTitleOverlay(without.ctx, baseTitle)

    expect(nameFont(withLogo.calls.fillText)).toBeLessThan(
      nameFont(without.calls.fillText)
    )
  })

  it('leaves the layout untouched when the band has no logo', () => {
    const absent = createMockContext()
    composeTitleOverlay(absent.ctx, baseTitle)
    const explicitNull = createMockContext()
    composeTitleOverlay(explicitNull.ctx, { ...baseTitle, bandLogo: null })

    expect(explicitNull.calls.fillText).toEqual(absent.calls.fillText)
    expect(explicitNull.calls.drawImage).toEqual(absent.calls.drawImage)
  })

  it('keeps the block clear of the sponsor row when a logo is present', () => {
    const { ctx, calls } = createMockContext()
    composeTitleOverlay(ctx, {
      ...baseTitle,
      bandLogo: fakeLogo,
      partnerLogo: fakeLogo,
      youngcareLogo: fakeLogo,
    })
    const sponsorLabel = calls.fillText.find((c) => c.text === 'POWERED BY')!
    const lowestCopy = Math.max(
      ...calls.fillText
        .filter((c) => c.text !== 'POWERED BY' && c.text !== 'SUPPORTING')
        .map((c) => c.y)
    )
    expect(lowestCopy).toBeLessThan(sponsorLabel.y)
  })
})
