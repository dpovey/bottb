import { sql } from '@vercel/postgres'
import { vi } from 'vitest'
import {
  getEvents,
  getActiveEvent,
  getUpcomingEvents,
  getPastEvents,
  getBandsForEvent,
  getVotesForEvent,
  submitVote,
  getEventById,
  getBandScores,
  getPastEventsWithWinners,
  hasUserVotedByEmail,
  updateCrowdVoteChoice,
} from '../db'

// Helper function to create a proper QueryResult mock
const createMockQueryResult = <T>(rows: T[]) => ({
  rows,
  command: 'SELECT',
  rowCount: rows.length,
  oid: 0,
  fields: [],
})

// Mock the @vercel/postgres module
vi.mock('@vercel/postgres', () => ({
  sql: vi.fn(),
}))

const mockSql = sql as unknown as ReturnType<typeof vi.fn>

/** The SQL text of the `n`th query, placeholders as `$`, whitespace collapsed. */
const sqlText = (n = 0): string =>
  (mockSql.mock.calls[n][0] as string[]).join('$').replace(/\s+/g, ' ').trim()

/** The values interpolated into the `n`th query. */
const sqlValues = (n = 0): unknown[] => mockSql.mock.calls[n].slice(1)

describe('Database Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getEvents', () => {
    it('returns all events ordered by date DESC', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          name: 'Event 1',
          date: '2024-12-25T18:30:00Z',
          location: 'Venue 1',
          is_active: true,
          status: 'voting',
          created_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'event-2',
          name: 'Event 2',
          date: '2024-12-24T18:30:00Z',
          location: 'Venue 2',
          is_active: false,
          status: 'finalized',
          created_at: '2024-01-02T00:00:00Z',
        },
      ]

      mockSql.mockResolvedValue(createMockQueryResult(mockEvents))

      const result = await getEvents()

      expect(sqlText()).toMatch(/^SELECT \* FROM events\b.*ORDER BY date DESC$/)
      expect(result).toEqual(mockEvents)
    })

    it('leaves rehearsal (test) events out by default', async () => {
      mockSql.mockResolvedValue(createMockQueryResult([]))

      await getEvents()

      expect(sqlText()).toMatch(/WHERE is_test = false/)
    })

    it('includes rehearsal (test) events when asked', async () => {
      mockSql.mockResolvedValue(createMockQueryResult([]))

      await getEvents({ includeTest: true })

      expect(sqlText()).toBe('SELECT * FROM events ORDER BY date DESC')
    })

    it('returns empty array when no events exist', async () => {
      mockSql.mockResolvedValue(createMockQueryResult([]))

      const result = await getEvents()

      expect(result).toEqual([])
    })
  })

  describe('getActiveEvent', () => {
    it('returns the active event with voting status', async () => {
      const mockEvent = {
        id: 'active-event-1',
        name: 'Active Event',
        date: '2024-12-25T18:30:00Z',
        location: 'Active Venue',
        is_active: true,
        status: 'voting',
        created_at: '2024-01-01T00:00:00Z',
      }

      mockSql.mockResolvedValue(createMockQueryResult([mockEvent]))

      const result = await getActiveEvent()

      expect(result).toEqual(mockEvent)
    })

    it('treats an event as active from voting open until results are released', async () => {
      mockSql.mockResolvedValue(createMockQueryResult([]))

      await getActiveEvent()

      const query = sqlText()
      expect(query).toMatch(/status IN \('voting', 'closed', 'locked'\)/)
      // Keyed on status alone: an event that is voting but not flagged
      // is_active must still be found.
      expect(query).not.toMatch(/is_active/)
    })

    it('never picks the rehearsal (test) event', async () => {
      mockSql.mockResolvedValue(createMockQueryResult([]))

      await getActiveEvent()

      expect(sqlText()).toMatch(/is_test = false/)
    })

    it('picks the most recent live event if there is more than one', async () => {
      mockSql.mockResolvedValue(createMockQueryResult([]))

      await getActiveEvent()

      expect(sqlText()).toMatch(/ORDER BY date DESC LIMIT 1$/)
    })

    it('returns null when no active voting event exists', async () => {
      mockSql.mockResolvedValue(createMockQueryResult([]))

      const result = await getActiveEvent()

      expect(result).toBeNull()
    })
  })

  describe('getUpcomingEvents', () => {
    it('returns upcoming events ordered by date ASC', async () => {
      const mockEvents = [
        {
          id: 'upcoming-1',
          name: 'Upcoming Event 1',
          date: '2024-12-25T18:30:00Z',
          location: 'Venue 1',
          is_active: false,
          status: 'upcoming',
          created_at: '2024-01-01T00:00:00Z',
        },
      ]

      mockSql.mockResolvedValue(createMockQueryResult(mockEvents))

      const result = await getUpcomingEvents()

      expect(sqlText()).toBe(
        'SELECT * FROM events WHERE date >= NOW() AND is_test = false ORDER BY date ASC'
      )
      expect(result).toEqual(mockEvents)
    })
  })

  describe('getPastEvents', () => {
    it('returns past events ordered by date DESC', async () => {
      const mockEvents = [
        {
          id: 'past-1',
          name: 'Past Event 1',
          date: '2023-12-25T18:30:00Z',
          location: 'Venue 1',
          is_active: false,
          status: 'finalized',
          created_at: '2023-01-01T00:00:00Z',
        },
      ]

      mockSql.mockResolvedValue(createMockQueryResult(mockEvents))

      const result = await getPastEvents()

      const query = sqlText()
      expect(query).toMatch(/WHERE date < NOW\(\)/)
      expect(query).toMatch(/ORDER BY date DESC$/)
      expect(result).toEqual(mockEvents)
    })

    it('keeps an event out of the past until its results are released', async () => {
      mockSql.mockResolvedValue(createMockQueryResult([]))

      await getPastEvents()

      expect(sqlText()).toMatch(
        /status NOT IN \('voting', 'closed', 'locked'\)/
      )
    })

    it('leaves rehearsal (test) events out', async () => {
      mockSql.mockResolvedValue(createMockQueryResult([]))

      await getPastEvents()

      expect(sqlText()).toMatch(/is_test = false/)
    })
  })

  describe('getPastEventsWithWinners', () => {
    it('lists only past, non-live, non-test events', async () => {
      mockSql.mockResolvedValue(createMockQueryResult([]))

      await getPastEventsWithWinners()

      const query = sqlText()
      expect(query).toMatch(/WHERE e\.date < NOW\(\)/)
      expect(query).toMatch(/e\.status NOT IN \('voting', 'closed', 'locked'\)/)
      expect(query).toMatch(/e\.is_test = false/)
    })

    it('takes the winner from frozen results only once they are released', async () => {
      mockSql.mockResolvedValue(createMockQueryResult([]))

      await getPastEventsWithWinners()

      expect(sqlText()).toMatch(
        /LEFT JOIN finalized_results fr ON fr\.event_id = e\.id AND fr\.final_rank = 1 AND e\.status = 'finalized'/
      )
    })
  })

  describe('getBandsForEvent', () => {
    it('returns bands for a specific event ordered by order', async () => {
      const eventId = 'event-1'
      const mockBands = [
        {
          id: 'band-1',
          event_id: eventId,
          name: 'Band 1',
          description: 'Description 1',
          order: 1,
          created_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'band-2',
          event_id: eventId,
          name: 'Band 2',
          description: 'Description 2',
          order: 2,
          created_at: '2024-01-01T00:00:00Z',
        },
      ]

      mockSql.mockResolvedValue(createMockQueryResult(mockBands))

      const result = await getBandsForEvent(eventId)

      // Verify the SQL was called and returned expected results
      expect(mockSql).toHaveBeenCalled()
      // The first argument is an array of SQL template strings
      const callArgs = mockSql.mock.calls[0]
      expect(callArgs[0][0]).toContain('SELECT')
      expect(callArgs[0][0]).toContain('FROM bands')
      expect(callArgs[1]).toBe(eventId)
      expect(result).toEqual(mockBands)
    })
  })

  describe('getVotesForEvent', () => {
    it('returns votes for a specific event', async () => {
      const eventId = 'event-1'
      const mockVotes = [
        {
          id: 'vote-1',
          event_id: eventId,
          band_id: 'band-1',
          voter_type: 'crowd',
          song_choice: null,
          performance: null,
          crowd_vibe: null,
          crowd_vote: 20,
          created_at: '2024-01-01T00:00:00Z',
        },
      ]

      mockSql.mockResolvedValue(createMockQueryResult(mockVotes))

      const result = await getVotesForEvent(eventId)

      expect(mockSql).toHaveBeenCalledWith(
        ['SELECT * FROM votes WHERE event_id = ', ''],
        eventId
      )
      expect(result).toEqual(mockVotes)
    })
  })

  describe('submitVote', () => {
    it('submits a vote and returns the created vote', async () => {
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

      mockSql.mockResolvedValue(createMockQueryResult([mockVote]))

      const result = await submitVote(voteData)

      expect(mockSql).toHaveBeenCalledWith(
        expect.arrayContaining([expect.stringMatching(/INSERT INTO votes/)]),
        null, // id: none supplied, so the database picks one
        'event-1', // event_id
        'band-1', // band_id
        'crowd', // voter_type
        undefined, // song_choice
        undefined, // performance
        undefined, // crowd_vibe
        undefined, // visuals (2026.1)
        20, // crowd_vote
        undefined, // ip_address
        undefined, // user_agent
        undefined, // browser_name
        undefined, // browser_version
        undefined, // os_name
        undefined, // os_version
        undefined, // device_type
        undefined, // screen_resolution
        undefined, // timezone
        undefined, // language
        undefined, // google_click_id
        undefined, // facebook_pixel_id
        undefined, // utm_source
        undefined, // utm_medium
        undefined, // utm_campaign
        undefined, // utm_term
        undefined, // utm_content
        undefined, // vote_fingerprint
        undefined, // fingerprintjs_visitor_id
        undefined, // fingerprintjs_confidence
        undefined, // fingerprintjs_confidence_comment
        undefined, // email
        undefined, // name
        'approved' // status
      )
      expect(result).toEqual(mockVote)
    })

    it('inserts the id the voting page chose, so a re-sent vote is the same vote', async () => {
      const id = '3f2b8c1e-7d4a-4f6b-9c2e-1a5d8e9f0b7c'
      mockSql.mockResolvedValue(createMockQueryResult([{ id }]))

      await submitVote({
        id,
        event_id: 'event-1',
        band_id: 'band-1',
        voter_type: 'crowd',
        crowd_vote: 20,
      })

      expect(sqlValues()[0]).toBe(id)
      expect(sqlText()).toMatch(
        /VALUES \( COALESCE\(\$::uuid, gen_random_uuid\(\)\), \$,/
      )
    })

    it('lets the database pick the id when none is given', async () => {
      mockSql.mockResolvedValue(createMockQueryResult([{ id: 'db-id' }]))

      const result = await submitVote({
        event_id: 'event-1',
        band_id: 'band-1',
        voter_type: 'crowd',
        crowd_vote: 20,
      })

      expect(sqlValues()[0]).toBeNull()
      expect(result).toEqual({ id: 'db-id' })
    })
  })

  describe('hasUserVotedByEmail', () => {
    it('counts held votes as well as approved ones, but not rejected ones', async () => {
      mockSql.mockResolvedValue(createMockQueryResult([{ count: '1' }]))

      const result = await hasUserVotedByEmail('event-1', 'fan@example.com')

      expect(result).toBe(true)
      const query = sqlText()
      expect(query).toMatch(/COALESCE\(status, 'approved'\) <> 'rejected'/)
      expect(query).not.toMatch(/status = 'approved'/)
      expect(sqlValues()).toEqual(['event-1', 'fan@example.com'])
    })

    it('is false when the email has no votes in the event', async () => {
      // Postgres returns COUNT(*) as a string.
      mockSql.mockResolvedValue(createMockQueryResult([{ count: '0' }]))

      expect(await hasUserVotedByEmail('event-1', 'new@example.com')).toBe(
        false
      )
    })
  })

  describe('getEventById', () => {
    it('returns event by id', async () => {
      const eventId = 'event-1'
      const mockEvent = {
        id: eventId,
        name: 'Test Event',
        date: '2024-12-25T18:30:00Z',
        location: 'Test Venue',
        is_active: true,
        status: 'voting',
        created_at: '2024-01-01T00:00:00Z',
      }

      mockSql.mockResolvedValue(createMockQueryResult([mockEvent]))

      const result = await getEventById(eventId)

      expect(mockSql).toHaveBeenCalledWith(
        ['\n    SELECT * FROM events WHERE id = ', '\n  '],
        eventId
      )
      expect(result).toEqual(mockEvent)
    })

    it('returns null when event not found', async () => {
      const eventId = 'nonexistent-event'
      mockSql.mockResolvedValue(createMockQueryResult([]))

      const result = await getEventById(eventId)

      expect(result).toBeNull()
    })
  })

  describe('getBandScores', () => {
    it('returns band scores with aggregated data', async () => {
      const eventId = 'event-1'
      const mockScores = [
        {
          id: 'band-1',
          name: 'Band 1',
          order: 1,
          avg_song_choice: 15.5,
          avg_performance: 25.0,
          avg_crowd_vibe: 22.5,
          avg_crowd_vote: 18.0,
          crowd_vote_count: 10,
          judge_vote_count: 3,
          total_crowd_votes: 50,
        },
      ]

      mockSql.mockResolvedValue(createMockQueryResult(mockScores))

      const result = await getBandScores(eventId)

      expect(mockSql).toHaveBeenCalledWith(
        expect.arrayContaining([expect.stringMatching(/WITH total_votes AS/)]),
        eventId,
        eventId,
        eventId
      )
      expect(result).toEqual(mockScores)
    })

    it('counts only approved votes, in the totals and per band', async () => {
      mockSql.mockResolvedValue(createMockQueryResult([]))

      await getBandScores('event-1')

      const query = sqlText()
      // The total-votes CTE (used to normalise the crowd vote)...
      expect(query).toMatch(
        /WITH total_votes AS \(.*v\.voter_type = 'crowd' AND COALESCE\(v\.status, 'approved'\) = 'approved' AND b\.info->'non_competing' IS DISTINCT FROM 'true'::jsonb \)/
      )
      // ...and the per-band join that the averages and counts come from.
      expect(query).toMatch(
        /LEFT JOIN votes v ON b\.id = v\.band_id AND COALESCE\(v\.status, 'approved'\) = 'approved'/
      )
    })
  })

  describe('updateCrowdVoteChoice', () => {
    const voteId = '3f2b8c1e-7d4a-4f6b-9c2e-1a5d8e9f0b7c'

    it('moves exactly one crowd vote in the event to the new band', async () => {
      const updated = {
        id: voteId,
        event_id: 'event-1',
        band_id: 'band-2',
        voter_type: 'crowd',
        status: 'approved',
      }
      mockSql.mockResolvedValue(createMockQueryResult([updated]))

      const result = await updateCrowdVoteChoice({
        voteId,
        eventId: 'event-1',
        bandId: 'band-2',
      })

      expect(result).toEqual(updated)
      expect(mockSql).toHaveBeenCalledTimes(1)
      expect(sqlText()).toMatch(/^UPDATE votes SET band_id = \$, /)
      expect(sqlText()).toMatch(
        /WHERE id = \$ AND event_id = \$ AND voter_type = 'crowd' RETURNING \*$/
      )
      expect(sqlValues()).toEqual(['band-2', null, voteId, 'event-1'])
    })

    it('leaves the vote status (approved, held or rejected) alone', async () => {
      mockSql.mockResolvedValue(createMockQueryResult([]))

      await updateCrowdVoteChoice({
        voteId,
        eventId: 'event-1',
        bandId: 'band-2',
      })

      expect(sqlText()).not.toMatch(/status/)
    })

    it('records an email only if the vote has none yet', async () => {
      mockSql.mockResolvedValue(createMockQueryResult([]))

      await updateCrowdVoteChoice({
        voteId,
        eventId: 'event-1',
        bandId: 'band-2',
        email: 'fan@example.com',
      })

      expect(sqlText()).toMatch(/email = COALESCE\(email, \$\)/)
      expect(sqlValues()).toEqual([
        'band-2',
        'fan@example.com',
        voteId,
        'event-1',
      ])
    })

    it('returns null when there is no such crowd vote in the event', async () => {
      mockSql.mockResolvedValue(createMockQueryResult([]))

      const result = await updateCrowdVoteChoice({
        voteId,
        eventId: 'other-event',
        bandId: 'band-2',
      })

      expect(result).toBeNull()
    })
  })
})
