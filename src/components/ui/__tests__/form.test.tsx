import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Checkbox, Combobox, Input, Range, Select } from '../form'

describe('Combobox', () => {
  it('offers each option as a datalist suggestion', () => {
    render(
      <Combobox
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
      <Combobox
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
      <Combobox
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
        <Combobox aria-label="First" readOnly value="" options={['a']} />
        <Combobox aria-label="Second" readOnly value="" options={['b']} />
      </>
    )

    expect(screen.getByLabelText('First').getAttribute('list')).not.toBe(
      screen.getByLabelText('Second').getAttribute('list')
    )
  })
})

describe('Checkbox', () => {
  it('toggles via its label text', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Checkbox label="Safe zones" checked={false} onChange={onChange} />)

    await user.click(screen.getByText('Safe zones'))
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('exposes the label to assistive tech', () => {
    render(<Checkbox label="Safe zones" checked readOnly />)
    expect(screen.getByRole('checkbox', { name: 'Safe zones' })).toBeChecked()
  })
})

describe('Range', () => {
  it('renders a slider with its bounds', () => {
    render(
      <Range aria-label="Scrub video" min={0} max={10} readOnly value={3} />
    )

    const slider = screen.getByRole('slider', { name: 'Scrub video' })
    expect(slider).toHaveAttribute('min', '0')
    expect(slider).toHaveAttribute('max', '10')
  })
})

describe('shared field styling', () => {
  it('uses the canonical surface and border from DESIGN.md', () => {
    render(<Input aria-label="Name" readOnly value="" />)
    const input = screen.getByLabelText('Name')
    expect(input.className).toContain('bg-bg')
    expect(input.className).toContain('border-white/10')
    expect(input.className).toContain('focus:border-accent')
  })

  it('applies the error border instead of the accent one', () => {
    render(<Input aria-label="Name" hasError readOnly value="" />)
    const input = screen.getByLabelText('Name')
    expect(input.className).toContain('border-error')
    expect(input.className).not.toContain('focus:border-accent')
  })

  it('sizes inputs and selects identically', () => {
    render(
      <>
        <Input aria-label="A" size="sm" readOnly value="" />
        <Select aria-label="B" size="sm" value="" onChange={() => {}}>
          <option value="" />
        </Select>
      </>
    )
    expect(screen.getByLabelText('A').className).toContain('py-1.5')
    expect(screen.getByLabelText('B').className).toContain('py-1.5')
  })
})
