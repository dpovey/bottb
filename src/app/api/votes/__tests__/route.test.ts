// @vitest-environment node

import { vi } from 'vitest'
import { createRequest } from 'node-mocks-http'
import { NextRequest } from 'next/server'
import { POST } from '../route'
import { submitVote, updateVote as _updateVote } from '@/lib/db'
import {
  hasUserVoted,
  hasUserVotedByFingerprintJS,
} from '@/lib/user-context-server'

// Mock the database functions
vi.mock('@/lib/db', () => ({
  submitVote: vi.fn(),
  updateVote: vi.fn(),
  hasUserVotedByEmail: vi.fn(),
  getEventById: vi.fn(),
}))

// Mock user context functions
vi.mock('@/lib/user-context-server', () => ({
  extractUserContext: vi.fn(() => ({
    ip_address: '127.0.0.1',
    user_agent: 'test-agent',
    vote_fingerprint: 'test-fingerprint',
  })),
  hasUserVoted: vi.fn(() => Promise.resolve(false)),
  hasUserVotedByFingerprintJS: vi.fn(() => Promise.resolve(false)),
}))

// Mock the database query for band name lookup
vi.mock('@vercel/postgres', () => ({
  sql: vi.fn(),
}))

// Mock NextResponse.json to return a response with cookies
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((data, init) => {
      const response = {
        json: () => Promise.resolve(data),
        status: init?.status || 200,
        headers: new Headers(init?.headers),
        cookies: {
          set: vi.fn(),
          get: vi.fn(),
          delete: vi.fn(),
        },
        ...init,
      }
      return response
    }),
  },
}))

const mockSubmitVote = submitVote as ReturnType<typeof vi.fn>
const mockHasUserVoted = hasUserVoted as ReturnType<typeof vi.fn>
const mockHasUserVotedByFingerprintJS =
  hasUserVotedByFingerprintJS as ReturnType<typeof vi.fn>

// Import and mock hasUserVotedByEmail and getEventById
import { hasUserVotedByEmail, getEventById } from '@/lib/db'
const mockHasUserVotedByEmail = hasUserVotedByEmail as ReturnType<typeof vi.fn>
const mockGetEventById = getEventById as ReturnType<typeof vi.fn>

// Import sql after mocking
import { sql } from '@vercel/postgres'
const mockSql = sql as unknown as ReturnType<typeof vi.fn>

// Helper function to create NextRequest mock
function createNextRequestMock(
  voteData: Record<string, unknown>,
  headers: Record<string, string> = {}
) {
  const request = createRequest({
    method: 'POST',
    url: '/api/votes',
    body: voteData,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  })

  // Add required NextRequest properties
  request.json = vi.fn().mockResolvedValue(voteData)
  request.cookies = {
    get: vi.fn().mockReturnValue(undefined),
    set: vi.fn(),
    delete: vi.fn(),
  }

  return request as unknown as NextRequest
}

