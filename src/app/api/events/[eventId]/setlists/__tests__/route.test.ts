import { NextRequest } from 'next/server'
import { GET, POST } from '../route'
import {
  getSetlistsForEvent,
  detectSongConflicts,
  lockBandSetlist,
  unlockBandSetlist,
  updateConflictStatus,
} from '@/lib/db'
import { vi } from 'vitest'

// Mock the database functions
vi.mock('@/lib/db', () => ({
  getSetlistsForEvent: vi.fn(),
  detectSongConflicts: vi.fn(),
  lockBandSetlist: vi.fn(),
  unlockBandSetlist: vi.fn(),
  updateConflictStatus: vi.fn(),
}))

// Mock the auth function for admin checks
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

const mockGetSetlistsForEvent = getSetlistsForEvent as ReturnType<typeof vi.fn>
const mockDetectSongConflicts = detectSongConflicts as ReturnType<typeof vi.fn>
const mockLockBandSetlist = lockBandSetlist as ReturnType<typeof vi.fn>
const mockUnlockBandSetlist = unlockBandSetlist as ReturnType<typeof vi.fn>
const mockUpdateConflictStatus = updateConflictStatus as ReturnType<
  typeof vi.fn
>

// Import auth after mocking
import { auth } from '@/lib/auth'
const mockAuth = auth as ReturnType<typeof vi.fn>

