import { describe, it, expect } from 'vitest'
import {
  type BandScoreData,
  type ScoringVersion,
  calculateJudgeScore,
  calculateTotalScore,
  getCategories,
  getCategoryById,
  getDefaultScoringVersion,
  getEventWinnerInfo,
  getMaxJudgePoints,
  getScoringConfig,
  getScoringFormula,
  hasDetailedBreakdown,
  isValidScoringVersion,
  parseScoringVersion,
} from '../scoring'

describe('scoring', () => {
  describe('getScoringConfig', () => {
    it('returns 2022.1 config without detailed breakdown', () => {
      const config = getScoringConfig('2022.1')
      expect(config.version).toBe('2022.1')
      expect(config.totalPoints).toBe(0)
      expect(config.hasDetailedBreakdown).toBe(false)
      expect(config.categories).toHaveLength(0)
    })

    it('returns 2025.1 config with Scream-o-Meter', () => {
      const config = getScoringConfig('2025.1')
      expect(config.version).toBe('2025.1')
      expect(config.totalPoints).toBe(100)
      expect(config.hasDetailedBreakdown).toBe(true)
      expect(config.categories).toHaveLength(5)
      const ids = config.categories.map((c) => c.id)
      expect(ids).toContain('scream_o_meter')
      expect(ids).not.toContain('visuals')
    })

    it('returns 2026.1 config with Visuals (replacing Scream-o-Meter)', () => {
      const config = getScoringConfig('2026.1')
      expect(config.version).toBe('2026.1')
      expect(config.totalPoints).toBe(100)
      expect(config.hasDetailedBreakdown).toBe(true)
      expect(config.categories).toHaveLength(5)
      const ids = config.categories.map((c) => c.id)
      expect(ids).toContain('visuals')
      expect(ids).not.toContain('scream_o_meter')
    })

    it('crowd vibe is 30 points in 2025.1 and 20 in 2026.1', () => {
      const v2025 = getScoringConfig('2025.1').categories.find(
        (c) => c.id === 'crowd_vibe'
      )
      const v2026 = getScoringConfig('2026.1').categories.find(
        (c) => c.id === 'crowd_vibe'
      )
      expect(v2025?.maxPoints).toBe(30)
      expect(v2026?.maxPoints).toBe(20)
    })

    it('category points sum to total for 2025.1 and 2026.1', () => {
      const sum2025 = getScoringConfig('2025.1').categories.reduce(
        (acc, c) => acc + c.maxPoints,
        0
      )
      const sum2026 = getScoringConfig('2026.1').categories.reduce(
        (acc, c) => acc + c.maxPoints,
        0
      )
      expect(sum2025).toBe(100)
      expect(sum2026).toBe(100)
    })
  })

  describe('hasDetailedBreakdown', () => {
    it('returns false for 2022.1', () => {
      expect(hasDetailedBreakdown('2022.1')).toBe(false)
    })

    it('returns true for 2025.1', () => {
      expect(hasDetailedBreakdown('2025.1')).toBe(true)
    })

    it('returns true for 2026.1', () => {
      expect(hasDetailedBreakdown('2026.1')).toBe(true)
    })
  })

  describe('getDefaultScoringVersion', () => {
    it('returns 2026.1 as the default', () => {
      expect(getDefaultScoringVersion()).toBe('2026.1')
    })
  })

  describe('isValidScoringVersion', () => {
    it('accepts known versions', () => {
      expect(isValidScoringVersion('2022.1')).toBe(true)
      expect(isValidScoringVersion('2025.1')).toBe(true)
      expect(isValidScoringVersion('2026.1')).toBe(true)
    })

    it('rejects unknown strings', () => {
      expect(isValidScoringVersion('2027.1')).toBe(false)
      expect(isValidScoringVersion('2026')).toBe(false)
      expect(isValidScoringVersion('')).toBe(false)
      expect(isValidScoringVersion('2025.2')).toBe(false)
    })
  })

  describe('parseScoringVersion', () => {
    it('returns the version when valid', () => {
      expect(parseScoringVersion({ scoring_version: '2025.1' })).toBe('2025.1')
      expect(parseScoringVersion({ scoring_version: '2022.1' })).toBe('2022.1')
    })

    it('falls back to 2026.1 when missing or null', () => {
      expect(parseScoringVersion(null)).toBe('2026.1')
      expect(parseScoringVersion(undefined)).toBe('2026.1')
      expect(parseScoringVersion({})).toBe('2026.1')
    })

    it('falls back to 2026.1 for invalid versions', () => {
      expect(parseScoringVersion({ scoring_version: '1999.9' })).toBe('2026.1')
      expect(parseScoringVersion({ scoring_version: '' })).toBe('2026.1')
    })
  })

  describe('getCategories', () => {
    it('returns empty array for 2022.1', () => {
      expect(getCategories('2022.1')).toEqual([])
    })

    it('returns five categories for 2025.1 and 2026.1', () => {
      expect(getCategories('2025.1')).toHaveLength(5)
      expect(getCategories('2026.1')).toHaveLength(5)
    })
  })

  describe('getCategoryById', () => {
    it('finds a category that exists for the version', () => {
      const cat = getCategoryById('2026.1', 'visuals')
      expect(cat).toBeDefined()
      expect(cat?.label).toBe('Visuals')
    })

    it('returns undefined when the category is not in the version', () => {
      expect(getCategoryById('2026.1', 'scream_o_meter')).toBeUndefined()
      expect(getCategoryById('2025.1', 'visuals')).toBeUndefined()
      expect(getCategoryById('2022.1', 'song_choice')).toBeUndefined()
    })
  })

  describe('getMaxJudgePoints', () => {
    it('returns 0 for 2022.1', () => {
      expect(getMaxJudgePoints('2022.1')).toBe(0)
    })

    it('returns 80 for 2025.1 (song 20 + perf 30 + vibe 30)', () => {
      expect(getMaxJudgePoints('2025.1')).toBe(80)
    })

    it('returns 90 for 2026.1 (song 20 + perf 30 + vibe 20 + visuals 20)', () => {
      expect(getMaxJudgePoints('2026.1')).toBe(90)
    })

    it('returns 0 for an unrecognized version', () => {
      expect(getMaxJudgePoints('9999.9' as ScoringVersion)).toBe(0)
    })
  })

  describe('getScoringFormula', () => {
    it('matches the description in the config for each version', () => {
      expect(getScoringFormula('2022.1')).toBe('Single winner display only')
      expect(getScoringFormula('2025.1')).toContain('Scream-o-Meter')
      expect(getScoringFormula('2026.1')).toContain('Visuals')
    })
  })

  describe('calculateTotalScore', () => {
    it('returns 0 for 2022.1 regardless of inputs', () => {
      const scores: BandScoreData = {
        avg_song_choice: 20,
        avg_performance: 30,
        avg_crowd_vibe: 30,
        crowd_score: 10,
        crowd_vote_count: 999,
      }
      expect(calculateTotalScore(scores, '2022.1')).toBe(0)
      expect(calculateTotalScore(scores, '2022.1', [scores])).toBe(0)
    })

    it('returns 0 for empty scores when no allScores provided', () => {
      expect(calculateTotalScore({}, '2025.1')).toBe(0)
      expect(calculateTotalScore({}, '2026.1')).toBe(0)
    })

    it('sums judge scores plus scream-o-meter for 2025.1', () => {
      const scores: BandScoreData = {
        avg_song_choice: 18,
        avg_performance: 25,
        avg_crowd_vibe: 28,
        crowd_score: 7,
        crowd_vote_count: 50,
      }
      const total = calculateTotalScore(scores, '2025.1')
      // 18 + 25 + 28 + 0 (no allScores → no normalized crowd vote) + 7 = 78
      expect(total).toBe(78)
    })

    it('sums judge scores plus visuals for 2026.1', () => {
      const scores: BandScoreData = {
        avg_song_choice: 15,
        avg_performance: 22,
        avg_crowd_vibe: 18,
        avg_visuals: 17,
        crowd_vote_count: 0,
      }
      const total = calculateTotalScore(scores, '2026.1')
      // 15 + 22 + 18 + 0 + 17 = 72
      expect(total).toBe(72)
    })

    it('normalizes crowd vote so the leader gets 10 points', () => {
      const a: BandScoreData = {
        avg_song_choice: 0,
        avg_performance: 0,
        avg_crowd_vibe: 0,
        crowd_vote_count: 100,
        crowd_score: 0,
      }
      const b: BandScoreData = {
        ...a,
        crowd_vote_count: 50,
      }
      const total = calculateTotalScore(a, '2025.1', [a, b])
      // a is the leader → 10 normalized crowd-vote points
      expect(total).toBe(10)
      const totalB = calculateTotalScore(b, '2025.1', [a, b])
      // b has half the votes → 5 normalized crowd-vote points
      expect(totalB).toBe(5)
    })

    it('handles zero votes across the board (max votes = 0)', () => {
      const scores: BandScoreData = {
        avg_song_choice: 10,
        avg_performance: 10,
        avg_crowd_vibe: 10,
        crowd_vote_count: 0,
        crowd_score: 0,
      }
      const total = calculateTotalScore(scores, '2025.1', [scores])
      // 10 + 10 + 10 + 0 (max=0 short-circuits) + 0 = 30
      expect(total).toBe(30)
    })

    it('treats null/undefined inputs as zero', () => {
      const scores: BandScoreData = {
        avg_song_choice: undefined,
        avg_performance: undefined,
        avg_crowd_vibe: undefined,
        avg_visuals: undefined,
      }
      expect(calculateTotalScore(scores, '2026.1')).toBe(0)
    })

    it('produces a perfect 100 in 2026.1 when every category is maxed and band is the vote leader', () => {
      const scores: BandScoreData = {
        avg_song_choice: 20,
        avg_performance: 30,
        avg_crowd_vibe: 20,
        avg_visuals: 20,
        crowd_vote_count: 200,
      }
      const total = calculateTotalScore(scores, '2026.1', [scores])
      expect(total).toBe(100)
    })

    it('produces a perfect 100 in 2025.1 with max scream-o-meter and vote leadership', () => {
      const scores: BandScoreData = {
        avg_song_choice: 20,
        avg_performance: 30,
        avg_crowd_vibe: 30,
        crowd_score: 10,
        crowd_vote_count: 1,
      }
      const total = calculateTotalScore(scores, '2025.1', [scores])
      expect(total).toBe(100)
    })
  })

  describe('calculateJudgeScore', () => {
    it('returns 0 for 2022.1', () => {
      expect(calculateJudgeScore({ avg_song_choice: 20 }, '2022.1')).toBe(0)
    })

    it('sums song + performance + crowd_vibe for 2025.1 (no visuals)', () => {
      const total = calculateJudgeScore(
        { avg_song_choice: 10, avg_performance: 20, avg_crowd_vibe: 25 },
        '2025.1'
      )
      expect(total).toBe(55)
    })

    it('includes visuals for 2026.1', () => {
      const total = calculateJudgeScore(
        {
          avg_song_choice: 10,
          avg_performance: 20,
          avg_crowd_vibe: 15,
          avg_visuals: 18,
        },
        '2026.1'
      )
      expect(total).toBe(63)
    })

    it('treats undefined inputs as zero', () => {
      expect(calculateJudgeScore({}, '2025.1')).toBe(0)
      expect(calculateJudgeScore({}, '2026.1')).toBe(0)
    })
  })

  describe('getEventWinnerInfo', () => {
    it('exposes winner name when present', () => {
      const info = getEventWinnerInfo({
        scoring_version: '2025.1',
        winner: 'The Loud Ones',
      })
      expect(info.scoringVersion).toBe('2025.1')
      expect(info.hasDetailedResults).toBe(true)
      expect(info.winnerName).toBe('The Loud Ones')
    })

    it('marks 2022.1 events as not having detailed results', () => {
      const info = getEventWinnerInfo({
        scoring_version: '2022.1',
        winner: 'Old Winner',
      })
      expect(info.hasDetailedResults).toBe(false)
      expect(info.winnerName).toBe('Old Winner')
    })

    it('falls back to default version when event info is null', () => {
      const info = getEventWinnerInfo(null)
      expect(info.scoringVersion).toBe('2026.1')
      expect(info.hasDetailedResults).toBe(true)
      expect(info.winnerName).toBeUndefined()
    })
  })
})
