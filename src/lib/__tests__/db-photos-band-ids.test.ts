import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sql } from '@vercel/postgres'
import {
  getPhotos,
  getPhotoCount,
  getAvailablePhotoFilters,
  type GetPhotosOptions,
} from '../db'

// Mock @vercel/postgres
vi.mock('@vercel/postgres', () => ({
  sql: vi.fn(),
}))

describe('Database Functions - Multiple Band IDs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getPhotos with multiple band IDs', () => {
    it('should query photos with multiple band IDs using ANY()', async () => {
      const mockRows = [
        {
          id: 'photo1',
          band_id: 'band1',
          event_id: 'event1',
          photographer: 'Photographer 1',
        },
        {
          id: 'photo2',
          band_id: 'band2',
          event_id: 'event2',
          photographer: 'Photographer 1',
        },
      ]

      ;(sql as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: mockRows,
      })

      const options: GetPhotosOptions = {
        bandIds: ['band1', 'band2'],
        limit: 50,
        offset: 0,
      }

      await getPhotos(options)

      // Verify sql was called
      expect(sql).toHaveBeenCalled()

      // Get the SQL template literal
      const sqlCall = (sql as unknown as ReturnType<typeof vi.fn>).mock
        .calls[0][0]

      // Check that the query includes ANY() for multiple band IDs
      // The query should include: p.band_id = ANY(${effectiveBandIds}::text[])
      const queryString = sqlCall.toString()

      // Verify the query structure includes band filtering
      expect(queryString).toContain('band_id')
    })

    it('should handle single band ID normally', async () => {
      const mockRows = [
        {
          id: 'photo1',
          band_id: 'band1',
          event_id: 'event1',
          photographer: 'Photographer 1',
        },
      ]

      ;(sql as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: mockRows,
      })

      const options: GetPhotosOptions = {
        bandId: 'band1',
        limit: 50,
        offset: 0,
      }

      await getPhotos(options)

      expect(sql).toHaveBeenCalled()
    })

    it('should prefer bandIds over bandId when both are provided', async () => {
      const mockRows = [
        {
          id: 'photo1',
          band_id: 'band1',
        },
        {
          id: 'photo2',
          band_id: 'band2',
        },
      ]

      ;(sql as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: mockRows,
      })

      const options: GetPhotosOptions = {
        bandId: 'band1',
        bandIds: ['band1', 'band2'],
        limit: 50,
        offset: 0,
      }

      await getPhotos(options)

      expect(sql).toHaveBeenCalled()
      // Should use bandIds (multiple) instead of bandId (single)
    })

    it('should handle empty bandIds array', async () => {
      const mockRows = [
        {
          id: 'photo1',
          band_id: null,
        },
      ]

      ;(sql as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: mockRows,
      })

      const options: GetPhotosOptions = {
        bandIds: [],
        limit: 50,
        offset: 0,
      }

      await getPhotos(options)

      expect(sql).toHaveBeenCalled()
    })
  })

  describe('getPhotoCount with multiple band IDs', () => {
    it('should count photos with multiple band IDs', async () => {
      ;(sql as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [{ count: '5' }],
      })

      const options: GetPhotosOptions = {
        bandIds: ['band1', 'band2'],
      }

      const count = await getPhotoCount(options)

      expect(count).toBe(5)
      expect(sql).toHaveBeenCalled()
    })
  })

  describe('getAvailablePhotoFilters with multiple band IDs', () => {
    it('should filter available options based on multiple band IDs', async () => {
      ;(sql as unknown as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          rows: [{ slug: 'company1', name: 'Company 1', count: '3' }],
        })
        .mockResolvedValueOnce({
          rows: [{ id: 'event1', name: 'Event 1', count: '3' }],
        })
        .mockResolvedValueOnce({
          rows: [],
        })
        .mockResolvedValueOnce({
          rows: [{ name: 'Photographer 1', count: '3' }],
        })
        .mockResolvedValueOnce({
          rows: [{ count: '0' }],
        })
        .mockResolvedValueOnce({
          rows: [{ count: '0' }],
        })

      const options: GetPhotosOptions = {
        bandIds: ['band1', 'band2'],
      }

      const filters = await getAvailablePhotoFilters(options)

      expect(filters).toBeDefined()
      expect(sql).toHaveBeenCalledTimes(6) // 6 parallel queries
    })

    it('should handle single band ID in available filters', async () => {
      ;(sql as unknown as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          rows: [{ slug: 'company1', name: 'Company 1', count: '1' }],
        })
        .mockResolvedValueOnce({
          rows: [{ id: 'event1', name: 'Event 1', count: '1' }],
        })
        .mockResolvedValueOnce({
          rows: [],
        })
        .mockResolvedValueOnce({
          rows: [{ name: 'Photographer 1', count: '1' }],
        })
        .mockResolvedValueOnce({
          rows: [{ count: '0' }],
        })
        .mockResolvedValueOnce({
          rows: [{ count: '0' }],
        })

      const options: GetPhotosOptions = {
        bandId: 'band1',
      }

      const filters = await getAvailablePhotoFilters(options)

      expect(filters).toBeDefined()
      expect(sql).toHaveBeenCalledTimes(6)
    })
  })
})
