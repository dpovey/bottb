import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Sharp mock — records every resize() call and lets us program metadata
 * via the `__setMetadata` helper. Each clone()/resize()/webp() chain
 * resolves to a Buffer tagged with the requested target so tests can
 * verify which variants were produced.
 */
type Metadata = { width?: number; height?: number; format?: string }

const sharpState = vi.hoisted(() => {
  const state: {
    metadata: Metadata
    resizeCalls: Array<{
      width: number
      height: number
      options: { fit?: string; withoutEnlargement?: boolean }
    }>
    webpCalls: Array<{ quality?: number }>
  } = {
    metadata: { width: 0, height: 0, format: 'jpeg' },
    resizeCalls: [],
    webpCalls: [],
  }
  return state
})

vi.mock('sharp', () => {
  const makeChain = (label = 'root') => {
    const chain = {
      _label: label,
      clone: vi.fn(() => makeChain('clone')),
      resize: vi.fn(
        (
          width: number,
          height: number,
          options: { fit?: string; withoutEnlargement?: boolean } = {}
        ) => {
          sharpState.resizeCalls.push({ width, height, options })
          return chain
        }
      ),
      webp: vi.fn((opts: { quality?: number } = {}) => {
        sharpState.webpCalls.push(opts)
        return chain
      }),
      toBuffer: vi.fn(async () => {
        // Use the most recent resize target as the tag so tests can
        // distinguish thumbnails from large variants in the output.
        const last = sharpState.resizeCalls[sharpState.resizeCalls.length - 1]
        const tag = last ? `variant-${last.width}` : 'no-resize'
        return Buffer.from(tag)
      }),
      metadata: vi.fn(async () => sharpState.metadata),
    }
    return chain
  }

  const sharp = vi.fn(() => makeChain('input'))
  return { default: sharp }
})

// Import after the mock is set up.
import { getImageDimensions, processImage } from '../image-processor'

const setMetadata = (md: Metadata) => {
  sharpState.metadata = { format: 'jpeg', ...md }
}

