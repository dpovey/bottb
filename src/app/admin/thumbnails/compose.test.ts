import { describe, expect, it } from 'vitest'
import {
  composeOverlay,
  composeYouTube,
  OV_H,
  OV_W,
  YT_H,
  YT_W,
} from './compose'
import { MIN_TYPE } from '../video-safe-area'
import type { ThumbnailContent } from './compose'

/**
 * A minimal recording stand-in for a 2D canvas context — jsdom has no real
 * canvas. `measureText` is font-size aware (unlike a fixed per-character
 * width) so the shrink-to-fit and word-wrap paths behave realistically.
 */
function createMockContext() {
  const calls = {
    fillText: [] as { text: string; x: number; y: number; font: string }[],
    drawImage: [] as number[][],
    fillRect: [] as number[][],
    clearRect: [] as number[][],
  }
  const ctx = {
    font: '16px sans-serif',
    fillStyle: '' as string | CanvasGradient,
    textAlign: 'left',
    textBaseline: 'alphabetic',
    shadowColor: '',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    clearRect: (...a: number[]) => calls.clearRect.push(a),
    fillRect: (...a: number[]) => calls.fillRect.push(a),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    save: () => {},
    restore: () => {},
    drawImage: (...a: unknown[]) => calls.drawImage.push(a as number[]),
    measureText: (t: string) => ({
      width:
        t.length * (parseFloat(ctx.font.match(/(\d+)px/)?.[1] ?? '16') * 0.5),
    }),
    fillText: (text: string, x: number, y: number) =>
      calls.fillText.push({ text, x, y, font: ctx.font }),
  }
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls }
}

const fakeLogo = { naturalWidth: 200, naturalHeight: 200 } as HTMLImageElement

const base: ThumbnailContent = {
  artist: 'The Coral Sea Riot',
  song: 'Everlong',
  bottbLogo: null,
  companyLogos: [],
  bottbCorner: 'top-right',
}

/** Pixel size baked into a `ctx.font` shorthand string. */
function fontSize(font: string): number {
  return parseFloat(font.match(/(\d+)px/)?.[1] ?? '0')
}

describe('composeYouTube', () => {
  it('exposes the 1080p thumbnail and 4K overlay dimensions', () => {
    expect([YT_W, YT_H]).toEqual([1920, 1080])
    expect([OV_W, OV_H]).toEqual([3840, 2160])
  })

  it('draws the artist and song over a frame with scrims', () => {
    const { ctx, calls } = createMockContext()
    composeYouTube(ctx, fakeLogo, 4000, 3000, base)
    expect(calls.fillText.map((c) => c.text)).toEqual([
      'Everlong',
      'The Coral Sea Riot',
    ])
    expect(calls.drawImage).toHaveLength(1) // the frame; no logos supplied
    expect(calls.fillRect.length).toBeGreaterThanOrEqual(2) // top + bottom scrims
  })
})

describe('safe areas', () => {
  /** SMPTE HD title-safe is the inner 90%; the YT control bar eats the bottom ~10%. */
  const TITLE_SAFE = 0.05
  const CONTROL_BAR = 0.9

  it('insets both corner logos inside title-safe', () => {
    const { ctx, calls } = createMockContext()
    composeOverlay(ctx, {
      ...base,
      bottbLogo: fakeLogo,
      companyLogos: [fakeLogo],
    })
    expect(calls.drawImage).toHaveLength(2)
    for (const [, x, y, w, h] of calls.drawImage) {
      expect(x).toBeGreaterThanOrEqual(OV_W * TITLE_SAFE)
      expect(y).toBeGreaterThanOrEqual(OV_H * TITLE_SAFE)
      expect(x + w).toBeLessThanOrEqual(OV_W * (1 - TITLE_SAFE))
      expect(y + h).toBeLessThanOrEqual(OV_H * (1 - TITLE_SAFE))
    }
  })

  it('starts the text at the horizontal safe margin, clear of the control bar', () => {
    const { ctx, calls } = createMockContext()
    composeOverlay(ctx, base)
    for (const call of calls.fillText) {
      expect(call.x).toBeGreaterThanOrEqual(OV_W * TITLE_SAFE)
      expect(call.y).toBeLessThanOrEqual(OV_H * CONTROL_BAR)
    }
  })

  it('keeps the artist above the hero legibility floor', () => {
    const { ctx, calls } = createMockContext()
    composeOverlay(ctx, base)
    const artist = calls.fillText.find((c) => c.text === 'The Coral Sea Riot')
    expect(fontSize(artist!.font)).toBeGreaterThanOrEqual(OV_H * MIN_TYPE.hero)
  })
})

