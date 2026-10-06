import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../sql', () => ({
  sql: vi.fn(),
}))

vi.mock('../db/events', () => ({
  getBandScores: vi.fn(),
}))

import { sql } from '../sql'
import { getBandScores } from '../db/events'
import {
  calculateStandings,
  finalizeEventResults,
  getTiedForFirst,
  type BandScoreRow,
  type BandStanding,
} from '../db/results'

const mockSql = vi.mocked(sql)
const mockGetBandScores = vi.mocked(getBandScores)

/**
 * A row as Postgres returns it from getBandScores: AVG() and COUNT() come back
 * as numeric strings, missing judge averages as null.
 */
function row(id: string, overrides: Partial<BandScoreRow> = {}): BandScoreRow {
  return {
    id,
    name: `Band ${id}`,
    order: 1,
    avg_song_choice: null,
    avg_performance: null,
    avg_crowd_vibe: null,
    avg_visuals: null,
    avg_crowd_vote: null,
    crowd_vote_count: '0',
    judge_vote_count: '0',
    total_crowd_votes: '0',
    crowd_noise_energy: null,
    crowd_noise_peak: null,
    crowd_score: null,
    ...overrides,
  }
}

/**
 * Running order: A, B, C. Judge averages as numeric strings.
 *   A: song 15, perf 16, vibe 17, visuals 18 → judge 66; 40 crowd votes (leader)
 *   B: song 12.5, perf 14, vibe 13.5, visuals 10 → judge 50; 30 crowd votes
 *   C: no judge scores → judge 0; 10 crowd votes
 * Total approved crowd votes: 80.
 */
function threeBands(): BandScoreRow[] {
  return [
    row('a', {
      order: 1,
      avg_song_choice: '15.0000000000000000',
      avg_performance: '16.0000000000000000',
      avg_crowd_vibe: '17.0000000000000000',
      avg_visuals: '18.0000000000000000',
      crowd_vote_count: '40',
      judge_vote_count: '3',
      total_crowd_votes: '80',
      crowd_score: 8,
    }),
    row('b', {
      order: 2,
      avg_song_choice: '12.5000000000000000',
      avg_performance: '14.0000000000000000',
      avg_crowd_vibe: '13.5000000000000000',
      avg_visuals: '10.0000000000000000',
      crowd_vote_count: '30',
      judge_vote_count: '3',
      total_crowd_votes: '80',
    }),
    row('c', {
      order: 3,
      crowd_vote_count: '10',
      total_crowd_votes: '80',
    }),
  ]
}

function byId(standings: BandStanding[]) {
  return Object.fromEntries(standings.map((s) => [s.band_id, s]))
}

