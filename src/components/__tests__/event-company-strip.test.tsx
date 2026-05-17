import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import {
  EventCompanyStrip,
  type EventCompanyStripBand,
} from '../event-company-strip'

const mentorloop: EventCompanyStripBand = {
  company_slug: 'mentorloop',
  company_name: 'Mentorloop',
  company_logo_url: 'https://example.com/mentorloop.svg',
}

const seek: EventCompanyStripBand = {
  company_slug: 'seek',
  company_name: 'SEEK',
  company_logo_url: 'https://example.com/seek.svg',
}

describe('EventCompanyStrip', () => {
  it('renders nothing when no bands are provided', () => {
    const { container } = render(<EventCompanyStrip bands={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when no band has a usable logo', () => {
    const { container } = render(
      <EventCompanyStrip
        bands={[{ company_slug: 'foo', company_name: 'Foo' }]}
      />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders one logo per participating company', () => {
    render(<EventCompanyStrip bands={[mentorloop, seek]} />)
    expect(screen.getByAltText('Mentorloop logo')).toBeInTheDocument()
    expect(screen.getByAltText('SEEK logo')).toBeInTheDocument()
  })

  it('deduplicates companies when multiple bands share a company', () => {
    render(<EventCompanyStrip bands={[mentorloop, mentorloop, seek, seek]} />)
    expect(screen.getAllByAltText('Mentorloop logo')).toHaveLength(1)
    expect(screen.getAllByAltText('SEEK logo')).toHaveLength(1)
  })

  it('links each logo to the company page', () => {
    render(<EventCompanyStrip bands={[mentorloop]} />)
    const link = screen.getByRole('link', { name: /mentorloop/i })
    expect(link).toHaveAttribute('href', '/companies/mentorloop')
  })

  it('falls back to the company icon when no logo is available', () => {
    render(
      <EventCompanyStrip
        bands={[
          {
            company_slug: 'foo',
            company_name: 'Foo',
            company_icon_url: 'https://example.com/foo-icon.svg',
          },
        ]}
      />
    )
    expect(screen.getByAltText('Foo logo')).toBeInTheDocument()
  })

  it('skips bands without a company_slug or name', () => {
    render(
      <EventCompanyStrip
        bands={[
          mentorloop,
          { company_logo_url: 'https://example.com/orphan.svg' },
          { company_slug: 'partial', company_logo_url: 'x.svg' },
        ]}
      />
    )
    expect(screen.getAllByRole('link')).toHaveLength(1)
  })
})
