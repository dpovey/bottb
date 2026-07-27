import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { EarlyBirdBadge } from '../early-bird-badge'
import { getEarlyBirdOffer } from '@/lib/date-utils'

const TZ = 'Australia/Brisbane'
const ENDS_AT = '2026-08-01T23:59:59+10:00'

/** Resolve the Brisbane offer as it would look at a given instant. */
const offerAt = (iso: string) =>
  getEarlyBirdOffer({ ends_at: ENDS_AT }, TZ, new Date(iso))

describe('EarlyBirdBadge', () => {
  it('renders nothing when there is no offer', () => {
    const { container } = render(<EarlyBirdBadge offer={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when the offer prop is omitted', () => {
    const { container } = render(<EarlyBirdBadge />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing once the deadline has passed', () => {
    const { container } = render(
      <EarlyBirdBadge offer={offerAt('2026-08-02T00:00:00Z')} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the abbreviated deadline while it is still days away', () => {
    render(<EarlyBirdBadge offer={offerAt('2026-07-27T00:00:00Z')} />)
    expect(screen.getByText(/Early bird ends 1 Aug/)).toBeInTheDocument()
  })

  it('escalates to "tomorrow" the day before', () => {
    render(<EarlyBirdBadge offer={offerAt('2026-07-30T23:00:00Z')} />)
    expect(screen.getByText(/Early bird ends tomorrow/)).toBeInTheDocument()
  })

  it('escalates to "today" on the final day', () => {
    render(<EarlyBirdBadge offer={offerAt('2026-07-31T23:00:00Z')} />)
    expect(screen.getByText(/Early bird ends today/)).toBeInTheDocument()
  })
})