describe('calculateStandings', () => {
  describe('2026.2 (song 20, perf 20, vibe 20, crowd vote 20, visuals 20)', () => {
    it('scores and ranks the bands', () => {
      const s = byId(calculateStandings(threeBands(), '2026.2'))

      // A: leader gets the full 20 crowd points. 66 + 20 = 86.
      expect(s.a.judgeScore).toBe(66)
      expect(s.a.crowdVoteScore).toBe(20)
      expect(s.a.visualsScore).toBe(18)
      expect(s.a.screamOMeterScore).toBe(0)
      expect(s.a.totalScore).toBe(86)

      // B: 30 / 40 × 20 = 15. 12.5 + 14 + 13.5 + 10 = 50. 50 + 15 = 65.
      expect(s.b.songChoice).toBe(12.5)
      expect(s.b.judgeScore).toBe(50)
      expect(s.b.crowdVoteScore).toBe(15)
      expect(s.b.totalScore).toBe(65)

      // C: 10 / 40 × 20 = 5. No judge scores → 0. Total 5.
      expect(s.c.judgeScore).toBe(0)
      expect(s.c.crowdVoteScore).toBe(5)
      expect(s.c.totalScore).toBe(5)

      expect(s.a.rank).toBe(1)
      expect(s.b.rank).toBe(2)
      expect(s.c.rank).toBe(3)
    })

    it('converts the string counts to numbers', () => {
      const s = byId(calculateStandings(threeBands(), '2026.2'))
      expect(s.a.crowdVoteCount).toBe(40)
      expect(s.a.judgeVoteCount).toBe(3)
      expect(s.a.totalCrowdVotes).toBe(80)
      expect(s.c.judgeVoteCount).toBe(0)
    })

    it('gives the full crowd weight to the leader wherever it is in the running order', () => {
      const rows = [
        row('first', { crowd_vote_count: '3' }),
        row('second', { crowd_vote_count: '12' }),
        row('third', { crowd_vote_count: '6' }),
      ]
      const s = byId(calculateStandings(rows, '2026.2'))
      // 12 is the most: 20 points. 3/12 × 20 = 5. 6/12 × 20 = 10.
      expect(s.second.crowdVoteScore).toBe(20)
      expect(s.first.crowdVoteScore).toBe(5)
      expect(s.third.crowdVoteScore).toBe(10)
    })
  })

  describe('2026.1 (song 20, perf 30, vibe 20, crowd vote 10, visuals 20)', () => {
    it('uses a crowd weight of 10', () => {
      const s = byId(calculateStandings(threeBands(), '2026.1'))
      // A: 66 + 10 = 76. B: 30/40 × 10 = 7.5 → 50 + 7.5 = 57.5. C: 10/40 × 10 = 2.5.
      expect(s.a.crowdVoteScore).toBe(10)
      expect(s.a.totalScore).toBe(76)
      expect(s.b.crowdVoteScore).toBe(7.5)
      expect(s.b.totalScore).toBe(57.5)
      expect(s.c.crowdVoteScore).toBe(2.5)
      expect(s.c.totalScore).toBe(2.5)
      expect(s.a.visualsScore).toBe(18)
    })
  })

  describe('2025.1 (song 20, perf 30, vibe 30, crowd vote 10, scream-o-meter 10)', () => {
    it('adds the scream-o-meter and ignores visuals', () => {
      const rows = threeBands()
      rows[0].avg_performance = '25'
      rows[0].avg_crowd_vibe = '20'
      const s = byId(calculateStandings(rows, '2025.1'))
      // A: 15 + 25 + 20 = 60 judge (visuals 18 not counted); crowd 10; noise 8.
      // 60 + 10 + 8 = 78.
      expect(s.a.judgeScore).toBe(60)
      expect(s.a.crowdVoteScore).toBe(10)
      expect(s.a.screamOMeterScore).toBe(8)
      expect(s.a.visualsScore).toBe(0)
      expect(s.a.totalScore).toBe(78)
      // B: 12.5 + 14 + 13.5 = 40; 30/40 × 10 = 7.5; no noise reading → 0. 47.5.
      expect(s.b.judgeScore).toBe(40)
      expect(s.b.screamOMeterScore).toBe(0)
      expect(s.b.totalScore).toBe(47.5)
      // C: 10/40 × 10 = 2.5.
      expect(s.c.totalScore).toBe(2.5)
    })
  })

  describe('2022.1 (winner set by hand)', () => {
    it('scores every band 0 and keeps running order', () => {
      const standings = calculateStandings(threeBands(), '2022.1')
      expect(standings.map((s) => s.totalScore)).toEqual([0, 0, 0])
      expect(standings.map((s) => s.judgeScore)).toEqual([0, 0, 0])
      expect(standings.map((s) => s.band_id)).toEqual(['a', 'b', 'c'])
    })
  })

  it('gives 0 (not NaN) for the crowd vote when nobody has voted', () => {
    const rows = threeBands().map((r) => ({
      ...r,
      crowd_vote_count: '0',
      total_crowd_votes: '0',
    }))
    for (const version of ['2026.2', '2026.1', '2025.1']) {
      for (const s of calculateStandings(rows, version)) {
        expect(s.crowdVoteScore).toBe(0)
        expect(Number.isNaN(s.totalScore)).toBe(false)
      }
    }
  })

  it('handles an empty or missing crowd vote count as 0', () => {
    const rows = [
      row('a', { crowd_vote_count: '' }),
      row('b', { crowd_vote_count: '4' }),
    ]
    const s = byId(calculateStandings(rows, '2026.2'))
    expect(s.a.crowdVoteScore).toBe(0)
    expect(s.b.crowdVoteScore).toBe(20)
  })

  it('returns no standings for no bands', () => {
    expect(calculateStandings([], '2026.2')).toEqual([])
  })

  it('ranks by total, highest first', () => {
    const rows = [
      row('low', { avg_song_choice: '5' }),
      row('high', { avg_song_choice: '19' }),
      row('mid', { avg_song_choice: '11' }),
    ]
    const standings = calculateStandings(rows, '2026.2')
    expect(standings.map((s) => s.band_id)).toEqual(['high', 'mid', 'low'])
    expect(standings.map((s) => s.rank)).toEqual([1, 2, 3])
  })

  it('keeps running (input) order for an exact tie, earlier band ranked higher', () => {
    const rows = [
      row('opener', { avg_song_choice: '10' }),
      row('headliner', { avg_song_choice: '18' }),
      row('second', { avg_song_choice: '10' }),
      row('third', { avg_song_choice: '10' }),
    ]
    const standings = calculateStandings(rows, '2026.2')
    expect(standings.map((s) => s.band_id)).toEqual([
      'headliner',
      'opener',
      'second',
      'third',
    ])
    expect(standings.map((s) => s.rank)).toEqual([1, 2, 3, 4])
    expect(standings.map((s) => s.tiedWithPrevious)).toEqual([
      false,
      false,
      true,
      true,
    ])
  })

  describe('tiedWithPrevious (two decimal places)', () => {
    it('is true when totals differ only past the second decimal', () => {
      // 70.004 and 70.001 both show as 70.00.
      const rows = [
        row('a', { avg_song_choice: '70.001' }),
        row('b', { avg_song_choice: '70.004' }),
      ]
      const standings = calculateStandings(rows, '2026.2')
      // Still ranked by the unrounded total.
      expect(standings.map((s) => s.band_id)).toEqual(['b', 'a'])
      expect(standings[1].tiedWithPrevious).toBe(true)
    })

    it('is false when the totals differ at the second decimal', () => {
      // 70.006 shows as 70.01, 70.004 as 70.00.
      const rows = [
        row('a', { avg_song_choice: '70.004' }),
        row('b', { avg_song_choice: '70.006' }),
      ]
      const standings = calculateStandings(rows, '2026.2')
      expect(standings.map((s) => s.band_id)).toEqual(['b', 'a'])
      expect(standings[1].tiedWithPrevious).toBe(false)
    })

    it('is never set on the top band', () => {
      const standings = calculateStandings([row('a'), row('b')], '2026.2')
      expect(standings[0].tiedWithPrevious).toBe(false)
      expect(standings[1].tiedWithPrevious).toBe(true)
    })
  })
})

