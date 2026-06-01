import {
  formatEventDate,
  getDatePartsInTimezone,
  getEventCountdown,
} from '../date-utils'

describe('formatEventDate', () => {
  describe('with UTC timezone (default)', () => {
    it('formats a date correctly with ordinal suffix', () => {
      const dateString = '2024-12-25T18:30:00Z'
      const result = formatEventDate(dateString)
      expect(result).toBe('25th December 2024 @ 6:30PM')
    })

    it('handles 1st correctly', () => {
      const dateString = '2024-01-01T12:00:00Z'
      const result = formatEventDate(dateString)
      expect(result).toBe('1st January 2024 @ 12:00PM')
    })

    it('handles 2nd correctly', () => {
      const dateString = '2024-02-02T12:00:00Z'
      const result = formatEventDate(dateString)
      expect(result).toBe('2nd February 2024 @ 12:00PM')
    })

    it('handles 3rd correctly', () => {
      const dateString = '2024-03-03T12:00:00Z'
      const result = formatEventDate(dateString)
      expect(result).toBe('3rd March 2024 @ 12:00PM')
    })

    it('handles 4th correctly', () => {
      const dateString = '2024-04-04T12:00:00Z'
      const result = formatEventDate(dateString)
      expect(result).toBe('4th April 2024 @ 12:00PM')
    })

    it('handles 11th correctly (special case)', () => {
      const dateString = '2024-11-11T12:00:00Z'
      const result = formatEventDate(dateString)
      expect(result).toBe('11th November 2024 @ 12:00PM')
    })

    it('handles 12th correctly (special case)', () => {
      const dateString = '2024-12-12T12:00:00Z'
      const result = formatEventDate(dateString)
      expect(result).toBe('12th December 2024 @ 12:00PM')
    })

    it('handles 13th correctly (special case)', () => {
      const dateString = '2024-12-13T12:00:00Z'
      const result = formatEventDate(dateString)
      expect(result).toBe('13th December 2024 @ 12:00PM')
    })

    it('handles 21st correctly', () => {
      const dateString = '2024-12-21T12:00:00Z'
      const result = formatEventDate(dateString)
      expect(result).toBe('21st December 2024 @ 12:00PM')
    })

    it('handles 22nd correctly', () => {
      const dateString = '2024-12-22T12:00:00Z'
      const result = formatEventDate(dateString)
      expect(result).toBe('22nd December 2024 @ 12:00PM')
    })

    it('handles 23rd correctly', () => {
      const dateString = '2024-12-23T12:00:00Z'
      const result = formatEventDate(dateString)
      expect(result).toBe('23rd December 2024 @ 12:00PM')
    })

    it('handles 24th correctly', () => {
      const dateString = '2024-12-24T12:00:00Z'
      const result = formatEventDate(dateString)
      expect(result).toBe('24th December 2024 @ 12:00PM')
    })

    it('handles AM time correctly', () => {
      const dateString = '2024-12-25T09:15:00Z'
      const result = formatEventDate(dateString)
      expect(result).toBe('25th December 2024 @ 9:15AM')
    })

    it('handles midnight correctly', () => {
      const dateString = '2024-12-25T00:00:00Z'
      const result = formatEventDate(dateString)
      expect(result).toBe('25th December 2024 @ 12:00AM')
    })

    it('handles noon correctly', () => {
      const dateString = '2024-12-25T12:00:00Z'
      const result = formatEventDate(dateString)
      expect(result).toBe('25th December 2024 @ 12:00PM')
    })

    it('handles single digit minutes correctly', () => {
      const dateString = '2024-12-25T18:05:00Z'
      const result = formatEventDate(dateString)
      expect(result).toBe('25th December 2024 @ 6:05PM')
    })

    it('handles all months correctly', () => {
      const months = [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
      ]

      months.forEach((month, index) => {
        const dateString = `2024-${String(index + 1).padStart(
          2,
          '0'
        )}-15T12:00:00Z`
        const result = formatEventDate(dateString)
        expect(result).toContain(month)
      })
    })

    it('handles different years correctly', () => {
      const dateString = '2025-12-25T18:30:00Z'
      const result = formatEventDate(dateString)
      expect(result).toBe('25th December 2025 @ 6:30PM')
    })

    it('handles invalid date gracefully', () => {
      const dateString = 'invalid-date'
      const result = formatEventDate(dateString)
      expect(result).toBe('Invalid Date December NaN @ NaN:NaNaM')
    })

    it('handles empty string gracefully', () => {
      const dateString = ''
      const result = formatEventDate(dateString)
      expect(result).toBe('Invalid Date December NaN @ NaN:NaNaM')
    })
  })

  describe('with specific timezones', () => {
    it('converts UTC to Brisbane time (UTC+10)', () => {
      // 8:30 AM UTC should be 6:30 PM Brisbane (AEST, UTC+10)
      const dateString = '2024-09-05T08:30:00Z'
      const result = formatEventDate(dateString, 'Australia/Brisbane')
      expect(result).toBe('5th September 2024 @ 6:30PM')
    })

    it('converts UTC to Sydney time during DST (UTC+11)', () => {
      // October in Sydney is AEDT (UTC+11)
      // 8:30 AM UTC should be 7:30 PM Sydney
      const dateString = '2025-10-23T08:30:00Z'
      const result = formatEventDate(dateString, 'Australia/Sydney')
      expect(result).toBe('23rd October 2025 @ 7:30PM')
    })

    it('converts UTC to Sydney time outside DST (UTC+10)', () => {
      // June in Sydney is AEST (UTC+10)
      // 8:30 AM UTC should be 6:30 PM Sydney
      const dateString = '2025-06-15T08:30:00Z'
      const result = formatEventDate(dateString, 'Australia/Sydney')
      expect(result).toBe('15th June 2025 @ 6:30PM')
    })

    it('handles date that crosses into next day in local timezone', () => {
      // 20:00 UTC on Dec 31 is 06:00 on Jan 1 in Brisbane (UTC+10)
      const dateString = '2024-12-31T20:00:00Z'
      const result = formatEventDate(dateString, 'Australia/Brisbane')
      expect(result).toBe('1st January 2025 @ 6:00AM')
    })

    it('handles US timezones', () => {
      // 18:30 UTC should be 10:30 AM PST (UTC-8) during winter
      const dateString = '2024-12-25T18:30:00Z'
      const result = formatEventDate(dateString, 'America/Los_Angeles')
      expect(result).toBe('25th December 2024 @ 10:30AM')
    })
  })
})

