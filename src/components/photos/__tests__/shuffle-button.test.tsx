import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { ShuffleButton } from '../shuffle-button'

describe('ShuffleButton', () => {
  it('renders inactive state when isActive={false}', () => {
    render(<ShuffleButton isActive={false} onClick={() => {}} />)

    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-pressed', 'false')
    expect(button).toHaveAttribute('aria-label', 'Enable shuffle')
    expect(button).toHaveAttribute('title', 'Shuffle')
  })

  it('renders active state when isActive={true}', () => {
    render(<ShuffleButton isActive={true} onClick={() => {}} />)

    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(button).toHaveAttribute('aria-label', 'Disable shuffle')
    expect(button).toHaveAttribute('title', 'Shuffle on')
  })

  it('calls onClick handler when clicked', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()

    render(<ShuffleButton isActive={false} onClick={handleClick} />)

    const button = screen.getByRole('button')
    await user.click(button)

    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('has accessible aria-label', () => {
    render(<ShuffleButton isActive={false} onClick={() => {}} />)

    const button = screen.getByRole('button', { name: /shuffle/i })
    expect(button).toBeInTheDocument()
  })

  it('supports keyboard activation', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()

    render(<ShuffleButton isActive={false} onClick={handleClick} />)

    const button = screen.getByRole('button')
    button.focus()
    await user.keyboard('{Enter}')

    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('supports Space key activation', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()

    render(<ShuffleButton isActive={false} onClick={handleClick} />)

    const button = screen.getByRole('button')
    button.focus()
    await user.keyboard(' ')

    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('renders with small size variant', () => {
    render(<ShuffleButton isActive={false} onClick={() => {}} size="sm" />)

    const button = screen.getByRole('button')
    expect(button).toHaveClass('w-8', 'h-8')
  })

  it('renders with medium size variant', () => {
    render(<ShuffleButton isActive={false} onClick={() => {}} size="md" />)

    const button = screen.getByRole('button')
    expect(button).toHaveClass('w-10', 'h-10')
  })

  it('applies custom className', () => {
    render(
      <ShuffleButton
        isActive={false}
        onClick={() => {}}
        className="custom-class"
      />
    )

    const button = screen.getByRole('button')
    expect(button).toHaveClass('custom-class')
  })

  it('shows active indicator dot when active', () => {
    const { container } = render(
      <ShuffleButton isActive={true} onClick={() => {}} />
    )

    // The active indicator is a span with bg-accent class
    const indicator = container.querySelector('span.bg-accent')
    expect(indicator).toBeInTheDocument()
  })

  it('does not show active indicator dot when inactive', () => {
    const { container } = render(
      <ShuffleButton isActive={false} onClick={() => {}} />
    )

    // The active indicator should not exist
    const indicator = container.querySelector('span.bg-accent')
    expect(indicator).not.toBeInTheDocument()
  })
})
