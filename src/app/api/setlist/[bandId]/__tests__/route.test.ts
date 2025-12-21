import { NextRequest } from 'next/server'
import { GET, POST } from '../route'
import {
  getSetlistForBand,
  createSetlistSong,
  updateConflictStatus,
} from '@/lib/db'
import { vi } from 'vitest'

// Mock the database functions
vi.mock('@/lib/db', () => ({
  getSetlistForBand: vi.fn(),
  createSetlistSong: vi.fn(),
  updateConflictStatus: vi.fn(),
}))

// Mock the auth function for admin checks
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

// Mock uuid
vi.mock('@/lib/uuid', () => ({
  uuidv7: vi.fn(() => 'test-uuid-v7'),
}))

const mockGetSetlistForBand = getSetlistForBand as ReturnType<typeof vi.fn>
const mockCreateSetlistSong = createSetlistSong as ReturnType<typeof vi.fn>
const mockUpdateConflictStatus = updateConflictStatus as ReturnType<
  typeof vi.fn
>

// Import auth after mocking
import { auth } from '@/lib/auth'
const mockAuth = auth as ReturnType<typeof vi.fn>

describe('/api/setlist/[bandId]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET', () => {
    it('returns setlist for a band', async () => {
      const bandId = 'band-1'
      const mockSetlist = [
        {
          id: 'song-1',
          band_id: bandId,
          position: 1,
          song_type: 'cover',
          title: 'Africa',
          artist: 'Toto',
          additional_songs: [],
          transition_to_title: null,
          transition_to_artist: null,
          youtube_video_id: null,
          status: 'pending',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'song-2',
          band_id: bandId,
          position: 2,
          song_type: 'mashup',
          title: 'Super Freaky Girl',
          artist: 'Nicki Minaj',
          additional_songs: [
            { title: 'Call Me Maybe', artist: 'Carly Rae Jepsen' },
          ],
          transition_to_title: null,
          transition_to_artist: null,
          youtube_video_id: 'abc123',
          status: 'locked',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ]

      mockGetSetlistForBand.mockResolvedValue(mockSetlist)

      const request = new NextRequest(`http://localhost/api/setlist/${bandId}`)
      const response = await GET(request, {
        params: Promise.resolve({ bandId }),
      })

      expect(mockGetSetlistForBand).toHaveBeenCalledWith(bandId)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data).toEqual({ songs: mockSetlist })
    })

    it('returns empty array for band with no setlist', async () => {
      const bandId = 'band-empty'
      mockGetSetlistForBand.mockResolvedValue([])

      const request = new NextRequest(`http://localhost/api/setlist/${bandId}`)
      const response = await GET(request, {
        params: Promise.resolve({ bandId }),
      })

      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data).toEqual({ songs: [] })
    })

    it('returns 500 when database error occurs', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const bandId = 'band-1'
      mockGetSetlistForBand.mockRejectedValue(new Error('Database error'))

      const request = new NextRequest(`http://localhost/api/setlist/${bandId}`)
      const response = await GET(request, {
        params: Promise.resolve({ bandId }),
      })

      expect(response.status).toBe(500)

      const data = await response.json()
      expect(data).toEqual({ error: 'Failed to fetch setlist' })

      consoleSpy.mockRestore()
    })
  })

  describe('POST (Admin)', () => {
    const createAdminRequest = (
      bandId: string,
      body: Record<string, unknown>
    ) => {
      const url = new URL(`http://localhost/api/setlist/${bandId}`)
      const request = new NextRequest(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      // Mock the json() method since NextRequest needs special handling
      request.json = vi.fn().mockResolvedValue(body)
      return request
    }

    it('returns 401 when not authenticated as admin', async () => {
      mockAuth.mockResolvedValue(null)

      const request = createAdminRequest('band-1', {
        position: 1,
        title: 'Africa',
        artist: 'Toto',
      })

      const response = await POST(request, {
        params: Promise.resolve({ bandId: 'band-1' }),
      })

      expect(response.status).toBe(401)
    })

    it('creates a cover song successfully', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'admin-1', isAdmin: true },
      })

      const bandId = 'band-1'
      const songData = {
        position: 1,
        song_type: 'cover',
        title: 'Africa',
        artist: 'Toto',
      }

      const createdSong = {
        id: 'test-uuid-v7',
        band_id: bandId,
        ...songData,
        additional_songs: [],
        transition_to_title: null,
        transition_to_artist: null,
        youtube_video_id: null,
        status: 'pending',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        event_id: 'event-1',
      }

      mockCreateSetlistSong.mockResolvedValue(createdSong)
      mockGetSetlistForBand.mockResolvedValue([createdSong])
      mockUpdateConflictStatus.mockResolvedValue(undefined)

      const request = createAdminRequest(bandId, songData)
      const response = await POST(request, {
        params: Promise.resolve({ bandId }),
      })

      expect(response.status).toBe(201)
      expect(mockCreateSetlistSong).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-uuid-v7',
          band_id: bandId,
          position: 1,
          song_type: 'cover',
          title: 'Africa',
          artist: 'Toto',
        })
      )
    })

    it('creates a transition song with target song', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'admin-1', isAdmin: true },
      })

      const bandId = 'band-1'
      const songData = {
        position: 3,
        song_type: 'transition',
        title: 'If You Were the Rain',
        artist: 'Original Artist',
        transition_to_title: 'Umbrella',
        transition_to_artist: 'Rihanna',
      }

      const createdSong = {
        id: 'test-uuid-v7',
        band_id: bandId,
        ...songData,
        additional_songs: [],
        youtube_video_id: null,
        status: 'pending',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        event_id: 'event-1',
      }

      mockCreateSetlistSong.mockResolvedValue(createdSong)
      mockGetSetlistForBand.mockResolvedValue([createdSong])
      mockUpdateConflictStatus.mockResolvedValue(undefined)

      const request = createAdminRequest(bandId, songData)
      const response = await POST(request, {
        params: Promise.resolve({ bandId }),
      })

      expect(response.status).toBe(201)
      expect(mockCreateSetlistSong).toHaveBeenCalledWith(
        expect.objectContaining({
          song_type: 'transition',
          transition_to_title: 'Umbrella',
          transition_to_artist: 'Rihanna',
        })
      )
    })

    it('validates required fields', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'admin-1', isAdmin: true },
      })

      const bandId = 'band-1'
      const request = createAdminRequest(bandId, {
        position: 1,
        // Missing title and artist
      })

      const response = await POST(request, {
        params: Promise.resolve({ bandId }),
      })

      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data.error).toBe('Title and artist are required')
    })

    it('validates position is positive', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'admin-1', isAdmin: true },
      })

      const bandId = 'band-1'
      const request = createAdminRequest(bandId, {
        position: 0,
        title: 'Africa',
        artist: 'Toto',
      })

      const response = await POST(request, {
        params: Promise.resolve({ bandId }),
      })

      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data.error).toBe('Position must be a positive integer')
    })

    it('validates song type', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'admin-1', isAdmin: true },
      })

      const bandId = 'band-1'
      const request = createAdminRequest(bandId, {
        position: 1,
        song_type: 'invalid',
        title: 'Africa',
        artist: 'Toto',
      })

      const response = await POST(request, {
        params: Promise.resolve({ bandId }),
      })

      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data.error).toContain('Invalid song_type')
    })

    it('requires transition target for transition songs', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'admin-1', isAdmin: true },
      })

      const bandId = 'band-1'
      const request = createAdminRequest(bandId, {
        position: 1,
        song_type: 'transition',
        title: 'Song A',
        artist: 'Artist A',
        // Missing transition_to_title and transition_to_artist
      })

      const response = await POST(request, {
        params: Promise.resolve({ bandId }),
      })

      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data.error).toContain('transition_to_title')
    })
  })
})
