import { sql } from '@vercel/postgres'
import { vi } from 'vitest'
import {
  togglePhotoHeart,
  hasHeartedPhoto,
  incrementPhotoDownloadCount,
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

describe('photo hearts & download counters', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('togglePhotoHeart', () => {
    it('returns the new hearted state and count from the toggle query', async () => {
      mockSql.mockResolvedValue(
        createMockQueryResult([{ hearted: true, heart_count: 5 }])
      )

      const result = await togglePhotoHeart('photo-1', 'fpjs:visitor-1')

      expect(result).toEqual({ hearted: true, heart_count: 5 })
      // photo id and visitor key are passed as parameters (not interpolated)
      const params = mockSql.mock.calls[0].slice(1)
      expect(params).toContain('photo-1')
      expect(params).toContain('fpjs:visitor-1')
    })

    it('reflects an un-heart (hearted false, lower count)', async () => {
      mockSql.mockResolvedValue(
        createMockQueryResult([{ hearted: false, heart_count: 4 }])
      )

      const result = await togglePhotoHeart('photo-1', 'fpjs:visitor-1')

      expect(result).toEqual({ hearted: false, heart_count: 4 })
    })

    it('falls back to safe defaults when no row is returned', async () => {
      mockSql.mockResolvedValue(createMockQueryResult([]))

      const result = await togglePhotoHeart('missing', 'fpjs:visitor-1')

      expect(result).toEqual({ hearted: false, heart_count: 0 })
    })
  })

  describe('hasHeartedPhoto', () => {
    it('returns true when a heart row exists for the visitor', async () => {
      mockSql.mockResolvedValue(createMockQueryResult([{ hearted: true }]))

      await expect(hasHeartedPhoto('photo-1', 'fp:abc')).resolves.toBe(true)
    })

    it('returns false on error rather than throwing', async () => {
      mockSql.mockRejectedValue(new Error('db down'))

      await expect(hasHeartedPhoto('photo-1', 'fp:abc')).resolves.toBe(false)
    })
  })

  describe('incrementPhotoDownloadCount', () => {
    it('returns the incremented download count', async () => {
      mockSql.mockResolvedValue(createMockQueryResult([{ download_count: 42 }]))

      await expect(incrementPhotoDownloadCount('photo-1')).resolves.toBe(42)
    })

    it('returns 0 when the photo does not exist', async () => {
      mockSql.mockResolvedValue(createMockQueryResult([]))

      await expect(incrementPhotoDownloadCount('missing')).resolves.toBe(0)
    })
  })
})
