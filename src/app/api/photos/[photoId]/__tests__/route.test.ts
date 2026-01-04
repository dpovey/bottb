import { NextRequest } from 'next/server'
import { GET, DELETE } from '../route'
import { getPhotoById } from '@/lib/db'
import { sql } from '@vercel/postgres'
import { del, list } from '@vercel/blob'
import { auth } from '@/lib/auth'
import { vi } from 'vitest'

// Mock the database functions
vi.mock('@/lib/db', () => ({
  getPhotoById: vi.fn(),
}))

vi.mock('@vercel/postgres', () => ({
  sql: vi.fn(),
}))

vi.mock('@vercel/blob', () => ({
  del: vi.fn(),
  list: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

const mockGetPhotoById = getPhotoById as ReturnType<typeof vi.fn>
const mockSql = sql as unknown as ReturnType<typeof vi.fn>
const mockDel = del as ReturnType<typeof vi.fn>
const mockList = list as ReturnType<typeof vi.fn>
const mockAuth = auth as ReturnType<typeof vi.fn>

describe('/api/photos/[photoId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET', () => {
    const mockPhoto = {
      id: 'photo-1',
      blob_url: 'https://example.com/photo1.jpg',
      blob_pathname: 'photos/photo-1/large.webp',
      event_id: 'event-1',
      band_id: 'band-1',
      photographer: 'John Doe',
      event_name: 'Test Event',
      band_name: 'Test Band',
      labels: [],
      hero_focal_point: { x: 50, y: 50 },
    }

    it('returns photo when found', async () => {
      mockGetPhotoById.mockResolvedValue(mockPhoto)

      const request = new NextRequest('http://localhost/api/photos/photo-1')
      const response = await GET(request, {
        params: Promise.resolve({ photoId: 'photo-1' }),
      })

      expect(mockGetPhotoById).toHaveBeenCalledWith('photo-1')
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data).toEqual(mockPhoto)
    })

    it('returns 404 when photo not found', async () => {
      mockGetPhotoById.mockResolvedValue(null)

      const request = new NextRequest(
        'http://localhost/api/photos/nonexistent-photo'
      )
      const response = await GET(request, {
        params: Promise.resolve({ photoId: 'nonexistent-photo' }),
      })

      expect(response.status).toBe(404)

      const data = await response.json()
      expect(data).toEqual({ error: 'Photo not found' })
    })

    it('returns 400 when photoId is missing', async () => {
      const request = new NextRequest('http://localhost/api/photos/')
      const response = await GET(request, {
        params: Promise.resolve({ photoId: '' }),
      })

      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data).toEqual({ error: 'Photo ID is required' })
    })

    it('returns 500 when database error occurs', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockGetPhotoById.mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost/api/photos/photo-1')
      const response = await GET(request, {
        params: Promise.resolve({ photoId: 'photo-1' }),
      })

      expect(response.status).toBe(500)

      const data = await response.json()
      expect(data).toEqual({ error: 'Failed to fetch photo' })

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error fetching photo:',
        expect.any(Error)
      )
      consoleSpy.mockRestore()
    })
  })

  describe('DELETE', () => {
    const mockPhotoRow = {
      id: 'photo-1',
      blob_url: 'https://example.com/photo1.jpg',
      blob_pathname: 'photos/photo-1/large.webp',
      original_filename: 'test-photo.jpg',
    }

    it('deletes photo when admin is authenticated', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'admin-1', isAdmin: true },
      })
      mockSql.mockResolvedValueOnce({ rows: [mockPhotoRow] })
      mockList.mockResolvedValue({
        blobs: [
          { url: 'https://blob.example.com/photo-1/large.webp' },
          { url: 'https://blob.example.com/photo-1/thumbnail.webp' },
        ],
      })
      mockDel.mockResolvedValue(undefined)
      mockSql.mockResolvedValueOnce({ rowCount: 1 })

      const request = new NextRequest('http://localhost/api/photos/photo-1', {
        method: 'DELETE',
      })
      const response = await DELETE(request, {
        params: Promise.resolve({ photoId: 'photo-1' }),
      })

      expect(mockAuth).toHaveBeenCalled()
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data).toEqual({
        success: true,
        message: 'Photo "test-photo.jpg" deleted successfully',
        deletedId: 'photo-1',
      })
    })

    it('returns 401 when not authenticated', async () => {
      mockAuth.mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/photos/photo-1', {
        method: 'DELETE',
      })
      const response = await DELETE(request, {
        params: Promise.resolve({ photoId: 'photo-1' }),
      })

      expect(response.status).toBe(401)

      const data = await response.json()
      expect(data).toEqual({ error: 'Unauthorized - Admin access required' })
    })

    it('returns 401 when user is not admin', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'user-1', isAdmin: false },
      })

      const request = new NextRequest('http://localhost/api/photos/photo-1', {
        method: 'DELETE',
      })
      const response = await DELETE(request, {
        params: Promise.resolve({ photoId: 'photo-1' }),
      })

      expect(response.status).toBe(401)

      const data = await response.json()
      expect(data).toEqual({ error: 'Unauthorized - Admin access required' })
    })

    it('returns 404 when photo not found', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'admin-1', isAdmin: true },
      })
      mockSql.mockResolvedValueOnce({ rows: [] })

      const request = new NextRequest(
        'http://localhost/api/photos/nonexistent-photo',
        {
          method: 'DELETE',
        }
      )
      const response = await DELETE(request, {
        params: Promise.resolve({ photoId: 'nonexistent-photo' }),
      })

      expect(response.status).toBe(404)

      const data = await response.json()
      expect(data).toEqual({ error: 'Photo not found' })
    })

    it('continues with database deletion if blob deletion fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockAuth.mockResolvedValue({
        user: { id: 'admin-1', isAdmin: true },
      })
      mockSql.mockResolvedValueOnce({ rows: [mockPhotoRow] })
      mockList.mockRejectedValue(new Error('Blob storage error'))
      mockSql.mockResolvedValueOnce({ rowCount: 1 })

      const request = new NextRequest('http://localhost/api/photos/photo-1', {
        method: 'DELETE',
      })
      const response = await DELETE(request, {
        params: Promise.resolve({ photoId: 'photo-1' }),
      })

      // Should still succeed
      expect(response.status).toBe(200)
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error deleting blobs:',
        expect.any(Error)
      )
      consoleSpy.mockRestore()
    })
  })
})
