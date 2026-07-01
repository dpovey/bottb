import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { CompanyBadgeGroup } from '../company-badge-group'
import type { BandCompany } from '@/lib/db-types'

const companies: BandCompany[] = [
  { slug: 'rex-software', name: 'Rex Software', is_primary: true },
  { slug: 'urbanx', name: 'UrbanX', is_primary: false },
]

describe('CompanyBadgeGroup', () => {
  it('renders a badge for every company', () => {
    render(<CompanyBadgeGroup companies={companies} />)

    expect(screen.getByText('Rex Software')).toBeInTheDocument()
    expect(screen.getByText('UrbanX')).toBeInTheDocument()
  })

  it('links each badge to its company page', () => {
    render(<CompanyBadgeGroup companies={companies} />)

    expect(screen.getByRole('link', { name: /Rex Software/ })).toHaveAttribute(
      'href',
      '/companies/rex-software'
    )
    expect(screen.getByRole('link', { name: /UrbanX/ })).toHaveAttribute(
      'href',
      '/companies/urbanx'
    )
  })

  it('renders plain (non-link) badges when asLink is false', () => {
    render(<CompanyBadgeGroup companies={companies} asLink={false} />)

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText('UrbanX')).toBeInTheDocument()
  })

  it('renders nothing when the company list is empty', () => {
    const { container } = render(<CompanyBadgeGroup companies={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