describe('getDatePartsInTimezone', () => {
  it('returns correct parts for UTC', () => {
    const dateString = '2024-12-25T18:30:00Z'
    const result = getDatePartsInTimezone(dateString)
    expect(result).toEqual({
      day: 25,
      month: 'DEC',
      year: 2024,
    })
  })

  it('returns correct parts for Brisbane timezone', () => {
    // 20:00 UTC on Dec 31 is 06:00 on Jan 1 in Brisbane
    const dateString = '2024-12-31T20:00:00Z'
    const result = getDatePartsInTimezone(dateString, 'Australia/Brisbane')
    expect(result).toEqual({
      day: 1,
      month: 'JAN',
      year: 2025,
    })
  })

  it('handles Date objects', () => {
    const date = new Date('2024-12-25T18:30:00Z')
    const result = getDatePartsInTimezone(date)
    expect(result).toEqual({
      day: 25,
      month: 'DEC',
      year: 2024,
    })
  })
})

describe('getEventCountdown', () => {
  // Anchor "now" to a fixed instant so tests are deterministic regardless of
  // when CI runs them. 2026-06-01 00:00 in Melbourne (UTC+10) = 2026-05-31 14:00Z.
  const NOW_MELB_START_OF_DAY = new Date('2026-05-31T14:00:00Z')
  const TZ = 'Australia/Melbourne'

  it('returns "Tonight" when the event is today in the given timezone', () => {
    expect(
      getEventCountdown('2026-06-01T20:00:00+10:00', TZ, NOW_MELB_START_OF_DAY)
    ).toBe('Tonight')
  })

  it('returns "Tomorrow" when the event is the next calendar day', () => {
    expect(
      getEventCountdown('2026-06-02T20:00:00+10:00', TZ, NOW_MELB_START_OF_DAY)
    ).toBe('Tomorrow')
  })

  it('returns "{N} days left" for 2-6 days out', () => {
    expect(
      getEventCountdown('2026-06-04T20:00:00+10:00', TZ, NOW_MELB_START_OF_DAY)
    ).toBe('3 days left')
    expect(
      getEventCountdown('2026-06-06T20:00:00+10:00', TZ, NOW_MELB_START_OF_DAY)
    ).toBe('5 days left')
  })

  it('returns "1 week left" for 7-13 days out', () => {
    expect(
      getEventCountdown('2026-06-08T20:00:00+10:00', TZ, NOW_MELB_START_OF_DAY)
    ).toBe('1 week left')
    expect(
      getEventCountdown('2026-06-14T20:00:00+10:00', TZ, NOW_MELB_START_OF_DAY)
    ).toBe('1 week left')
  })

  it('returns plural "{N} weeks left" for 14+ days', () => {
    expect(
      getEventCountdown('2026-06-15T20:00:00+10:00', TZ, NOW_MELB_START_OF_DAY)
    ).toBe('2 weeks left')
    expect(
      getEventCountdown('2026-07-27T20:00:00+10:00', TZ, NOW_MELB_START_OF_DAY)
    ).toBe('8 weeks left')
  })

  it('returns null once the event date has passed in the event timezone', () => {
    expect(
      getEventCountdown('2026-05-31T20:00:00+10:00', TZ, NOW_MELB_START_OF_DAY)
    ).toBe(null)
    expect(
      getEventCountdown('2026-05-01T20:00:00+10:00', TZ, NOW_MELB_START_OF_DAY)
    ).toBe(null)
  })

  it('uses the event timezone for the day boundary, not UTC', () => {
    // "now" = 2026-06-01 14:30Z. In UTC that's still 2026-06-01 (so a UTC
    // implementation would call a 2026-06-02 event "Tomorrow"), but in
    // Melbourne (UTC+10) it's already 2026-06-02 00:30 — same calendar day
    // as the event. Expecting "Tonight" verifies we honour the event tz.
    const justAfterMelbMidnight = new Date('2026-06-01T14:30:00Z')
    expect(
      getEventCountdown('2026-06-02T20:00:00+10:00', TZ, justAfterMelbMidnight)
    ).toBe('Tonight')
  })

  it('returns null for invalid date strings', () => {
    expect(getEventCountdown('not a date', TZ, NOW_MELB_START_OF_DAY)).toBe(
      null
    )
  })
})
