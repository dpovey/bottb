import { describe, it, expect } from 'vitest'
import {
  isShuffleEnabled,
  parseShuffleFromUrl,
  generateShuffleSeed,
  buildPhotoApiParams,
  buildPhotoUrl,
  createShuffleStateFromParam,
  resolveShuffleSeed,
  type ShuffleParam,
  type ShuffleState,
} from '../shuffle-types'

describe('isShuffleEnabled', () => {
  it('returns true for "true" string', () => {
    expect(isShuffleEnabled('true')).toBe(true)
  })

  it('returns true for specific seed string', () => {
    expect(isShuffleEnabled('abc123')).toBe(true)
    expect(isShuffleEnabled('my-seed')).toBe(true)
  })

  it('returns false for null', () => {
    expect(isShuffleEnabled(null)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isShuffleEnabled(undefined)).toBe(false)
  })

  it('returns false for "false" string', () => {
    expect(isShuffleEnabled('false')).toBe(false)
  })
})

describe('parseShuffleFromUrl', () => {
  it('parses shuffle=true from URL', () => {
    const params = new URLSearchParams('shuffle=true')
    expect(parseShuffleFromUrl(params)).toBe('true')
  })

  it('parses shuffle=<seed> from URL', () => {
    const params = new URLSearchParams('shuffle=abc123')
    expect(parseShuffleFromUrl(params)).toBe('abc123')
  })

  it('returns null when shuffle param is missing', () => {
    const params = new URLSearchParams('event=123')
    expect(parseShuffleFromUrl(params)).toBeNull()
  })

  it('returns null when shuffle=false', () => {
    const params = new URLSearchParams('shuffle=false')
    expect(parseShuffleFromUrl(params)).toBeNull()
  })

  it('works with object that has get method', () => {
    const mockSearchParams = {
      get: (key: string) => (key === 'shuffle' ? 'test-seed' : null),
    }
    expect(parseShuffleFromUrl(mockSearchParams)).toBe('test-seed')
  })
})

describe('generateShuffleSeed', () => {
  it('generates a non-empty string', () => {
    const seed = generateShuffleSeed()
    expect(typeof seed).toBe('string')
    expect(seed.length).toBeGreaterThan(0)
  })

  it('generates different seeds on each call', () => {
    const seed1 = generateShuffleSeed()
    const seed2 = generateShuffleSeed()
    expect(seed1).not.toBe(seed2)
  })

  it('generates URL-safe strings', () => {
    const seed = generateShuffleSeed()
    // Should only contain alphanumeric characters
    expect(seed).toMatch(/^[a-z0-9]+$/)
  })
})

describe('buildPhotoApiParams', () => {
  it('includes shuffle param when enabled', () => {
    const params = buildPhotoApiParams({ shuffle: 'abc123' })
    expect(params.get('shuffle')).toBe('abc123')
  })

  it('includes shuffle=true when passed', () => {
    const params = buildPhotoApiParams({ shuffle: 'true' })
    expect(params.get('shuffle')).toBe('true')
  })

  it('does not include shuffle param when null', () => {
    const params = buildPhotoApiParams({ shuffle: null })
    expect(params.has('shuffle')).toBe(false)
  })

  it('does not include shuffle param when undefined', () => {
    const params = buildPhotoApiParams({})
    expect(params.has('shuffle')).toBe(false)
  })

  it('never includes order=random (deprecated)', () => {
    const params = buildPhotoApiParams({ shuffle: 'abc123' })
    expect(params.has('order')).toBe(false)
  })

  it('never includes separate seed param', () => {
    const params = buildPhotoApiParams({ shuffle: 'abc123' })
    expect(params.has('seed')).toBe(false)
  })

  it('includes all filter params', () => {
    const params = buildPhotoApiParams({
      eventId: 'event-1',
      bandId: 'band-1',
      photographer: 'John Doe',
      companySlug: 'acme',
    })

    expect(params.get('event')).toBe('event-1')
    expect(params.get('band')).toBe('band-1')
    expect(params.get('photographer')).toBe('John Doe')
    expect(params.get('company')).toBe('acme')
  })

  it('includes pagination params', () => {
    const params = buildPhotoApiParams({ page: 2, limit: 25 })
    expect(params.get('page')).toBe('2')
    expect(params.get('limit')).toBe('25')
  })

  it('includes skipMeta param when true', () => {
    const params = buildPhotoApiParams({ skipMeta: true })
    expect(params.get('skipMeta')).toBe('true')
  })

  it('builds complete params for gallery request', () => {
    const params = buildPhotoApiParams({
      eventId: 'event-1',
      shuffle: 'my-seed',
      page: 1,
      limit: 50,
    })

    expect(params.toString()).toBe(
      'event=event-1&shuffle=my-seed&page=1&limit=50'
    )
  })
})

