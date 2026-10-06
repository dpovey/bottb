import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { DELETE } from '../route'

// Mock the database
vi.mock('@vercel/postgres', () => ({
  sql: vi.fn(),
}))

// Mock the API protection
vi.mock('@/lib/api-protection', () => ({
  withAdminProtection: (handler: unknown) => handler,
}))

const { sql } = await import('@vercel/postgres')

describe('Clear Scores API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should clear scores for a valid event', async () => {
    const mockEvent = {
      id: 'test-event',
      name: 'Test Event',
      location: 'Test Location',
      date: '2024-01-01',
      status: 'upcoming',
      is_test: false,
    }

    const mockVotesDeleted = 5
    const mockNoiseDeleted = 2
    const mockFinalizedResultsDeleted = 4

    // Mock database responses
    vi.mocked(sql).mockResolvedValueOnce({
      rows: [mockEvent],
      command: 'SELECT',
      rowCount: 1,
      oid: 0,
      fields: [],
    })

    vi.mocked(sql).mockResolvedValueOnce({
      rows: [],
      command: 'DELETE',
      rowCount: mockVotesDeleted,
      oid: 0,
      fields: [],
    })

    vi.mocked(sql).mockResolvedValueOnce({
      rows: [],
      command: 'DELETE',
      rowCount: mockNoiseDeleted,
      oid: 0,
      fields: [],
    })

    vi.mocked(sql).mockResolvedValueOnce({
      rows: [],
      command: 'DELETE',
      rowCount: mockFinalizedResultsDeleted,
      oid: 0,
      fields: [],
    })

    const request = new NextRequest(
      'http://localhost/api/events/test-event/clear-scores',
      {
        method: 'DELETE',
      }
    )

    const response = await DELETE(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.votesDeleted).toBe(mockVotesDeleted)
    expect(data.noiseDeleted).toBe(mockNoiseDeleted)
    expect(data.finalizedResultsDeleted).toBe(mockFinalizedResultsDeleted)
    expect(data.message).toContain('Test Event')
  })

  it('should return 404 for non-existent event', async () => {
    // Mock empty event result
    vi.mocked(sql).mockResolvedValueOnce({
      rows: [],
      command: 'SELECT',
      rowCount: 0,
      oid: 0,
      fields: [],
    })

    const request = new NextRequest(
      'http://localhost/api/events/non-existent/clear-scores',
      {
        method: 'DELETE',
      }
    )

    const response = await DELETE(request)
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data.error).toBe('Event not found')
  })

  it('should handle database errors', async () => {
    // Mock console.error to suppress and assert it
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Mock database error
    vi.mocked(sql).mockRejectedValueOnce(new Error('Database error'))

    const request = new NextRequest(
      'http://localhost/api/events/test-event/clear-scores',
      {
        method: 'DELETE',
      }
    )

    const response = await DELETE(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Failed to clear scores')
    expect(consoleSpy).toHaveBeenCalledWith(
      'Error clearing scores:',
      expect.any(Error)
    )

    consoleSpy.mockRestore()
  })

  describe('only before voting opens, unless it is the test event', () => {
    beforeEach(() => {
      vi.mocked(sql).mockReset()
    })

    function selectReturns(event: Record<string, unknown>) {
      vi.mocked(sql).mockResolvedValueOnce({
        rows: [event],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      })
    }

    function deleteStatements(): string[] {
      return vi
        .mocked(sql)
        .mock.calls.map((c) => (c[0] as unknown as string[]).join('?'))
        .filter((text) => text.includes('DELETE'))
    }

    function clearScores(id = 'sydney-2026') {
      return DELETE(
        new NextRequest(`http://localhost/api/events/${id}/clear-scores`, {
          method: 'DELETE',
        })
      )
    }

    it('reads the status and test flag of the event', async () => {
      selectReturns({ id: 'sydney-2026', name: 'Sydney', status: 'voting' })
      await clearScores()
      const select = (
        vi.mocked(sql).mock.calls[0][0] as unknown as string[]
      ).join('?')
      expect(select.replace(/\s+/g, ' ')).toMatch(/SELECT .*status.*is_test/)
    })

    it.each(['voting', 'closed', 'locked', 'finalized'])(
      'refuses with 409 and deletes nothing when a real event is %s',
      async (status) => {
        selectReturns({
          id: 'sydney-2026',
          name: 'Sydney 2026',
          status,
          is_test: false,
        })
        const response = await clearScores()
        const data = await response.json()
        expect(response.status).toBe(409)
        expect(data.error).toBe(
          'Scores can only be cleared before voting opens. To correct a vote or a judge sheet, use "Run the night".'
        )
        expect(deleteStatements()).toEqual([])
        expect(sql).toHaveBeenCalledTimes(1)
      }
    )

    it('treats a missing test flag as a real event', async () => {
      selectReturns({
        id: 'sydney-2026',
        name: 'Sydney 2026',
        status: 'closed',
      })
      const response = await clearScores()
      expect(response.status).toBe(409)
      expect(deleteStatements()).toEqual([])
    })

    it.each(['upcoming', 'voting', 'closed', 'locked', 'finalized'])(
      'clears the test event while it is %s',
      async (status) => {
        selectReturns({
          id: 'test-night',
          name: 'Test Night (rehearsal)',
          status,
          is_test: true,
        })
        vi.mocked(sql).mockResolvedValue({
          rows: [],
          command: 'DELETE',
          rowCount: 0,
          oid: 0,
          fields: [],
        })
        const response = await clearScores('test-night')
        expect(response.status).toBe(200)
        expect(deleteStatements()).toHaveLength(3)
      }
    )
  })
})
