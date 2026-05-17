import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { SponsorBadge } from '../sponsor-badge'

describe('SponsorBadge', () => {
  it('renders the sponsor name as image alt text', () => {
    render(
      <SponsorBadge
        name="Jumbo Interactive"
        logoUrl="https://example.com/logo.svg"
      />
    )

    expect(screen.getByAltText('Jumbo Interactive')).toBeInTheDocument()
  })

  it('renders the default "Powered by" label', () => {
    render(<SponsorBadge name="Test Sponsor" logoUrl="/logo.svg" />)

    expect(screen.getByText('Powered by')).toBeInTheDocument()
  })

  it('renders a custom label when provided', () => {
    render(
      <SponsorBadge
        name="Test Sponsor"
        logoUrl="/logo.svg"
        label="Proudly sponsored by"
      />
    )

    expect(screen.getByText('Proudly sponsored by')).toBeInTheDocument()
  })

  it('uses the sponsor logo URL as the image source', () => {
    render(
      <SponsorBadge
        name="Test Sponsor"
        logoUrl="https://example.com/logo.svg"
      />
    )

    const image = screen.getByAltText('Test Sponsor') as HTMLImageElement
    expect(image.src).toBe('https://example.com/logo.svg')
  })

  it('links to /sponsors by default', () => {
    render(<SponsorBadge name="Test Sponsor" logoUrl="/logo.svg" />)

    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/sponsors')
  })

  it('links to a custom URL when link prop is provided', () => {
    render(
      <SponsorBadge
        name="Test Sponsor"
        logoUrl="/logo.svg"
        link="https://example.com"
      />
    )

    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', 'https://example.com')
  })

  it('opens link in a new tab when external is true', () => {
    render(
      <SponsorBadge
        name="Test Sponsor"
        logoUrl="/logo.svg"
        link="https://example.com"
        external
      />
    )

    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('does not open in a new tab by default', () => {
    render(<SponsorBadge name="Test Sponsor" logoUrl="/logo.svg" />)

    const link = screen.getByRole('link')
    expect(link).not.toHaveAttribute('target')
  })
})