describe('buildPhotoUrl', () => {
  it('builds basic photo URL', () => {
    const url = buildPhotoUrl({ photoSlug: 'band-event-1' })
    expect(url).toBe('/photos/band-event-1')
  })

  it('includes shuffle param when provided', () => {
    const url = buildPhotoUrl({
      photoSlug: 'band-event-1',
      shuffle: 'abc123',
    })
    expect(url).toBe('/photos/band-event-1?shuffle=abc123')
  })

  it('includes event filter', () => {
    const url = buildPhotoUrl({
      photoSlug: 'band-event-1',
      eventId: 'event-1',
    })
    expect(url).toBe('/photos/band-event-1?event=event-1')
  })

  it('includes all filters and shuffle', () => {
    const url = buildPhotoUrl({
      photoSlug: 'band-event-1',
      eventId: 'event-1',
      photographer: 'John Doe',
      companySlug: 'acme',
      shuffle: 'seed123',
    })

    // Parse the URL to check params
    const urlObj = new URL(url, 'http://localhost')
    expect(urlObj.pathname).toBe('/photos/band-event-1')
    expect(urlObj.searchParams.get('event')).toBe('event-1')
    expect(urlObj.searchParams.get('photographer')).toBe('John Doe')
    expect(urlObj.searchParams.get('company')).toBe('acme')
    expect(urlObj.searchParams.get('shuffle')).toBe('seed123')
  })

  it('does not include shuffle when null', () => {
    const url = buildPhotoUrl({
      photoSlug: 'band-event-1',
      shuffle: null,
    })
    expect(url).toBe('/photos/band-event-1')
  })

  it('does not include shuffle when "false"', () => {
    const url = buildPhotoUrl({
      photoSlug: 'band-event-1',
      shuffle: 'false',
    })
    expect(url).toBe('/photos/band-event-1')
  })
})

describe('createShuffleStateFromParam', () => {
  it('creates disabled state for null', () => {
    const state = createShuffleStateFromParam(null)
    expect(state).toEqual({ enabled: false, seed: null })
  })

  it('creates disabled state for undefined', () => {
    const state = createShuffleStateFromParam(undefined)
    expect(state).toEqual({ enabled: false, seed: null })
  })

  it('creates enabled state with null seed for "true"', () => {
    const state = createShuffleStateFromParam('true')
    expect(state).toEqual({ enabled: true, seed: null })
  })

  it('creates enabled state with seed for specific seed', () => {
    const state = createShuffleStateFromParam('abc123')
    expect(state).toEqual({ enabled: true, seed: 'abc123' })
  })
})

describe('resolveShuffleSeed', () => {
  it('returns same state if not enabled', () => {
    const state: ShuffleState = { enabled: false, seed: null }
    const resolved = resolveShuffleSeed(state, 'new-seed')
    expect(resolved).toEqual({ enabled: false, seed: null })
  })

  it('updates seed when resolved', () => {
    const state: ShuffleState = { enabled: true, seed: null }
    const resolved = resolveShuffleSeed(state, 'resolved-seed')
    expect(resolved).toEqual({ enabled: true, seed: 'resolved-seed' })
  })

  it('keeps existing seed if resolved is null', () => {
    const state: ShuffleState = { enabled: true, seed: 'existing-seed' }
    const resolved = resolveShuffleSeed(state, null)
    expect(resolved).toEqual({ enabled: true, seed: 'existing-seed' })
  })

  it('replaces existing seed with resolved', () => {
    const state: ShuffleState = { enabled: true, seed: 'old-seed' }
    const resolved = resolveShuffleSeed(state, 'new-seed')
    expect(resolved).toEqual({ enabled: true, seed: 'new-seed' })
  })
})

describe('Type safety guarantees', () => {
  it('buildPhotoApiParams always uses shuffle, never seed or order', () => {
    // This test documents the type contract
    const allOptions = {
      eventId: 'e',
      bandId: 'b',
      photographer: 'p',
      companySlug: 'c',
      shuffle: 'seed' as ShuffleParam,
      page: 1,
      limit: 50,
      skipMeta: true,
    }

    const params = buildPhotoApiParams(allOptions)

    // These assertions verify the function NEVER uses deprecated params
    expect(params.has('seed')).toBe(false)
    expect(params.has('order')).toBe(false)

    // Only 'shuffle' is used for random ordering
    expect(params.get('shuffle')).toBe('seed')
  })

  it('buildPhotoUrl produces URLs compatible with gallery URLs', () => {
    // Gallery builds: /photos/{slug}?shuffle={seed}
    // Photo page should parse: ?shuffle={seed}

    const url = buildPhotoUrl({
      photoSlug: 'band-event-1',
      eventId: 'event-1',
      shuffle: 'gallery-seed',
    })

    // Verify the URL format matches what the gallery produces
    expect(url).toContain('shuffle=gallery-seed')
    expect(url).not.toContain('seed=')
    expect(url).not.toContain('order=')
  })
})
