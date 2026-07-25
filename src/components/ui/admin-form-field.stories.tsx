import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import {
  AdminCheckbox,
  AdminCombobox,
  AdminFormField,
  AdminRange,
} from './admin-form-field'

const meta: Meta<typeof AdminCombobox> = {
  title: 'Forms/AdminCombobox',
  component: AdminCombobox,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'A text input backed by a native `<datalist>`: it suggests known values but always accepts free text. Use it where a `<select>` would be too strict — picking a song from a band’s setlist, say, while leaving room for a title that is not in the setlist yet. Each instance generates its own datalist id, so several can share a page.',
      },
    },
  },
}

export default meta
type Story = StoryObj<typeof AdminCombobox>

const SONGS = [
  { value: 'Everlong', label: 'Foo Fighters' },
  { value: 'Mr. Brightside', label: 'The Killers' },
  { value: 'Take Me Out', label: 'Franz Ferdinand' },
]

/** Suggestions carry a hint — here, the artist behind each song. */
export const WithLabels: Story = {
  render: function Render() {
    const [song, setSong] = useState('')
    return (
      <div className="max-w-sm">
        <AdminFormField
          label="Song title"
          helperText="Pick from the setlist, or type any title."
        >
          <AdminCombobox
            value={song}
            onChange={(e) => setSong(e.target.value)}
            placeholder="e.g. Stairway to Production"
            options={SONGS}
          />
        </AdminFormField>
      </div>
    )
  },
}

/** Plain strings work when there is nothing extra to show. */
export const BareValues: Story = {
  render: function Render() {
    const [artist, setArtist] = useState('')
    return (
      <div className="max-w-sm">
        <AdminFormField label="Artist name">
          <AdminCombobox
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            placeholder="e.g. The Null Pointers"
            options={['Foo Fighters', 'Franz Ferdinand', 'The Killers']}
          />
        </AdminFormField>
      </div>
    )
  },
}

/** The other admin form controls, for comparison. */
export const CheckboxAndRange: Story = {
  render: function Render() {
    const [checked, setChecked] = useState(true)
    const [value, setValue] = useState(35)
    return (
      <div className="max-w-sm space-y-6">
        <AdminCheckbox
          label="Safe zones"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
        />
        <AdminRange
          aria-label="Scrub video"
          min={0}
          max={100}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
        />
        <AdminRange
          aria-label="Disabled"
          min={0}
          max={100}
          value={20}
          disabled
          readOnly
        />
      </div>
    )
  },
}
