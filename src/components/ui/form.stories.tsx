import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import {
  Checkbox,
  Combobox,
  FormField,
  Input,
  Range,
  Select,
  Textarea,
} from './form'

const meta: Meta<typeof Input> = {
  title: 'Forms/Form Controls',
  component: Input,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'The app-wide form primitives, used by public pages and admin alike. Styling follows the "Form Inputs" spec in DESIGN.md. Density is a `size` prop (`md` by default, `sm` for dense table toolbars) rather than a separate set of components.',
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof Input>

/** The full set at the default density. */
export const AllControls: Story = {
  render: function Render() {
    const [text, setText] = useState('')
    const [choice, setChoice] = useState('')
    const [notes, setNotes] = useState('')
    const [checked, setChecked] = useState(true)
    const [level, setLevel] = useState(35)
    return (
      <div className="max-w-sm space-y-6">
        <FormField label="Band name" helperText="As it should appear on air.">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. The Null Pointers"
          />
        </FormField>
        <FormField label="Event">
          <Select value={choice} onChange={(e) => setChoice(e.target.value)}>
            <option value="">— Select an event —</option>
            <option value="bne">Brisbane 2026</option>
            <option value="syd">Sydney 2025</option>
          </Select>
        </FormField>
        <FormField label="Notes">
          <Textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything the crew should know"
          />
        </FormField>
        <Checkbox
          label="Safe zones"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
        />
        <Range
          aria-label="Scrub video"
          min={0}
          max={100}
          value={level}
          onChange={(e) => setLevel(Number(e.target.value))}
        />
      </div>
    )
  },
}

/**
 * A combobox suggests known values but always accepts free text — use it where
 * a `<select>` would be too strict.
 */
export const ComboboxWithHints: Story = {
  render: function Render() {
    const [song, setSong] = useState('')
    return (
      <div className="max-w-sm">
        <FormField
          label="Song title"
          helperText="Pick from the setlist, or type any title."
        >
          <Combobox
            value={song}
            onChange={(e) => setSong(e.target.value)}
            placeholder="e.g. Stairway to Production"
            options={[
              { value: 'Everlong', label: 'Foo Fighters' },
              { value: 'Mr. Brightside', label: 'The Killers' },
              { value: 'Take Me Out', label: 'Franz Ferdinand' },
            ]}
          />
        </FormField>
      </div>
    )
  },
}

/** `size="sm"` for the dense toolbars above admin tables. */
export const Dense: Story = {
  render: function Render() {
    const [text, setText] = useState('')
    return (
      <div className="flex max-w-xl flex-wrap items-center gap-2">
        <Input
          size="sm"
          className="sm:w-40"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Photographer…"
          aria-label="Photographer"
        />
        <Select
          size="sm"
          className="sm:w-40"
          defaultValue=""
          aria-label="Event"
        >
          <option value="">All events</option>
          <option value="bne">Brisbane 2026</option>
        </Select>
      </div>
    )
  },
}

/** Validation state. */
export const WithError: Story = {
  render: function Render() {
    return (
      <div className="max-w-sm">
        <FormField
          label="Email"
          required
          error="That address looks incomplete."
        >
          <Input hasError defaultValue="dean@" />
        </FormField>
      </div>
    )
  },
}
