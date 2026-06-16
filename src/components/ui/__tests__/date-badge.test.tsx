import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { DateBadge } from '../date-badge'

describe('DateBadge', () => {
  const date = '2026-10-15T08:30:00Z'

  it('renders the day, month and year for a confirmed date', () => {
    render(<DateBadge date={date} timezone="Australia/Sydney" showYear />)
    expect(screen.getByText('15')).toBeInTheDocument()
    expect(screen.getByText('OCT')).toBeInTheDocument()
    expect(screen.getByText('2026')).toBeInTheDocument()
  })

  it('renders "TBC" in place of the day for a tentative date', () => {
    render(<DateBadge date={date} timezone="Australia/Sydney" showYear tbc />)
    expect(screen.getByText('TBC')).toBeInTheDocument()
    expect(screen.queryByText('15')).not.toBeInTheDocument()
    // Month and year still come through so the badge stays informative.
    expect(screen.getByText('OCT')).toBeInTheDocument()
    expect(screen.getByText('2026')).toBeInTheDocument()
  })
})