beforeEach(() => {
  sharpState.resizeCalls = []
  sharpState.webpCalls = []
  setMetadata({ width: 0, height: 0, format: 'jpeg' })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('image-processor', () => {
  describe('processImage variant generation', () => {
    it('always produces thumbnail and large variants', async () => {
      setMetadata({ width: 500, height: 400, format: 'jpeg' })
      const result = await processImage(Buffer.from('image-bytes'))

      expect(result.thumbnail).toBeInstanceOf(Buffer)
      expect(result.large).toBeInstanceOf(Buffer)
      expect(result.width).toBe(500)
      expect(result.height).toBe(400)
      expect(result.format).toBe('jpeg')
    })

    it('skips thumbnail2x for small images (<600px on both sides)', async () => {
      setMetadata({ width: 500, height: 400 })
      const result = await processImage(Buffer.from('tiny'))

      expect(result.thumbnail2x).toBeUndefined()
      expect(result.medium).toBeUndefined()
      expect(result.large4k).toBeUndefined()
    })

    it('produces thumbnail2x when the image is >=600 on either side', async () => {
      setMetadata({ width: 700, height: 500 })
      const result = await processImage(Buffer.from('medium'))

      expect(result.thumbnail2x).toBeInstanceOf(Buffer)
      expect(result.medium).toBeUndefined()
    })

    it('produces medium variant when the image is >=900 on either side', async () => {
      setMetadata({ width: 1000, height: 600 })
      const result = await processImage(Buffer.from('big-enough'))

      expect(result.thumbnail2x).toBeInstanceOf(Buffer)
      expect(result.medium).toBeInstanceOf(Buffer)
      expect(result.large4k).toBeUndefined()
    })

    it('produces 4K variant when the image is >=4000px on either side', async () => {
      setMetadata({ width: 5000, height: 3000 })
      const result = await processImage(Buffer.from('huge'))

      expect(result.thumbnail).toBeInstanceOf(Buffer)
      expect(result.thumbnail2x).toBeInstanceOf(Buffer)
      expect(result.medium).toBeInstanceOf(Buffer)
      expect(result.large).toBeInstanceOf(Buffer)
      expect(result.large4k).toBeInstanceOf(Buffer)
    })

    it('uses inside-fit + withoutEnlargement to preserve aspect ratio', async () => {
      setMetadata({ width: 1200, height: 800 })
      await processImage(Buffer.from('aspect-test'))

      // Every resize must use 'inside' fit so CSS object-position can
      // crop at the focal point without the resizer doing it first.
      expect(sharpState.resizeCalls.length).toBeGreaterThan(0)
      sharpState.resizeCalls.forEach((call) => {
        expect(call.options.fit).toBe('inside')
        expect(call.options.withoutEnlargement).toBe(true)
      })
    })

    it('targets the documented size buckets in order', async () => {
      setMetadata({ width: 5000, height: 5000 })
      await processImage(Buffer.from('all-variants'))

      const widths = sharpState.resizeCalls.map((c) => c.width)
      expect(widths).toEqual([400, 800, 1200, 2000, 4000])
    })

    it('uses higher quality for medium and 4K than thumbnails', async () => {
      setMetadata({ width: 5000, height: 5000 })
      await processImage(Buffer.from('quality-test'))

      // Order: thumbnail, thumbnail2x, medium, large, large4k
      const qualities = sharpState.webpCalls.map((c) => c.quality)
      expect(qualities).toEqual([85, 85, 90, 92, 92])
    })

    it('handles a square image (equal width and height)', async () => {
      setMetadata({ width: 800, height: 800 })
      const result = await processImage(Buffer.from('square'))

      expect(result.width).toBe(result.height)
      expect(result.thumbnail2x).toBeInstanceOf(Buffer)
      // 800 === 900 lower bound for medium → false, so no medium
      expect(result.medium).toBeUndefined()
    })

    it('handles an extreme portrait aspect ratio', async () => {
      setMetadata({ width: 100, height: 4000 })
      const result = await processImage(Buffer.from('tall'))

      // Long side is 4000 → triggers all variants
      expect(result.thumbnail2x).toBeInstanceOf(Buffer)
      expect(result.medium).toBeInstanceOf(Buffer)
      expect(result.large4k).toBeInstanceOf(Buffer)
      expect(result.height).toBe(4000)
    })

    it('handles an extreme landscape aspect ratio', async () => {
      setMetadata({ width: 4500, height: 200 })
      const result = await processImage(Buffer.from('wide'))

      expect(result.large4k).toBeInstanceOf(Buffer)
      expect(result.width).toBe(4500)
    })

    it('falls back to defaults when metadata is missing', async () => {
      setMetadata({ width: undefined, height: undefined, format: undefined })
      const result = await processImage(Buffer.from('no-meta'))

      expect(result.width).toBe(0)
      expect(result.height).toBe(0)
      expect(result.format).toBe('jpeg')
      // Tiny effective dimensions → optional variants skipped
      expect(result.thumbnail2x).toBeUndefined()
      expect(result.medium).toBeUndefined()
      expect(result.large4k).toBeUndefined()
    })

    it('reports the original byte length on the result', async () => {
      setMetadata({ width: 1000, height: 1000 })
      const buf = Buffer.from('x'.repeat(1234))
      const result = await processImage(buf)
      expect(result.fileSize).toBe(1234)
    })
  })

  describe('getImageDimensions', () => {
    it('returns width and height from sharp metadata', async () => {
      setMetadata({ width: 1280, height: 720 })
      const dims = await getImageDimensions(Buffer.from('vid'))
      expect(dims).toEqual({ width: 1280, height: 720 })
    })

    it('returns zeros when metadata is missing', async () => {
      setMetadata({})
      const dims = await getImageDimensions(Buffer.from('empty'))
      expect(dims).toEqual({ width: 0, height: 0 })
    })
  })
})
