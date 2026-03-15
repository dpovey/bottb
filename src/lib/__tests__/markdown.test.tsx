import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { stripMarkdown, MarkdownText } from '../markdown'

describe('stripMarkdown', () => {
  it('returns empty string for falsy input', () => {
    expect(stripMarkdown('')).toBe('')
    expect(stripMarkdown(null as unknown as string)).toBe('')
    expect(stripMarkdown(undefined as unknown as string)).toBe('')
  })

  it('returns plain text unchanged', () => {
    const text = 'Just some plain text without any markdown'
    expect(stripMarkdown(text)).toBe(text)
  })

  it('converts markdown links to plain text', () => {
    expect(
      stripMarkdown(
        'Check out [Battle of the Agile Bands](https://example.com)'
      )
    ).toBe('Check out Battle of the Agile Bands')
  })

  it('handles multiple links', () => {
    expect(stripMarkdown('Visit [link1](url1) and [link2](url2)')).toBe(
      'Visit link1 and link2'
    )
  })

  it('removes bold markers', () => {
    expect(stripMarkdown('This is **bold** text')).toBe('This is bold text')
  })

  it('removes italic markers', () => {
    expect(stripMarkdown('This is *italic* text')).toBe('This is italic text')
  })

  it('handles combined formatting', () => {
    expect(
      stripMarkdown(
        'Join [BOTAB](https://example.com) for a **great** night of *music*'
      )
    ).toBe('Join BOTAB for a great night of music')
  })
})

describe('MarkdownText', () => {
  it('renders plain text correctly', () => {
    render(<MarkdownText>Hello world</MarkdownText>)
    expect(screen.getByText('Hello world')).toBeInTheDocument()
  })

  it('renders markdown links as anchor tags', () => {
    render(
      <MarkdownText>
        Check out [Battle of the Agile
        Bands](https://battleoftheagilebands.com/)
      </MarkdownText>
    )
    const link = screen.getByRole('link', { name: 'Battle of the Agile Bands' })
    expect(link).toHaveAttribute('href', 'https://battleoftheagilebands.com/')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('renders internal links without target=_blank', () => {
    render(<MarkdownText>Go to [events](/events) page</MarkdownText>)
    const link = screen.getByRole('link', { name: 'events' })
    expect(link).toHaveAttribute('href', '/events')
    expect(link).not.toHaveAttribute('target')
  })

  it('renders bold text correctly', () => {
    render(<MarkdownText>This is **important** stuff</MarkdownText>)
    const strong = screen.getByText('important')
    expect(strong.tagName).toBe('STRONG')
  })

  it('renders italic text correctly', () => {
    render(<MarkdownText>This is *emphasized* text</MarkdownText>)
    const em = screen.getByText('emphasized')
    expect(em.tagName).toBe('EM')
  })

  it('applies className to the paragraph', () => {
    const { container } = render(
      <MarkdownText className="text-lg text-muted">Some text</MarkdownText>
    )
    const p = container.querySelector('p')
    expect(p).toHaveClass('text-lg', 'text-muted')
  })

  it('returns null for empty children', () => {
    const { container } = render(<MarkdownText>{''}</MarkdownText>)
    expect(container.firstChild).toBeNull()
  })
})
