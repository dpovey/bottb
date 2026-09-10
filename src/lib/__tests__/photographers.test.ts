import { sql } from '@vercel/postgres'
import { vi } from 'vitest'
import {
  getPhotographerBySlug,
  getPhotographerHeroPhoto,
  getPhotographerRandomPhoto,
  getPhotographers,
} from '../db'

// Helper to build a @vercel/postgres-style QueryResult
const createMockQueryResult = <T>(rows: T[]) => ({
  rows,
  command: 'SELECT',
  rowCount: rows.length,
  oid: 0,
  fields: [],
})

vi.mock('@vercel/postgres', () => ({
  sql: vi.fn(),
}))

const mockSql = sql as unknown as ReturnType<typeof vi.fn>

/** Reassemble the tagged-template SQL text from the mocked call. */
const queryText = (callIndex = 0): string =>
  (mockSql.mock.calls[callIndex][0] as string[]).join(' ')

/** The interpolated parameters of the mocked call. */
const queryParams = (callIndex = 0): unknown[] =>
  mockSql.mock.calls[callIndex].slice(1)

describe('photographer queries respect photo visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getPhotographers', () => {
    it('counts only public photos by default', async () => {
      mockSql.mockResolvedValue(createMockQueryResult([]))

      await getPhotographers()

      expect(queryText()).toContain("visibility = 'public'")
      // includePrivate defaults to false
      expect(queryParams()).toContain('false')
    })

    it('includes private photos in the count when an admin opts in', async () => {
      mockSql.mockResolvedValue(createMockQueryResult([]))

      await getPhotographers({ includePrivate: true })

      expect(queryParams()).toContain('true')
    })

    it('returns the rows with their photo counts', async () => {
      const rows = [{ slug: 'amy', name: 'Amy', photo_count: 3 }]
      mockSql.mockResolvedValue(createMockQueryResult(rows))

      await expect(getPhotographers()).resolves.toEqual(rows)
    })
  })

  describe('getPhotographerBySlug', () => {
    it('counts only public photos by default', async () => {
      mockSql.mockResolvedValue(createMockQueryResult([]))

      await getPhotographerBySlug('amy')

      expect(queryText()).toContain("visibility = 'public'")
      expect(queryParams()).toContain('false')
      expect(queryParams()).toContain('amy')
    })

    it('includes private photos in the count when an admin opts in', async () => {
      mockSql.mockResolvedValue(createMockQueryResult([]))

      await getPhotographerBySlug('amy', { includePrivate: true })

      expect(queryParams()).toContain('true')
    })

    it('returns null when no photographer matches the slug', async () => {
      mockSql.mockResolvedValue(createMockQueryResult([]))

      await expect(getPhotographerBySlug('nobody')).resolves.toBeNull()
    })
  })

  describe('getPhotographerHeroPhoto', () => {
    it('only considers public photos', async () => {
      mockSql.mockResolvedValue(createMockQueryResult([]))

      await getPhotographerHeroPhoto('Amy')

      expect(queryText()).toContain("p.visibility = 'public'")
      expect(queryText()).toContain("'photographer_hero' = ANY(p.labels)")
      expect(queryParams()).toContain('Amy')
    })

    it('returns null when the photographer has no public hero photo', async () => {
      mockSql.mockResolvedValue(createMockQueryResult([]))

      await expect(getPhotographerHeroPhoto('Amy')).resolves.toBeNull()
    })
  })

  describe('getPhotographerRandomPhoto', () => {
    it('only considers public photos', async () => {
      mockSql.mockResolvedValue(createMockQueryResult([]))

      await getPhotographerRandomPhoto('Amy')

      expect(queryText()).toContain("p.visibility = 'public'")
      expect(queryParams()).toContain('Amy')
    })

    it('returns null when the photographer has only private photos', async () => {
      mockSql.mockResolvedValue(createMockQueryResult([]))

      await expect(getPhotographerRandomPhoto('Amy')).resolves.toBeNull()
    })
  })
})

describe('band hero thumbnails only expose public photos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('guards the band_hero subqueries in getBandsForEvent', async () => {
    const { getBandsForEvent } = await import('../db')
    mockSql.mockResolvedValue(createMockQueryResult([]))

    await getBandsForEvent('event-1')

    const text = queryText()
    expect(text).toContain("'band_hero' = ANY(labels)")
    // Every band_hero lookup must be visibility-guarded
    const heroSubqueries = text.match(/'band_hero' = ANY\(labels\)[^)]*/g) ?? []
    expect(heroSubqueries.length).toBeGreaterThan(0)
    for (const subquery of heroSubqueries) {
      expect(subquery).toContain("visibility = 'public'")
    }
  })
})
