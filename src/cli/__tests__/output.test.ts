import { describe, it, expect } from 'vitest'
import { minuteCell, table } from '../output'

describe('minuteCell', () => {
  it('formats a Date, as the Postgres driver returns timestamptz, in UTC', () => {
    expect(minuteCell(new Date('2026-11-22T20:56:41.123Z'))).toBe(
      '2026-11-22T20:56Z'
    )
  })

  it('cuts a string to the minute and keeps its own offset', () => {
    expect(minuteCell('2026-11-23T06:56:00+10:00')).toBe('2026-11-23T06:56')
  })

  it('returns null for a missing or invalid value', () => {
    expect(minuteCell(null)).toBeNull()
    expect(minuteCell(undefined)).toBeNull()
    expect(minuteCell('')).toBeNull()
    expect(minuteCell(new Date('nope'))).toBeNull()
  })

  it('renders a post list row with a Date (the text-mode crash)', () => {
    const row = {
      posted_at: null,
      scheduled_for: new Date('2026-11-22T20:56:00Z'),
    }
    const text = table(
      ['when'],
      [[minuteCell(row.posted_at ?? row.scheduled_for)]]
    )
    expect(text.split('\n').at(-1)).toBe('2026-11-22T20:56Z')
  })
})
