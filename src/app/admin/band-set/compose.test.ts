import { createCanvas } from '@napi-rs/canvas'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { keyOpaqueLogo, keyWhiteToAlpha, type LogoSource } from '@/lib/canvas'
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
import {
  cityFromEventName,
  composeFilmicCredits,
  composeFilmicTitle,
  filmicDate,
  PRESENTS_LINE,
  type FilmicCreditsContent,
  type FilmicTitleContent,
} from './filmic'

/**
 * A minimal recording stand-in for a 2D canvas context. jsdom has no real
 * canvas, and the compose functions only need the handful of methods below,
 * so we record the drawImage / fillText / rect calls we care about.
 */
function createMockContext({ letterSpacing = true } = {}) {
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
    ...(letterSpacing ? { letterSpacing: '0px' } : {}),
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
    // Packed left-to-right from the left edge, not overlapping, and
    // bottom-aligned so wordmark baselines line up.
    expect(sx).toBeGreaterThanOrEqual(fx + fw)
    expect(fy + fh).toBeCloseTo(sy + sh, 5)
    // Width-penalised sizing: the 3:1 wordmark renders shorter than the
    // square mark rather than towering over it at the same height.
    expect(sh).toBeLessThan(fh)
    expect(sh).toBeCloseTo(fh * Math.pow(1 / 3, 0.62), 0)
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

describe('filmic title', () => {
  const filmicTitle: FilmicTitleContent = {
    bandName: 'The Null Pointers',
    bandLogo: fakeLogo,
    companyLogos: [fakeLogo],
    venue: 'The Factory Theatre',
    city: 'Sydney',
    date: '23 October 2025',
  }

  it('paints an opaque black card over the whole frame', () => {
    const { ctx, calls } = createMockContext()
    composeFilmicTitle(ctx, filmicTitle)
    expect(calls.fillRect[0]).toEqual([0, 0, OV_W, OV_H])
  })

  it('sets the "presents" line as text, above the band logo', () => {
    const { ctx, calls } = createMockContext()
    composeFilmicTitle(ctx, filmicTitle)
    const presents = calls.fillText.find((c) => c.text === PRESENTS_LINE)
    expect(presents).toBeDefined()
    // Nudged right by half the tracking so the ink, not the box, is centred.
    expect(Math.abs(presents!.x - OV_W / 2)).toBeLessThanOrEqual(16)
    const [, , logoY] = calls.drawImage[0] as number[]
    expect(presents!.y).toBeLessThan(logoY)
  })

  it('draws no corner logos: only the band logo and the company logo, centred', () => {
    const { ctx, calls } = createMockContext()
    composeFilmicTitle(ctx, filmicTitle)
    expect(calls.drawImage).toHaveLength(2)
    for (const [, x, y, w] of calls.drawImage as number[][]) {
      expect(x + w / 2).toBeCloseTo(OV_W / 2, 0)
      expect(y).toBeGreaterThan(OV_H * 0.3)
    }
  })

  it('draws "from" and the live-at line, uppercase', () => {
    const { ctx, calls } = createMockContext()
    composeFilmicTitle(ctx, filmicTitle)
    const drawn = calls.fillText.map((c) => c.text)
    expect(drawn).toContain('FROM')
    expect(drawn).toContain(
      'LIVE AT THE FACTORY THEATRE  ·  SYDNEY  ·  23 OCTOBER 2025'
    )
  })

  it('falls back to the band name when there is no band logo', () => {
    const { ctx, calls } = createMockContext()
    composeFilmicTitle(ctx, { ...filmicTitle, bandLogo: null })
    expect(calls.fillText.map((c) => c.text)).toContain('THE NULL POINTERS')
    expect(calls.drawImage).toHaveLength(1)
  })

  it('tracks type a glyph at a time where letterSpacing is unsupported', () => {
    const { ctx, calls } = createMockContext({ letterSpacing: false })
    composeFilmicTitle(ctx, filmicTitle)
    expect(calls.fillText.map((c) => c.text).join('')).toContain(PRESENTS_LINE)
    expect(calls.fillText.every((c) => [...c.text].length === 1)).toBe(true)
  })
})

describe('filmic credits', () => {
  const filmicCredits: FilmicCreditsContent = {
    bandName: 'The Null Pointers',
    members: [
      { name: 'John Smith', role: 'Guitar' },
      { name: 'Jane Doe', role: 'Vocals' },
      { name: '', role: '' },
    ],
    showMembers: true,
    scrim: true,
    companyLogos: [fakeLogo],
    bottbLogo: fakeLogo,
    partnerLogo: fakeLogo,
    youngcareLogo: fakeLogo,
    venue: 'The Factory Theatre',
    city: 'Sydney',
    date: '23 October 2025',
  }
  const textOf = (calls: { text: string }[]) => calls.map((c) => c.text)

  it('bakes in a full-frame scrim only when asked', () => {
    const on = createMockContext()
    composeFilmicCredits(on.ctx, filmicCredits)
    expect(on.calls.fillRect[0]).toEqual([0, 0, OV_W, OV_H])
    const off = createMockContext()
    composeFilmicCredits(off.ctx, { ...filmicCredits, scrim: false })
    expect(off.calls.fillRect).toHaveLength(0)
  })

  it('draws role | name rows in the order given, about the centre line', () => {
    const { ctx, calls } = createMockContext()
    composeFilmicCredits(ctx, filmicCredits)
    const drawn = textOf(calls.fillText)
    expect(drawn.indexOf('John Smith')).toBeLessThan(drawn.indexOf('Jane Doe'))
    const role = calls.fillText.find((c) => c.text === 'GUITAR')!
    const name = calls.fillText.find((c) => c.text === 'John Smith')!
    expect(role.y).toBe(name.y)
    expect(role.x).toBeLessThan(OV_W / 2)
    expect(name.x).toBeGreaterThan(OV_W / 2)
  })

  it('draws the band name, the recorded-live line and the captioned logo row', () => {
    const { ctx, calls } = createMockContext()
    composeFilmicCredits(ctx, filmicCredits)
    const drawn = textOf(calls.fillText)
    expect(drawn).toContain('THE NULL POINTERS')
    expect(drawn).toContain(
      'RECORDED LIVE AT THE FACTORY THEATRE, SYDNEY  ·  23 OCTOBER 2025'
    )
    expect(drawn).toContain('POWERED BY')
    expect(drawn).toContain('SUPPORTING')
    // Company, Bottb wordmark, partner, Youngcare: one row, one centre line.
    expect(calls.drawImage).toHaveLength(4)
    const centres = (calls.drawImage as number[][]).map(
      ([, , y, , h]) => y + h / 2
    )
    for (const c of centres) expect(c).toBeCloseTo(centres[0], 5)
  })

  it('omits any logo that is missing', () => {
    const { ctx, calls } = createMockContext()
    composeFilmicCredits(ctx, {
      ...filmicCredits,
      partnerLogo: null,
      youngcareLogo: null,
    })
    expect(calls.drawImage).toHaveLength(2)
    expect(textOf(calls.fillText)).not.toContain('POWERED BY')
  })

  it('the no-members variant draws no member rows and re-centres the block', () => {
    const withMembers = createMockContext()
    composeFilmicCredits(withMembers.ctx, filmicCredits)
    const { ctx, calls } = createMockContext()
    composeFilmicCredits(ctx, { ...filmicCredits, showMembers: false })
    const drawn = textOf(calls.fillText)
    for (const text of ['John Smith', 'Jane Doe', 'GUITAR', 'VOCALS']) {
      expect(drawn).not.toContain(text)
    }
    const nameY = (c: { text: string; y: number }[]) =>
      c.find((t) => t.text === 'THE NULL POINTERS')!.y
    // Pulled down from the top so the card is not empty above the copy.
    expect(nameY(calls.fillText)).toBeGreaterThan(
      nameY(withMembers.calls.fillText) + OV_H * 0.1
    )
    const ys = (calls.drawImage as number[][]).map(([, , y, , h]) => y + h)
    expect(Math.max(...ys)).toBeLessThan(OV_H * 0.8)
  })

  it('treats a roster with no named members as the no-members variant', () => {
    const off = createMockContext()
    composeFilmicCredits(off.ctx, { ...filmicCredits, showMembers: false })
    const empty = createMockContext()
    composeFilmicCredits(empty.ctx, {
      ...filmicCredits,
      members: [{ name: '  ', role: 'Bass' }],
    })
    expect(empty.calls.fillText).toEqual(off.calls.fillText)
  })

  it('keeps a long roster clear of the bottom safe area', () => {
    const { ctx, calls } = createMockContext()
    composeFilmicCredits(ctx, {
      ...filmicCredits,
      members: Array.from({ length: 12 }, (_, i) => ({
        name: `Member${i}`,
        role: 'Guitar',
      })),
    })
    for (const [, , y, , h] of calls.drawImage as number[][]) {
      expect(y + h).toBeLessThanOrEqual(OV_H * 0.9)
    }
    const lastMember = calls.fillText.find((c) => c.text === 'Member11')!
    const recorded = calls.fillText.find((c) => c.text.startsWith('RECORDED'))!
    expect(lastMember.y).toBeLessThan(recorded.y)
  })
})

describe('filmic text helpers', () => {
  it('derives the city from the event name', () => {
    expect(cityFromEventName('Sydney 2025')).toBe('Sydney')
    expect(cityFromEventName('Brisbane')).toBe('Brisbane')
  })

  it('formats dates as "D Month YYYY"', () => {
    expect(filmicDate('23rd October 2025')).toBe('23 October 2025')
    expect(filmicDate('1st June 2026 @ 6:30PM')).toBe('1 June 2026')
  })
})

describe('keyOpaqueLogo', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  /** Route the helper's scratch canvases through @napi-rs/canvas (jsdom has none). */
  function useRealCanvas() {
    vi.spyOn(document, 'createElement').mockImplementation(
      () => createCanvas(1, 1) as unknown as HTMLElement
    )
  }

  /** A `w`×`h` image: `bg` everywhere, with a `fg` block in the middle. */
  function makeLogo(w: number, h: number, bg: string, fg: string) {
    const canvas = createCanvas(w, h)
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = fg
    ctx.fillRect(w / 4, h / 4, w / 2, h / 2)
    return canvas
  }

  function pixel(source: LogoSource, x: number, y: number): number[] {
    const canvas = source as unknown as ReturnType<typeof createCanvas>
    return Array.from(canvas.getContext('2d').getImageData(x, y, 1, 1).data)
  }

  it('keys an opaque white-background logo to white on transparent, trimmed', () => {
    useRealCanvas()
    const logo = makeLogo(40, 20, '#ffffff', '#000000')
    const keyed = keyOpaqueLogo(logo as unknown as LogoSource)
    expect(keyed).not.toBe(logo)
    // Rasterised up to 1600 px across, then trimmed to the dark block (plus
    // the soft edge the upscale smooths in).
    expect(keyed.width).toBeGreaterThanOrEqual(800)
    expect(keyed.width).toBeLessThan(860)
    expect(keyed.height).toBeGreaterThanOrEqual(400)
    expect(keyed.height).toBeLessThan(460)
    const mid = pixel(keyed, keyed.width / 2, keyed.height / 2)
    expect(mid).toEqual([255, 255, 255, 255])
    // The soft edge is white too, just partly see-through.
    const row = Array.from({ length: keyed.width }, (_, x) =>
      pixel(keyed, x, keyed.height / 2)
    )
    const edge = row.filter(([, , , a]) => a > 64 && a < 255)
    expect(edge.length).toBeGreaterThan(0)
    for (const [r, g, b] of edge) {
      expect(Math.min(r, g, b)).toBeGreaterThanOrEqual(250)
    }
  })

  it('maps luminance to alpha: white clears, black is solid, grey in between', () => {
    const data = new Uint8ClampedArray([
      255, 255, 255, 255, 0, 0, 0, 255, 128, 128, 128, 255,
    ])
    keyWhiteToAlpha(data)
    expect(Array.from(data)).toEqual([
      255, 255, 255, 0, 255, 255, 255, 255, 255, 255, 255, 134,
    ])
  })

  it('leaves a logo that already has transparency unchanged', () => {
    useRealCanvas()
    const logo = makeLogo(40, 20, 'rgba(0,0,0,0)', '#ff0000')
    expect(keyOpaqueLogo(logo as unknown as LogoSource)).toBe(logo)
  })

  it('leaves an opaque logo on a dark background unchanged', () => {
    useRealCanvas()
    const logo = makeLogo(40, 20, '#000000', '#ffffff')
    expect(keyOpaqueLogo(logo as unknown as LogoSource)).toBe(logo)
  })
})
