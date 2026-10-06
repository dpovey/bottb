import { describe, expect, it } from 'vitest'
import {
  competingBands,
  isCompetingBand,
  NON_COMPETING_LABEL,
} from '../competing-bands'

describe('isCompetingBand', () => {
  it('treats a band with no info as competing', () => {
    expect(isCompetingBand({})).toBe(true)
    expect(isCompetingBand({ info: null })).toBe(true)
    expect(isCompetingBand({ info: {} })).toBe(true)
  })

  it('treats a band flagged non_competing: true as special guests', () => {
    expect(isCompetingBand({ info: { non_competing: true } })).toBe(false)
  })

  it('only honours a real true, not a truthy lookalike', () => {
    expect(isCompetingBand({ info: { non_competing: false } })).toBe(true)
    expect(isCompetingBand({ info: { non_competing: 'true' } })).toBe(true)
    expect(isCompetingBand({ info: { non_competing: 1 } })).toBe(true)
  })
})

describe('competingBands', () => {
  it('drops special guests and keeps the running order', () => {
    const bands = [
      { id: 'guests', order: 0, info: { non_competing: true } },
      { id: 'a', order: 1 },
      { id: 'b', order: 2, info: { logo_url: 'x' } },
    ]
    expect(competingBands(bands).map((b) => b.id)).toEqual(['a', 'b'])
  })
})

it('labels non-competing bands "Special guests"', () => {
  expect(NON_COMPETING_LABEL).toBe('Special guests')
})