describe('/api/events/[eventId]/setlists', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET', () => {
    const mockSongs = [
      {
        id: 'song-1',
        band_id: 'band-1',
        band_name: 'Bandlassian',
        position: 1,
        song_type: 'cover',
        title: 'Africa',
        artist: 'Toto',
        additional_songs: [],
        status: 'locked',
        company_slug: 'atlassian',
        company_name: 'Atlassian',
      },
      {
        id: 'song-2',
        band_id: 'band-1',
        band_name: 'Bandlassian',
        position: 2,
        song_type: 'cover',
        title: "Don't Stop Me Now",
        artist: 'Queen',
        additional_songs: [],
        status: 'conflict',
        company_slug: 'atlassian',
        company_name: 'Atlassian',
      },
      {
        id: 'song-3',
        band_id: 'band-2',
        band_name: 'Canvaband',
        position: 1,
        song_type: 'cover',
        title: "Don't Stop Me Now",
        artist: 'Queen',
        additional_songs: [],
        status: 'conflict',
        company_slug: 'canva',
        company_name: 'Canva',
      },
    ]

    const mockConflicts = [
      {
        title: "Don't Stop Me Now",
        artist: 'Queen',
        bands: [
          { band_id: 'band-1', band_name: 'Bandlassian', song_id: 'song-2' },
          { band_id: 'band-2', band_name: 'Canvaband', song_id: 'song-3' },
        ],
      },
    ]

    it('returns all setlists grouped by band with conflicts', async () => {
      const eventId = 'event-1'

      mockGetSetlistsForEvent.mockResolvedValue(mockSongs)
      mockDetectSongConflicts.mockResolvedValue(mockConflicts)

      const request = new NextRequest(
        `http://localhost/api/events/${eventId}/setlists`
      )
      const response = await GET(request, {
        params: Promise.resolve({ eventId }),
      })

      expect(response.status).toBe(200)

      const data = await response.json()

      // Check that songs are grouped by band
      expect(data.setlists).toHaveLength(2)

      const band1Setlist = data.setlists.find(
        (s: { band_id: string }) => s.band_id === 'band-1'
      )
      expect(band1Setlist).toBeDefined()
      expect(band1Setlist.songs).toHaveLength(2)
      expect(band1Setlist.band_name).toBe('Bandlassian')

      const band2Setlist = data.setlists.find(
        (s: { band_id: string }) => s.band_id === 'band-2'
      )
      expect(band2Setlist).toBeDefined()
      expect(band2Setlist.songs).toHaveLength(1)
      expect(band2Setlist.band_name).toBe('Canvaband')

      // Check conflicts
      expect(data.conflicts).toHaveLength(1)
      expect(data.conflicts[0].title).toBe("Don't Stop Me Now")
      expect(data.conflicts[0].bands).toHaveLength(2)

      // Check totals
      expect(data.totalSongs).toBe(3)
      expect(data.totalConflicts).toBe(1)
    })

    it('returns empty data when no setlists exist', async () => {
      const eventId = 'event-empty'

      mockGetSetlistsForEvent.mockResolvedValue([])
      mockDetectSongConflicts.mockResolvedValue([])

      const request = new NextRequest(
        `http://localhost/api/events/${eventId}/setlists`
      )
      const response = await GET(request, {
        params: Promise.resolve({ eventId }),
      })

      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.setlists).toHaveLength(0)
      expect(data.conflicts).toHaveLength(0)
      expect(data.totalSongs).toBe(0)
      expect(data.totalConflicts).toBe(0)
    })

    it('returns 500 when database error occurs', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const eventId = 'event-1'
      mockGetSetlistsForEvent.mockRejectedValue(new Error('Database error'))

      const request = new NextRequest(
        `http://localhost/api/events/${eventId}/setlists`
      )
      const response = await GET(request, {
        params: Promise.resolve({ eventId }),
      })

      expect(response.status).toBe(500)

      const data = await response.json()
      expect(data).toEqual({ error: 'Failed to fetch event setlists' })

      consoleSpy.mockRestore()
    })
  })

  describe('POST (Admin)', () => {
    const createAdminRequest = (
      eventId: string,
      body: Record<string, unknown>
    ) => {
      const url = new URL(`http://localhost/api/events/${eventId}/setlists`)
      const request = new NextRequest(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      // Mock the json() method since NextRequest needs special handling
      request.json = vi.fn().mockResolvedValue(body)
      return request
    }

    beforeEach(() => {
      // Reset to return updated setlists after actions
      mockGetSetlistsForEvent.mockResolvedValue([])
      mockDetectSongConflicts.mockResolvedValue([])
    })

    it('returns 401 when not authenticated as admin', async () => {
      mockAuth.mockResolvedValue(null)

      const request = createAdminRequest('event-1', {
        action: 'lock',
        bandId: 'band-1',
      })
      const response = await POST(request, {
        params: Promise.resolve({ eventId: 'event-1' }),
      })

      expect(response.status).toBe(401)
    })

    it("locks a band's setlist", async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'admin-1', isAdmin: true },
      })
      mockLockBandSetlist.mockResolvedValue(undefined)

      const eventId = 'event-1'
      const bandId = 'band-1'

      const request = createAdminRequest(eventId, { action: 'lock', bandId })
      const response = await POST(request, {
        params: Promise.resolve({ eventId }),
      })

      expect(response.status).toBe(200)
      expect(mockLockBandSetlist).toHaveBeenCalledWith(bandId)

      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.action).toBe('lock')
    })

    it("unlocks a band's setlist", async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'admin-1', isAdmin: true },
      })
      mockUnlockBandSetlist.mockResolvedValue(undefined)

      const eventId = 'event-1'
      const bandId = 'band-1'

      const request = createAdminRequest(eventId, { action: 'unlock', bandId })
      const response = await POST(request, {
        params: Promise.resolve({ eventId }),
      })

      expect(response.status).toBe(200)
      expect(mockUnlockBandSetlist).toHaveBeenCalledWith(bandId)

      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.action).toBe('unlock')
    })

    it('refreshes conflict status', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'admin-1', isAdmin: true },
      })
      mockUpdateConflictStatus.mockResolvedValue(undefined)

      const eventId = 'event-1'

      const request = createAdminRequest(eventId, {
        action: 'refresh_conflicts',
      })
      const response = await POST(request, {
        params: Promise.resolve({ eventId }),
      })

      expect(response.status).toBe(200)
      expect(mockUpdateConflictStatus).toHaveBeenCalledWith(eventId)

      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.action).toBe('refresh_conflicts')
    })

    it('requires action parameter', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'admin-1', isAdmin: true },
      })

      const request = createAdminRequest('event-1', {})
      const response = await POST(request, {
        params: Promise.resolve({ eventId: 'event-1' }),
      })

      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data.error).toBe('Action is required')
    })

    it('requires bandId for lock action', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'admin-1', isAdmin: true },
      })

      const request = createAdminRequest('event-1', { action: 'lock' })
      const response = await POST(request, {
        params: Promise.resolve({ eventId: 'event-1' }),
      })

      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data.error).toBe('bandId is required for lock action')
    })

    it('requires bandId for unlock action', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'admin-1', isAdmin: true },
      })

      const request = createAdminRequest('event-1', { action: 'unlock' })
      const response = await POST(request, {
        params: Promise.resolve({ eventId: 'event-1' }),
      })

      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data.error).toBe('bandId is required for unlock action')
    })

    it('validates action parameter', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'admin-1', isAdmin: true },
      })

      const request = createAdminRequest('event-1', {
        action: 'invalid_action',
      })
      const response = await POST(request, {
        params: Promise.resolve({ eventId: 'event-1' }),
      })

      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data.error).toContain('Invalid action')
    })
  })
})
