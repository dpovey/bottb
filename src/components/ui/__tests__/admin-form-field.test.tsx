import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { AdminCheckbox, AdminCombobox, AdminRange } from '../admin-form-field'

describe('AdminCombobox', () => {
  it('offers each option as a datalist suggestion', () => {
    render(
      <AdminCombobox
        aria-label="Song title"
        readOnly
        value=""
        options={['Everlong', 'Mr. Brightside']}
      />
    )

    const input = screen.getByLabelText('Song title')
    const listId = input.getAttribute('list')
    expect(listId).toBeTruthy()

    const list = document.getElementById(listId!)
    expect(list?.tagName).toBe('DATALIST')
    expect(
      Array.from(list!.querySelectorAll('option')).map((o) => o.value)
    ).toEqual(['Everlong', 'Mr. Brightside'])
  })

  it('shows the label beside a suggestion as a hint', () => {
    render(
      <AdminCombobox
        aria-label="Song title"
        readOnly
        value=""
        options={[{ value: 'Everlong', label: 'Foo Fighters' }]}
      />
    )

    const listId = screen.getByLabelText('Song title').getAttribute('list')
    const option = document.getElementById(listId!)!.querySelector('option')
    expect(option).toHaveAttribute('label', 'Foo Fighters')
  })

  it('still accepts free text that is not among the options', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <AdminCombobox
        aria-label="Song title"
        value=""
        onChange={onChange}
        options={['Everlong']}
      />
    )

    await user.type(screen.getByLabelText('Song title'), 'B')
    expect(onChange).toHaveBeenCalled()
  })

  it('gives each instance its own datalist so ids do not collide', () => {
    render(
      <>
        <AdminCombobox aria-label="First" readOnly value="" options={['a']} />
        <AdminCombobox aria-label="Second" readOnly value="" options={['b']} />
      </>
    )

    const first = screen.getByLabelText('First').getAttribute('list')
    const second = screen.getByLabelText('Second').getAttribute('list')
    expect(first).not.toBe(second)
  })
})

describe('AdminCheckbox', () => {
  it('toggles via its label text', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <AdminCheckbox label="Safe zones" checked={false} onChange={onChange} />
    )

    await user.click(screen.getByText('Safe zones'))
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('exposes the label to assistive tech', () => {
    render(<AdminCheckbox label="Safe zones" checked readOnly />)
    expect(screen.getByRole('checkbox', { name: 'Safe zones' })).toBeChecked()
  })
})

describe('AdminRange', () => {
  it('renders a slider with its bounds', () => {
    render(
      <AdminRange
        aria-label="Scrub video"
        min={0}
        max={10}
        readOnly
        value={3}
      />
    )

    const slider = screen.getByRole('slider', { name: 'Scrub video' })
    expect(slider).toHaveAttribute('min', '0')
    expect(slider).toHaveAttribute('max', '10')
  })
})
