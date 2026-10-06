import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../sql', () => ({
  sql: vi.fn(),
  sqlQuery: vi.fn(),
}))

import { sql, sqlQuery } from '../sql'
import {
  TEST_EVENT_ID,
  deleteJudgeSheet,
  ensureTestEvent,
  TEST_GUEST_BAND,
  getCrowdVotesForReview,
  getOtherEventsVoting,
  insertJudgeSheet,
  insertSimulatedCrowdVotes,
  isUuid,
  judgeVoteFingerprint,
  resetTestEvent,
  setCrowdVoteStatus,
  transitionEventStatus,
  wasLockedByRunTheNight,
} from '../db/night'

const mockSql = vi.mocked(sql)
const mockSqlQuery = vi.mocked(sqlQuery)

type SqlCall = [TemplateStringsArray, ...unknown[]]

function result(rows: unknown[] = [], rowCount = rows.length) {
  return { rows, rowCount, command: '', oid: 0, fields: [] }
}

/** The text of a tagged-template call, with `$` where each value goes. */
function textOf(call: unknown[]): string {
  return (call[0] as TemplateStringsArray).join('$').replace(/\s+/g, ' ')
}

function valuesOf(call: unknown[]): unknown[] {
  return (call as SqlCall).slice(1)
}

/** Hand-written SQL with whitespace collapsed and `::type` casts removed. */
function uncast(text: string): string {
  return text.replace(/::[a-z]+(\[\])?/g, '').replace(/\s+/g, ' ')
}

/** Every `$N` that occurs more than once carries an explicit cast each time. */
function expectReusedParamsCast(text: string) {
  const uses = new Map<string, string[]>()
  for (const m of text.matchAll(/\$(\d+)(::[a-z]+(\[\])?)?/g)) {
    uses.set(m[1], [...(uses.get(m[1]) ?? []), m[2] ?? ''])
  }
  const reused = [...uses].filter(([, casts]) => casts.length > 1)
  expect(reused.length).toBeGreaterThan(0)
  for (const [param, casts] of reused) {
    expect({ param, casts }).toEqual({
      param,
      casts: casts.map(() => expect.stringMatching(/^::/)),
    })
  }
}

function sqlCalls(): unknown[][] {
  return mockSql.mock.calls as unknown[][]
}