describe('long text', () => {
  const longArtist =
    'The Extraordinarily Long Named Persistence Layer Orchestra'

  it('wraps a long artist name over two lines instead of running off-frame', () => {
    const { ctx, calls } = createMockContext()
    composeOverlay(ctx, { ...base, artist: longArtist })
    const lines = calls.fillText.filter((c) => c.text !== 'Everlong')
    expect(lines).toHaveLength(2)
    // Wrapping is lossless and stays in reading order (drawn bottom-up).
    expect(
      [...lines]
        .reverse()
        .map((c) => c.text)
        .join(' ')
    ).toBe(longArtist)

    const size = fontSize(lines[0].font)
    const safeW = OV_W - OV_W * 0.06 * 2
    for (const line of lines) {
      expect(line.text.length * size * 0.5).toBeLessThanOrEqual(safeW)
    }
  })

  it('shrinks a long song title rather than wrapping it', () => {
    const { ctx, calls } = createMockContext()
    const song = 'Everlong (Acoustic Version, Live at the Tivoli, Brisbane)'
    composeOverlay(ctx, { ...base, song })
    const drawn = calls.fillText.filter((c) => c.text === song)
    expect(drawn).toHaveLength(1)
    expect(fontSize(drawn[0].font)).toBeGreaterThanOrEqual(
      OV_H * MIN_TYPE.primary
    )
  })
})

describe('artist and version', () => {
  it('draws the version between the artist and the song', () => {
    const { ctx, calls } = createMockContext()
    composeOverlay(ctx, {
      ...base,
      artist: 'Sabrina Carpenter',
      song: 'Espresso',
      version: 'Good Neighbours version',
    })
    const y = (text: string) => calls.fillText.find((c) => c.text === text)!.y
    // Smaller y is higher up the frame.
    expect(y('Sabrina Carpenter')).toBeLessThan(y('Good Neighbours version'))
    expect(y('Good Neighbours version')).toBeLessThan(y('Espresso'))
  })

  it('draws nothing extra when there is no version', () => {
    const { ctx, calls } = createMockContext()
    composeOverlay(ctx, base)
    expect(calls.fillText).toHaveLength(2)
  })

  it('sets the version smaller than the song', () => {
    const { ctx, calls } = createMockContext()
    composeOverlay(ctx, { ...base, version: 'Good Neighbours version' })
    const size = (text: string) =>
      fontSize(calls.fillText.find((c) => c.text === text)!.font)
    expect(size('Good Neighbours version')).toBeLessThan(size('Everlong'))
  })

  it('shrinks a mid-length artist rather than breaking it', () => {
    const { ctx, calls } = createMockContext()
    composeOverlay(ctx, { ...base, artist: 'Nick Cave and the Bad Seeds' })
    const lines = calls.fillText.filter((c) => c.text !== 'Everlong')
    expect(lines).toHaveLength(1)
    // It had to give up some size to hold that single line.
    expect(fontSize(lines[0].font)).toBeLessThan(Math.round(OV_H * 0.125))
  })

  it('still falls back to two lines when shrinking is not enough', () => {
    const { ctx, calls } = createMockContext()
    composeOverlay(ctx, {
      ...base,
      artist: 'The Extraordinarily Long Named Persistence Layer Orchestra',
    })
    expect(calls.fillText.filter((c) => c.text !== 'Everlong')).toHaveLength(2)
  })

  it('never takes the artist below the hero floor', () => {
    const { ctx, calls } = createMockContext()
    composeOverlay(ctx, { ...base, artist: 'Supercalifragilistic'.repeat(12) })
    const lines = calls.fillText.filter((c) => c.text !== 'Everlong')
    for (const line of lines) {
      expect(fontSize(line.font)).toBeGreaterThanOrEqual(OV_H * MIN_TYPE.hero)
    }
  })
})
