import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { CompanyLogoMarquee } from '../company-logo-marquee'

// Mock the database functions
vi.mock('@/lib/db', () => ({
  getCompanies: vi.fn(),
}))

import { getCompanies } from '@/lib/db'

const mockGetCompanies = getCompanies as ReturnType<typeof vi.fn>

describe('CompanyLogoMarquee', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders companies with logos', async () => {
    const companiesWithLogos = [
      {
        slug: 'acme-corp',
        name: 'Acme Corp',
        logo_url: 'https://example.com/acme-logo.png',
        icon_url: null,
        band_count: 2,
        event_count: 1,
        created_at: new Date().toISOString(),
      },
      {
        slug: 'tech-inc',
        name: 'Tech Inc',
        logo_url: 'https://example.com/tech-logo.png',
        icon_url: null,
        band_count: 1,
        event_count: 1,
        created_at: new Date().toISOString(),
      },
    ]

    mockGetCompanies.mockResolvedValue(companiesWithLogos)

    render(await CompanyLogoMarquee({}))

    // Check section title renders
    expect(
      screen.getByRole('heading', { name: "Companies Who've Competed" })
    ).toBeInTheDocument()

    // Check subtitle renders
    expect(
      screen.getByText('Tech companies bringing the rock since 2022')
    ).toBeInTheDocument()

    // Check company logos are rendered (they appear twice due to duplication for seamless loop)
    const acmeLogos = screen.getAllByAltText('Acme Corp logo')
    expect(acmeLogos.length).toBeGreaterThanOrEqual(2)

    const techLogos = screen.getAllByAltText('Tech Inc logo')
    expect(techLogos.length).toBeGreaterThanOrEqual(2)

    // Check All Companies button
    expect(
      screen.getByRole('link', { name: /All Companies/i })
    ).toHaveAttribute('href', '/companies')
  }, 10000)

  it('renders nothing when no companies have logos', async () => {
    const companiesWithoutLogos = [
      {
        slug: 'no-logo-corp',
        name: 'No Logo Corp',
        logo_url: null,
        icon_url: null,
        band_count: 1,
        event_count: 1,
        created_at: new Date().toISOString(),
      },
    ]

    mockGetCompanies.mockResolvedValue(companiesWithoutLogos)

    const { container } = render(await CompanyLogoMarquee({}))

    // Component should render nothing
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when no companies exist', async () => {
    mockGetCompanies.mockResolvedValue([])

    const { container } = render(await CompanyLogoMarquee({}))

    // Component should render nothing
    expect(container.firstChild).toBeNull()
  })

  it('links logos to company detail pages', async () => {
    const companies = [
      {
        slug: 'salesforce',
        name: 'Salesforce',
        logo_url: 'https://example.com/sf-logo.png',
        icon_url: null,
        band_count: 1,
        event_count: 1,
        created_at: new Date().toISOString(),
      },
    ]

    mockGetCompanies.mockResolvedValue(companies)

    render(await CompanyLogoMarquee({}))

    // Find links to company page
    const companyLinks = screen.getAllByRole('link', { name: /Salesforce/ })
    expect(companyLinks.length).toBeGreaterThanOrEqual(2) // Duplicated for seamless loop
    expect(companyLinks[0]).toHaveAttribute(
      'href',
      '/companies?company=salesforce'
    )
  })

  it('renders with custom title and subtitle', async () => {
    const companies = [
      {
        slug: 'test-co',
        name: 'Test Co',
        logo_url: 'https://example.com/test-logo.png',
        icon_url: null,
        band_count: 1,
        event_count: 1,
        created_at: new Date().toISOString(),
      },
    ]

    mockGetCompanies.mockResolvedValue(companies)

    render(
      await CompanyLogoMarquee({
        title: 'Our Partners',
        subtitle: 'Companies that rock',
      })
    )

    expect(
      screen.getByRole('heading', { name: 'Our Partners' })
    ).toBeInTheDocument()
    expect(screen.getByText('Companies that rock')).toBeInTheDocument()
  })

  it('hides View All button when showViewAll is false', async () => {
    const companies = [
      {
        slug: 'test-co',
        name: 'Test Co',
        logo_url: 'https://example.com/test-logo.png',
        icon_url: null,
        band_count: 1,
        event_count: 1,
        created_at: new Date().toISOString(),
      },
    ]

    mockGetCompanies.mockResolvedValue(companies)

    render(await CompanyLogoMarquee({ showViewAll: false }))

    expect(
      screen.queryByRole('link', { name: /All Companies/i })
    ).not.toBeInTheDocument()
  })

  it('duplicates logos to ensure minimum count for smooth scrolling', async () => {
    // With only 2 companies, they should be duplicated to reach minimum of 8
    const companies = [
      {
        slug: 'company-a',
        name: 'Company A',
        logo_url: 'https://example.com/a-logo.png',
        icon_url: null,
        band_count: 1,
        event_count: 1,
        created_at: new Date().toISOString(),
      },
      {
        slug: 'company-b',
        name: 'Company B',
        logo_url: 'https://example.com/b-logo.png',
        icon_url: null,
        band_count: 1,
        event_count: 1,
        created_at: new Date().toISOString(),
      },
    ]

    mockGetCompanies.mockResolvedValue(companies)

    render(await CompanyLogoMarquee({}))

    // With 2 companies duplicated to 8, then doubled for seamless loop = 16 total
    // Each company should appear at least 8 times (4 duplications × 2 for loop)
    const companyALogos = screen.getAllByAltText('Company A logo')
    expect(companyALogos.length).toBeGreaterThanOrEqual(8)
  })
})