describe('db/night', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSql.mockResolvedValue(result() as never)
    mockSqlQuery.mockResolvedValue(result() as never)
  })

  describe('transitionEventStatus', () => {
    it('only updates the event while it is still in the starting status', async () => {
      mockSql.mockResolvedValue(
        result([{ id: 'ev', status: 'closed' }]) as never
      )
      const moved = await transitionEventStatus('ev', 'voting', 'closed')

      expect(moved).toEqual({ id: 'ev', status: 'closed' })
      const [call] = sqlCalls()
      const text = textOf(call)
      expect(text).toContain('UPDATE events')
      expect(text).toMatch(/WHERE id = \$ AND status = \$/)
      // SET status = to, is_active = live(to) ... WHERE id = eventId AND status = from
      expect(valuesOf(call)).toEqual(['closed', true, 'ev', 'voting'])
    })

    it('returns null when no row was in the starting status', async () => {
      mockSql.mockResolvedValue(result([]) as never)
      expect(await transitionEventStatus('ev', 'closed', 'locked')).toBeNull()
    })

    it.each([
      ['upcoming', false],
      ['voting', true],
      ['closed', true],
      ['locked', true],
      ['finalized', false],
    ] as const)(
      'keeps is_active in step when moving to %s',
      async (to, active) => {
        await transitionEventStatus('ev', 'voting', to)
        expect(valuesOf(sqlCalls()[0])[1]).toBe(active)
      }
    )
  })

  describe('wasLockedByRunTheNight', () => {
    it('looks for a "lock-results" entry in this event\'s log', async () => {
      mockSql.mockResolvedValue(result([{ '?column?': 1 }]) as never)
      expect(await wasLockedByRunTheNight('ev')).toBe(true)
      const call = sqlCalls()[0]
      const text = textOf(call)
      expect(text).toContain('FROM event_status_log')
      expect(text).toContain("transition = 'lock-results'")
      expect(text).toContain('event_id = $')
      expect(valuesOf(call)).toEqual(['ev'])
    })

    it('is false with no such entry', async () => {
      mockSql.mockResolvedValue(result([]) as never)
      expect(await wasLockedByRunTheNight('ev')).toBe(false)
    })
  })

  describe('getOtherEventsVoting', () => {
    it('leaves out this event and test events', async () => {
      mockSql.mockResolvedValue(result([{ name: 'Brisbane 2026' }]) as never)
      expect(await getOtherEventsVoting('ev')).toEqual(['Brisbane 2026'])
      const text = textOf(sqlCalls()[0])
      expect(text).toContain("status = 'voting'")
      expect(text).toContain('id <> $')
      expect(text).toContain('is_test = false')
      expect(valuesOf(sqlCalls()[0])).toEqual(['ev'])
    })
  })

  describe('getCrowdVotesForReview', () => {
    it('reads only crowd votes of this event, oldest first, with what review needs', async () => {
      await getCrowdVotesForReview('ev')
      const call = sqlCalls()[0]
      const text = textOf(call)
      for (const column of [
        'user_agent',
        'host(ip_address) AS ip_address',
        'fingerprintjs_visitor_id',
        'screen_resolution',
        'email',
        "COALESCE(status, 'approved') AS status",
      ]) {
        expect(text).toContain(column)
      }
      expect(text).toContain("WHERE event_id = $ AND voter_type = 'crowd'")
      expect(text).toContain('ORDER BY created_at, id')
      expect(valuesOf(call)).toEqual(['ev'])
    })
  })

  describe('setCrowdVoteStatus', () => {
    const ids = [
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    ]

    it('runs no query for an empty id list', async () => {
      expect(await setCrowdVoteStatus('ev', [], 'approved', 'a@b.c')).toEqual(
        []
      )
      expect(mockSqlQuery).not.toHaveBeenCalled()
      expect(mockSql).not.toHaveBeenCalled()
    })

    it('only touches the listed crowd votes of this event while it is voting or closed', async () => {
      mockSqlQuery.mockResolvedValue(result([{ id: ids[0] }]) as never)
      const updated = await setCrowdVoteStatus('ev', ids, 'rejected', 'a@b.c')

      expect(updated).toEqual([ids[0]])
      const [text, params] = mockSqlQuery.mock.calls[0]
      const flat = uncast(text)
      expect(flat).toContain('UPDATE votes')
      expect(flat).toContain("voter_type = 'crowd'")
      expect(flat).toContain('id = ANY($4)')
      expect(flat).toContain('WHERE event_id = $3')
      expect(flat).toMatch(
        /EXISTS \( SELECT 1 FROM events e WHERE e\.id = \$3 AND e\.status IN \('voting', 'closed'\) \)/
      )
      expect(params).toEqual(['rejected', 'a@b.c', 'ev', ids])
    })

    it('clears the review stamp when a vote goes back to pending', async () => {
      await setCrowdVoteStatus('ev', ids, 'pending', 'a@b.c')
      const [text, params] = mockSqlQuery.mock.calls[0]
      const flat = uncast(text)
      expect(flat).toContain(
        "reviewed_at = CASE WHEN $1 = 'pending' THEN NULL ELSE NOW() END"
      )
      expect(flat).toContain(
        "reviewed_by = CASE WHEN $1 = 'pending' THEN NULL ELSE $2 END"
      )
      expect(params?.[0]).toBe('pending')
    })

    // Postgres refuses a statement where one untyped parameter is deduced as
    // two types ("inconsistent types deduced for parameter $1"), e.g. `$1`
    // assigned to a varchar column and compared with a text literal. Checked
    // against Postgres 16: the uncast version of this statement fails.
    it('casts every parameter that appears more than once', async () => {
      await setCrowdVoteStatus('ev', ids, 'approved', 'a@b.c')
      expectReusedParamsCast(mockSqlQuery.mock.calls[0][0])
    })
  })

  describe('judgeVoteFingerprint', () => {
    it('is 64 hex characters', () => {
      expect(judgeVoteFingerprint('ev', 'Alice', 'band-1')).toMatch(
        /^[0-9a-f]{64}$/
      )
    })

    it('ignores case and surrounding whitespace in the judge name', () => {
      expect(judgeVoteFingerprint('ev', '  ALICE smith ', 'band-1')).toBe(
        judgeVoteFingerprint('ev', 'alice smith', 'band-1')
      )
    })

    it('differs per band, per event and per judge', () => {
      const base = judgeVoteFingerprint('ev', 'Alice', 'band-1')
      expect(judgeVoteFingerprint('ev', 'Alice', 'band-2')).not.toBe(base)
      expect(judgeVoteFingerprint('ev-2', 'Alice', 'band-1')).not.toBe(base)
      expect(judgeVoteFingerprint('ev', 'Bob', 'band-1')).not.toBe(base)
    })
  })

  describe('isUuid', () => {
    it('accepts UUIDs in either case', () => {
      expect(isUuid('11111111-1111-4111-8111-111111111111')).toBe(true)
      expect(isUuid('ABCDEF12-3456-7890-ABCD-EF1234567890')).toBe(true)
    })

    it.each([
      '',
      'not-a-uuid',
      '11111111-1111-4111-8111-11111111111',
      '11111111-1111-4111-8111-1111111111111',
      ' 11111111-1111-4111-8111-111111111111',
      "11111111-1111-4111-8111-111111111111'; DROP TABLE votes;--",
      'gggggggg-1111-4111-8111-111111111111',
    ])('rejects %j', (value) => {
      expect(isUuid(value)).toBe(false)
    })

    it('rejects non-strings', () => {
      expect(isUuid(undefined)).toBe(false)
      expect(isUuid(null)).toBe(false)
      expect(isUuid(42)).toBe(false)
      expect(isUuid({})).toBe(false)
    })
  })

  describe('insertJudgeSheet', () => {
    const rows = [
      {
        band_id: 'band-1',
        song_choice: 15,
        performance: 16,
        crowd_vibe: 17,
        visuals: 18,
      },
      {
        band_id: 'band-2',
        song_choice: 10,
        performance: 11,
        crowd_vibe: 12,
        visuals: null,
      },
    ]
    const context = { ip_address: '203.0.113.1', user_agent: 'ua' }

    it('stores nothing for an empty sheet', async () => {
      expect(await insertJudgeSheet('ev', 'Alice', [], context)).toBe(0)
      expect(mockSqlQuery).not.toHaveBeenCalled()
    })

    it('saves the whole sheet in one statement, only while judges can still be entered', async () => {
      mockSqlQuery.mockResolvedValue(result([], 2) as never)
      const count = await insertJudgeSheet('ev', '  Alice  ', rows, context)

      expect(count).toBe(2)
      expect(mockSqlQuery).toHaveBeenCalledTimes(1)
      const [text, params] = mockSqlQuery.mock.calls[0]
      const flat = uncast(text)
      expect(flat).toContain('INSERT INTO votes')
      expect(flat).toMatch(
        /WHERE EXISTS \( SELECT 1 FROM events e WHERE e\.id = \$1 AND e\.status IN \('upcoming', 'voting', 'closed'\) \)/
      )
      // event, trimmed name, ip, ua, then 6 values per band
      expect(params).toEqual([
        'ev',
        'Alice',
        '203.0.113.1',
        'ua',
        'band-1',
        15,
        16,
        17,
        18,
        judgeVoteFingerprint('ev', 'Alice', 'band-1'),
        'band-2',
        10,
        11,
        12,
        null,
        judgeVoteFingerprint('ev', 'Alice', 'band-2'),
      ])
      expect(flat).toContain(
        '($5, $6, $7, $8, $9, $10), ($11, $12, $13, $14, $15, $16)'
      )
    })

    it('reports 0 when the event status refused the insert', async () => {
      mockSqlQuery.mockResolvedValue(result([], 0) as never)
      expect(await insertJudgeSheet('ev', 'Alice', rows, context)).toBe(0)
    })

    // See setCrowdVoteStatus: `$1` is both inserted into varchar `event_id`
    // and compared with `e.id`; uncast, Postgres refuses the statement.
    it('casts every parameter that appears more than once', async () => {
      await insertJudgeSheet('ev', 'Alice', rows, context)
      expectReusedParamsCast(mockSqlQuery.mock.calls[0][0])
    })
  })

  describe('deleteJudgeSheet', () => {
    it('matches the name case-insensitively and only before results are locked', async () => {
      mockSql.mockResolvedValue(result([], 3) as never)
      expect(await deleteJudgeSheet('ev', 'Alice')).toBe(3)
      const call = sqlCalls()[0]
      const text = textOf(call)
      expect(text).toContain('DELETE FROM votes')
      expect(text).toContain("voter_type = 'judge'")
      expect(text).toContain(
        "LOWER(TRIM(COALESCE(name, 'Unnamed judge'))) = LOWER(TRIM($))"
      )
      expect(text).toMatch(
        /EXISTS \( SELECT 1 FROM events e WHERE e\.id = \$ AND e\.status IN \('upcoming', 'voting', 'closed'\) \)/
      )
      expect(valuesOf(call)).toEqual(['ev', 'Alice', 'ev'])
    })

    it('returns 0 when nothing was deleted', async () => {
      mockSql.mockResolvedValue(result([], 0) as never)
      expect(await deleteJudgeSheet('ev', 'Nobody')).toBe(0)
    })
  })

  describe('ensureTestEvent', () => {
    it('creates the rehearsal event, its five bands and its special guests', async () => {
      const testEvent = { id: TEST_EVENT_ID, is_test: true }
      mockSql.mockImplementation(((strings: TemplateStringsArray) =>
        Promise.resolve(
          strings.join('').includes('SELECT * FROM events')
            ? result([testEvent])
            : result()
        )) as unknown as typeof sql)

      expect(await ensureTestEvent('2026.2')).toEqual(testEvent)
      const calls = sqlCalls()
      const insertEvent = textOf(calls[0])
      expect(insertEvent).toContain('INSERT INTO events')
      expect(insertEvent).toContain('ON CONFLICT (id) DO NOTHING')
      expect(valuesOf(calls[0])).toEqual([
        TEST_EVENT_ID,
        JSON.stringify({ scoring_version: '2026.2' }),
      ])
      const bandInserts = calls.filter((c) =>
        textOf(c).includes('INSERT INTO bands')
      )
      expect(bandInserts).toHaveLength(6)
      for (const c of bandInserts) {
        expect(textOf(c)).toContain('ON CONFLICT (id) DO NOTHING')
        expect(valuesOf(c)[1]).toBe(TEST_EVENT_ID)
      }
      // The last one is the non-competing special guests, opening the night.
      const guests = bandInserts[5]
      expect(valuesOf(guests)).toEqual([
        TEST_GUEST_BAND.id,
        TEST_EVENT_ID,
        TEST_GUEST_BAND.name,
        JSON.stringify({ non_competing: true }),
      ])
      expect(textOf(guests)).toContain(', 0,')
    })

    it.each([
      [
        'a real event already uses the id',
        { id: TEST_EVENT_ID, is_test: false },
      ],
      ['the row has no is_test flag', { id: TEST_EVENT_ID }],
    ])('throws and adds no bands when %s', async (_label, existing) => {
      mockSql.mockImplementation(((strings: TemplateStringsArray) =>
        Promise.resolve(
          strings.join('').includes('SELECT * FROM events')
            ? result([existing])
            : result()
        )) as unknown as typeof sql)

      await expect(ensureTestEvent('2026.2')).rejects.toThrow(
        'exists and is not a test event'
      )
      expect(
        sqlCalls().some((c) => textOf(c).includes('INSERT INTO bands'))
      ).toBe(false)
    })
  })

  describe('resetTestEvent', () => {
    it('returns false and deletes nothing when the event is not a test event', async () => {
      mockSql.mockResolvedValue(result([]) as never)
      expect(await resetTestEvent('sydney-2026')).toBe(false)
      expect(mockSql).toHaveBeenCalledTimes(1)
      const text = textOf(sqlCalls()[0])
      expect(text).toContain('UPDATE events')
      expect(text).toMatch(/WHERE id = \$ AND is_test = true/)
    })

    it('wipes votes, frozen results, noise readings and history, each guarded by is_test', async () => {
      mockSql.mockResolvedValueOnce(
        result([{ id: TEST_EVENT_ID, is_test: true }]) as never
      )
      expect(await resetTestEvent(TEST_EVENT_ID)).toBe(true)

      const calls = sqlCalls()
      expect(textOf(calls[0])).toContain("SET status = 'upcoming'")
      const deletes = calls.slice(1)
      expect(
        deletes.map((c) => textOf(c).match(/DELETE FROM (\w+)/)?.[1])
      ).toEqual([
        'votes',
        'finalized_results',
        'crowd_noise_measurements',
        'event_status_log',
      ])
      for (const c of deletes) {
        expect(textOf(c)).toMatch(
          /EXISTS \(SELECT 1 FROM events e WHERE e\.id = \$ AND e\.is_test\)/
        )
        expect(valuesOf(c)).toEqual([TEST_EVENT_ID, TEST_EVENT_ID])
      }
    })
  })

  describe('insertSimulatedCrowdVotes', () => {
    it('does nothing without bands or with a non-positive count', async () => {
      expect(await insertSimulatedCrowdVotes('ev', [], 10)).toEqual({
        added: 0,
        held: 0,
      })
      expect(await insertSimulatedCrowdVotes('ev', ['b'], 0)).toEqual({
        added: 0,
        held: 0,
      })
      expect(mockSql).not.toHaveBeenCalled()
    })

    it('only inserts into a test event whose voting is open', async () => {
      mockSql.mockImplementation(((strings: TemplateStringsArray) =>
        Promise.resolve(
          strings.join('').includes('INSERT INTO votes')
            ? result([], 1)
            : result()
        )) as unknown as typeof sql)

      const outcome = await insertSimulatedCrowdVotes('ev', ['b1', 'b2'], 3)
      expect(outcome.added).toBe(3)

      const inserts = sqlCalls().filter((c) =>
        textOf(c).includes('INSERT INTO votes')
      )
      expect(inserts).toHaveLength(3)
      for (const c of inserts) {
        expect(textOf(c)).toMatch(
          /WHERE EXISTS \( SELECT 1 FROM events e WHERE e\.id = \$ AND e\.is_test AND e\.status = 'voting' \)/
        )
        const values = valuesOf(c)
        expect(values[0]).toBe('ev')
        expect(['b1', 'b2']).toContain(values[1])
        // Documentation-only IP range, never a real voter's.
        expect(String(values[5])).toMatch(/^203\.0\.113\.\d+$/)
      }
    })

    it('counts nothing when the guard refuses every insert (a real event)', async () => {
      mockSql.mockResolvedValue(result([], 0) as never)
      expect(await insertSimulatedCrowdVotes('sydney-2026', ['b1'], 5)).toEqual(
        { added: 0, held: 0 }
      )
    })
  })
})