describe('/api/votes', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Mock the band name query
    mockSql.mockResolvedValue({
      rows: [{ name: 'Test Band' }],
      command: 'SELECT',
      rowCount: 1,
      oid: 0,
      fields: [],
    })

    // Mock getEventById to return a voting event by default
    mockGetEventById.mockResolvedValue({
      id: 'event-1',
      name: 'Test Event',
      status: 'voting',
      is_active: true,
    })
  })

  describe('POST', () => {
    it('submits a vote successfully', async () => {
      const voteData = {
        event_id: 'event-1',
        band_id: 'band-1',
        voter_type: 'crowd' as const,
        song_choice: undefined,
        performance: undefined,
        crowd_vibe: undefined,
        crowd_vote: 20,
      }

      const mockVote = {
        id: 'vote-1',
        ...voteData,
        created_at: '2024-01-01T00:00:00Z',
      }

      mockSubmitVote.mockResolvedValue(mockVote)

      const request = createNextRequestMock(voteData)

      const response = await POST(request)

      expect(mockSubmitVote).toHaveBeenCalledWith(
        expect.objectContaining({
          ...voteData,
          ip_address: '127.0.0.1',
          user_agent: 'test-agent',
          vote_fingerprint: 'test-fingerprint',
        })
      )

      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data).toEqual({
        ...mockVote,
        message: 'Vote submitted successfully',
        status: 'approved',
        duplicateDetected: false,
      })
    })

    it('submits a judge vote successfully', async () => {
      const voteData = {
        event_id: 'event-1',
        band_id: 'band-1',
        voter_type: 'judge' as const,
        song_choice: 15,
        performance: 25,
        crowd_vibe: 20,
        crowd_vote: undefined,
      }

      const mockVote = {
        id: 'vote-1',
        ...voteData,
        created_at: '2024-01-01T00:00:00Z',
      }

      mockSubmitVote.mockResolvedValue(mockVote)

      const request = createNextRequestMock(voteData)

      const response = await POST(request)

      expect(mockSubmitVote).toHaveBeenCalledWith(
        expect.objectContaining({
          ...voteData,
          ip_address: '127.0.0.1',
          user_agent: 'test-agent',
          vote_fingerprint: 'test-fingerprint',
        })
      )
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data).toEqual({
        ...mockVote,
        message: 'Vote submitted successfully',
        status: 'approved',
        duplicateDetected: false,
      })
    })

    it('returns 500 when database error occurs', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const voteData = {
        event_id: 'event-1',
        band_id: 'band-1',
        voter_type: 'crowd',
        crowd_vote: 20,
      }

      // Mock the user context functions to return false for duplicate checks
      mockHasUserVoted.mockResolvedValue(false)
      mockHasUserVotedByFingerprintJS.mockResolvedValue(false)

      // Mock submitVote to throw an error
      mockSubmitVote.mockRejectedValue(new Error('Database error'))

      const request = createNextRequestMock(voteData)

      const response = await POST(request)

      expect(response.status).toBe(500)

      const data = await response.json()
      expect(data).toEqual({ error: 'Failed to submit vote' })

      // Assert that console.error was called with the expected error
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error submitting vote:',
        expect.any(Error)
      )

      consoleSpy.mockRestore()
    })

    it('handles duplicate votes with email for review', async () => {
      const voteData = {
        event_id: 'event-1',
        band_id: 'band-1',
        voter_type: 'crowd' as const,
        crowd_vote: 20,
        email: 'test@example.com',
      }

      const mockVote = {
        id: 'vote-1',
        ...voteData,
        created_at: '2024-01-01T00:00:00Z',
      }

      // Mock that user has already voted by email
      mockHasUserVotedByEmail.mockResolvedValue(true)
      mockHasUserVoted.mockResolvedValue(false)
      mockHasUserVotedByFingerprintJS.mockResolvedValue(false)
      mockSubmitVote.mockResolvedValue(mockVote)

      const request = createNextRequestMock(voteData)

      const response = await POST(request)

      expect(response.status).toBe(201) // Created but needs review
      const data = await response.json()
      expect(data).toEqual({
        ...mockVote,
        message:
          'Duplicate vote detected. Your vote has been recorded and will be reviewed for approval.',
        status: 'pending',
        duplicateDetected: true,
      })
      expect(mockSubmitVote).toHaveBeenCalled()
    })

    it('handles duplicate votes without email', async () => {
      const voteData = {
        event_id: 'event-1',
        band_id: 'band-1',
        voter_type: 'crowd' as const,
        crowd_vote: 20,
      }

      const mockVote = {
        id: 'vote-1',
        ...voteData,
        created_at: '2024-01-01T00:00:00Z',
      }

      // Mock that user has already voted by fingerprint
      mockHasUserVotedByEmail.mockResolvedValue(false)
      mockHasUserVoted.mockResolvedValue(true)
      mockHasUserVotedByFingerprintJS.mockResolvedValue(false)
      mockSubmitVote.mockResolvedValue(mockVote)

      const request = createNextRequestMock(voteData)

      const response = await POST(request)

      expect(response.status).toBe(400) // Bad request - needs email
      const data = await response.json()
      expect(data).toEqual({
        ...mockVote,
        message:
          'Duplicate vote detected. Please provide an email address to submit your vote for review.',
        status: 'pending',
        duplicateDetected: true,
      })
      expect(mockSubmitVote).toHaveBeenCalled()
    })

    describe('Event Status Validation', () => {
      it('returns 404 when event is not found', async () => {
        const voteData = {
          event_id: 'nonexistent-event',
          band_id: 'band-1',
          voter_type: 'crowd' as const,
          crowd_vote: 20,
        }

        mockGetEventById.mockResolvedValue(null)

        const request = createNextRequestMock(voteData)
        const response = await POST(request)

        expect(response.status).toBe(404)
        const data = await response.json()
        expect(data).toEqual({ error: 'Event not found' })
        expect(mockSubmitVote).not.toHaveBeenCalled()
      })

      it("returns 403 when event status is 'upcoming'", async () => {
        const voteData = {
          event_id: 'upcoming-event',
          band_id: 'band-1',
          voter_type: 'crowd' as const,
          crowd_vote: 20,
        }

        mockGetEventById.mockResolvedValue({
          id: 'upcoming-event',
          name: 'Upcoming Event',
          status: 'upcoming',
          is_active: false,
        })

        const request = createNextRequestMock(voteData)
        const response = await POST(request)

        expect(response.status).toBe(403)
        const data = await response.json()
        expect(data).toEqual({
          error: 'Voting is not currently open for this event',
          eventStatus: 'upcoming',
        })
        expect(mockSubmitVote).not.toHaveBeenCalled()
      })

      it("returns 403 when event status is 'finalized'", async () => {
        const voteData = {
          event_id: 'finalized-event',
          band_id: 'band-1',
          voter_type: 'crowd' as const,
          crowd_vote: 20,
        }

        mockGetEventById.mockResolvedValue({
          id: 'finalized-event',
          name: 'Finalized Event',
          status: 'finalized',
          is_active: false,
        })

        const request = createNextRequestMock(voteData)
        const response = await POST(request)

        expect(response.status).toBe(403)
        const data = await response.json()
        expect(data).toEqual({
          error: 'Voting is not currently open for this event',
          eventStatus: 'finalized',
        })
        expect(mockSubmitVote).not.toHaveBeenCalled()
      })

      it("allows voting when event status is 'voting'", async () => {
        const voteData = {
          event_id: 'voting-event',
          band_id: 'band-1',
          voter_type: 'crowd' as const,
          crowd_vote: 20,
        }

        mockGetEventById.mockResolvedValue({
          id: 'voting-event',
          name: 'Voting Event',
          status: 'voting',
          is_active: true,
        })

        // Mock all duplicate check functions to return false
        mockHasUserVotedByEmail.mockResolvedValue(false)
        mockHasUserVoted.mockResolvedValue(false)
        mockHasUserVotedByFingerprintJS.mockResolvedValue(false)

        const mockVote = {
          id: 'vote-1',
          ...voteData,
          created_at: '2024-01-01T00:00:00Z',
        }

        mockSubmitVote.mockResolvedValue(mockVote)

        const request = createNextRequestMock(voteData)
        const response = await POST(request)

        expect(response.status).toBe(200)
        expect(mockSubmitVote).toHaveBeenCalled()
      })
    })
  })
})
