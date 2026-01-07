import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { DateTimePicker, SchedulePicker } from '../date-time-picker'

// Helper to get the datetime-local input (doesn't have standard role)
function getDateTimeInput(): HTMLInputElement {
  return document.querySelector(
    'input[type="datetime-local"]'
  ) as HTMLInputElement
}

describe('DateTimePicker', () => {
  describe('Rendering', () => {
    it('renders with label', () => {
      render(
        <DateTimePicker value={null} onChange={() => {}} label="Select Date" />
      )

      expect(screen.getByText('Select Date')).toBeInTheDocument()
    })

    it('renders required indicator when required', () => {
      render(
        <DateTimePicker
          value={null}
          onChange={() => {}}
          label="Event Date"
          required
        />
      )

      expect(screen.getByText('*')).toBeInTheDocument()
    })

    it('renders helper text', () => {
      render(
        <DateTimePicker
          value={null}
          onChange={() => {}}
          helperText="Select a future date"
        />
      )

      expect(screen.getByText('Select a future date')).toBeInTheDocument()
    })

    it('renders error message instead of helper text when error is present', () => {
      render(
        <DateTimePicker
          value={null}
          onChange={() => {}}
          helperText="Select a future date"
          error="Date is required"
        />
      )

      expect(screen.getByText('Date is required')).toBeInTheDocument()
      expect(screen.queryByText('Select a future date')).not.toBeInTheDocument()
    })
  })

  describe('Value handling', () => {
    it('displays empty when value is null', () => {
      render(<DateTimePicker value={null} onChange={() => {}} />)

      const input = getDateTimeInput()
      expect(input).toBeInTheDocument()
      expect(input.value).toBe('')
    })

    it('displays formatted date when value is provided', () => {
      // Create a specific date: Jan 15, 2026 at 2:30 PM
      const testDate = new Date(2026, 0, 15, 14, 30)

      render(
        <DateTimePicker value={testDate.toISOString()} onChange={() => {}} />
      )

      const input = getDateTimeInput()
      // datetime-local format is YYYY-MM-DDTHH:mm
      expect(input.value).toBe('2026-01-15T14:30')
    })

    it('accepts Date object as value', () => {
      const testDate = new Date(2026, 5, 20, 9, 0)

      render(<DateTimePicker value={testDate} onChange={() => {}} />)

      const input = getDateTimeInput()
      expect(input.value).toBe('2026-06-20T09:00')
    })

    it('calls onChange when date input changes', async () => {
      const user = userEvent.setup()
      const handleChange = vi.fn()

      render(<DateTimePicker value={null} onChange={handleChange} />)

      const input = getDateTimeInput()
      // Type a date value
      await user.type(input, '2026-03-15T10:30')

      expect(handleChange).toHaveBeenCalled()
    })

    it('calls onChange with null when input is cleared', async () => {
      const user = userEvent.setup()
      const handleChange = vi.fn()
      const testDate = new Date(2026, 0, 15, 14, 30)

      render(
        <DateTimePicker
          value={testDate.toISOString()}
          onChange={handleChange}
        />
      )

      const input = getDateTimeInput()
      await user.clear(input)

      expect(handleChange).toHaveBeenCalledWith(null)
    })
  })

  describe('Constraints', () => {
    it('applies min attribute to input', () => {
      const minDate = new Date(2026, 0, 1, 0, 0)

      render(
        <DateTimePicker
          value={null}
          onChange={() => {}}
          min={minDate.toISOString()}
        />
      )

      const input = getDateTimeInput()
      expect(input).toHaveAttribute('min', '2026-01-01T00:00')
    })

    it('applies max attribute to input', () => {
      const maxDate = new Date(2026, 11, 31, 23, 59)

      render(
        <DateTimePicker
          value={null}
          onChange={() => {}}
          max={maxDate.toISOString()}
        />
      )

      const input = getDateTimeInput()
      expect(input).toHaveAttribute('max', '2026-12-31T23:59')
    })
  })

  describe('Disabled state', () => {
    it('disables input when disabled prop is true', () => {
      render(<DateTimePicker value={null} onChange={() => {}} disabled />)

      const input = getDateTimeInput()
      expect(input).toBeDisabled()
    })
  })

  describe('Accessibility', () => {
    it('associates label with input via htmlFor', () => {
      render(
        <DateTimePicker value={null} onChange={() => {}} label="Event Date" />
      )

      const input = getDateTimeInput()
      const label = screen.getByText('Event Date')

      expect(input).toHaveAttribute('id')
      expect(label).toHaveAttribute('for', input.id)
    })
  })
})

describe('SchedulePicker', () => {
  describe('Toggle behavior', () => {
    it('hides datetime picker when disabled', () => {
      render(
        <SchedulePicker
          enabled={false}
          onEnabledChange={() => {}}
          value={null}
          onChange={() => {}}
        />
      )

      expect(getDateTimeInput()).toBeNull()
    })

    it('shows datetime picker when enabled', () => {
      render(
        <SchedulePicker
          enabled={true}
          onEnabledChange={() => {}}
          value={null}
          onChange={() => {}}
        />
      )

      expect(getDateTimeInput()).toBeInTheDocument()
    })

    it('calls onEnabledChange when toggle is clicked', async () => {
      const user = userEvent.setup()
      const handleEnabledChange = vi.fn()

      render(
        <SchedulePicker
          enabled={false}
          onEnabledChange={handleEnabledChange}
          value={null}
          onChange={() => {}}
          toggleLabel="Schedule for later"
        />
      )

      const toggle = screen.getByRole('button')
      await user.click(toggle)

      expect(handleEnabledChange).toHaveBeenCalledWith(true)
    })

    it('clears value when disabled', async () => {
      const user = userEvent.setup()
      const handleChange = vi.fn()

      render(
        <SchedulePicker
          enabled={true}
          onEnabledChange={() => {}}
          value={new Date().toISOString()}
          onChange={handleChange}
          toggleLabel="Schedule for later"
        />
      )

      // Disable scheduling
      const toggle = screen.getByRole('button')
      await user.click(toggle)

      expect(handleChange).toHaveBeenCalledWith(null)
    })
  })

  describe('Rendering', () => {
    it('renders toggle label', () => {
      render(
        <SchedulePicker
          enabled={false}
          onEnabledChange={() => {}}
          value={null}
          onChange={() => {}}
          toggleLabel="Schedule for later"
        />
      )

      expect(screen.getByText('Schedule for later')).toBeInTheDocument()
    })

    it('passes helperText to DateTimePicker when enabled', () => {
      render(
        <SchedulePicker
          enabled={true}
          onEnabledChange={() => {}}
          value={null}
          onChange={() => {}}
          helperText="Post will be published at this time"
        />
      )

      expect(
        screen.getByText('Post will be published at this time')
      ).toBeInTheDocument()
    })
  })

  describe('Min date constraint', () => {
    it('sets min to current date by default when enabled', () => {
      render(
        <SchedulePicker
          enabled={true}
          onEnabledChange={() => {}}
          value={null}
          onChange={() => {}}
        />
      )

      const input = getDateTimeInput()
      expect(input).toHaveAttribute('min')
    })
  })
})