describe('getTiedForFirst', () => {
  it('is empty for no standings', () => {
    expect(getTiedForFirst([])).toEqual([])
  })

  it('names only the leader when there is no tie', () => {
    const standings = calculateStandings(threeBands(), '2026.2')
    expect(getTiedForFirst(standings)).toEqual(['Band a'])
  })

  it('names every band level at the top, in rank order', () => {
    const rows = [
      row('a', { avg_song_choice: '12' }),
      row('b', { avg_song_choice: '15' }),
      row('c', { avg_song_choice: '15' }),
      row('d', { avg_song_choice: '15.001' }),
    ]
    expect(getTiedForFirst(calculateStandings(rows, '2026.2'))).toEqual([
      'Band d',
      'Band b',
      'Band c',
    ])
  })

  it('ignores a tie further down the table', () => {
    const rows = [
      row('a', { avg_song_choice: '18' }),
      row('b', { avg_song_choice: '10' }),
      row('c', { avg_song_choice: '10' }),
    ]
    expect(getTiedForFirst(calculateStandings(rows, '2026.2'))).toEqual([
      'Band a',
    ])
  })
})

describe('finalizeEventResults', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function sqlText(call: unknown[]): string {
    return (call[0] as TemplateStringsArray).join('?')
  }

  it('stores one row per band in rank order, after clearing old rows', async () => {
    mockGetBandScores.mockResolvedValue(threeBands())
    let inserted = 0
    mockSql.mockImplementation(((strings: TemplateStringsArray) => {
      const text = strings.join('?')
      if (text.includes('INSERT INTO finalized_results')) {
        inserted++
        return Promise.resolve({ rows: [{ id: `r${inserted}` }] })
      }
      return Promise.resolve({ rows: [] })
    }) as unknown as typeof sql)

    const results = await finalizeEventResults('ev-1', '2026.2')
    expect(results).toHaveLength(3)

    const calls = mockSql.mock.calls
    expect(sqlText(calls[0])).toContain('DELETE FROM finalized_results')
    expect(calls[0]).toContain('ev-1')

    const inserts = calls.filter((c) =>
      sqlText(c).includes('INSERT INTO finalized_results')
    )
    // Values: event, band, name, rank, ...
    expect(inserts.map((c) => [c[2], c[4]])).toEqual([
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ])
    // The stored total is the one the standings calculated.
    expect(inserts[0]).toContain(86)
    expect(inserts[1]).toContain(65)
  })

  it('stores nothing and returns no rows for an event with no bands', async () => {
    mockGetBandScores.mockResolvedValue([])
    const results = await finalizeEventResults('ev-1', '2026.2')
    expect(results).toEqual([])
    expect(mockSql).not.toHaveBeenCalled()
  })
})
