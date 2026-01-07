import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useState } from 'react'
import { DateTimePicker, SchedulePicker } from './date-time-picker'

const meta: Meta<typeof DateTimePicker> = {
  title: 'Forms/DateTimePicker',
  component: DateTimePicker,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Native datetime-local input styled for dark theme. Includes calendar icon and supports min/max constraints.',
      },
    },
  },
  argTypes: {
    value: {
      control: 'text',
      description: 'Current value as ISO string or Date',
    },
    label: {
      control: 'text',
      description: 'Label text',
    },
    helperText: {
      control: 'text',
      description: 'Helper text shown below input',
    },
    error: {
      control: 'text',
      description: 'Error message',
    },
    disabled: {
      control: 'boolean',
      description: 'Disabled state',
    },
    required: {
      control: 'boolean',
      description: 'Required field indicator',
    },
  },
  decorators: [
    (Story) => (
      <div className="w-[320px]">
        <Story />
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof DateTimePicker>

// Interactive wrapper
function InteractiveDateTimePicker(
  props: Omit<React.ComponentProps<typeof DateTimePicker>, 'value' | 'onChange'>
) {
  const [value, setValue] = useState<string | null>(null)
  return <DateTimePicker {...props} value={value} onChange={setValue} />
}

// Default empty state
export const Default: Story = {
  render: () => (
    <InteractiveDateTimePicker
      label="Date & Time"
      helperText="Select a date and time"
    />
  ),
}

// With value
export const WithValue: Story = {
  render: () => {
    const [value, setValue] = useState<string | null>(
      new Date(2026, 5, 15, 14, 30).toISOString()
    )
    return (
      <DateTimePicker
        label="Event Date"
        value={value}
        onChange={setValue}
        helperText="When should this be published?"
      />
    )
  },
  parameters: {
    docs: {
      description: {
        story: 'Pre-filled with a specific date and time.',
      },
    },
  },
}

// With min date (scheduling)
export const SchedulingUseCase: Story = {
  render: () => (
    <InteractiveDateTimePicker
      label="Schedule For"
      min={new Date().toISOString()}
      helperText="Must be in the future"
    />
  ),
  parameters: {
    docs: {
      description: {
        story: 'Common use case for scheduling - minimum date is set to now.',
      },
    },
  },
}

// With min and max
export const WithMinMax: Story = {
  render: () => {
    const now = new Date()
    const maxDate = new Date(now)
    maxDate.setMonth(maxDate.getMonth() + 6)

    return (
      <InteractiveDateTimePicker
        label="Event Date"
        min={now.toISOString()}
        max={maxDate.toISOString()}
        helperText="Must be within the next 6 months"
      />
    )
  },
  parameters: {
    docs: {
      description: {
        story: 'Constrained to a date range (now to 6 months from now).',
      },
    },
  },
}

// Required field
export const Required: Story = {
  render: () => (
    <InteractiveDateTimePicker
      label="Publication Date"
      required
      helperText="When should this go live?"
    />
  ),
  parameters: {
    docs: {
      description: {
        story: 'Shows required indicator (*) after label.',
      },
    },
  },
}

// With error
export const WithError: Story = {
  render: () => (
    <InteractiveDateTimePicker
      label="Scheduled Time"
      error="Scheduled time must be at least 10 minutes in the future"
    />
  ),
  parameters: {
    docs: {
      description: {
        story: 'Error state with validation message.',
      },
    },
  },
}

// Disabled
export const Disabled: Story = {
  render: () => {
    const [value] = useState<string | null>(
      new Date(2026, 0, 15, 10, 0).toISOString()
    )
    return (
      <DateTimePicker
        label="Locked Date"
        value={value}
        onChange={() => {}}
        disabled
        helperText="This date cannot be changed"
      />
    )
  },
  parameters: {
    docs: {
      description: {
        story: 'Disabled state with a pre-filled value.',
      },
    },
  },
}

// No label
export const NoLabel: Story = {
  render: () => <InteractiveDateTimePicker helperText="Pick a date and time" />,
}

// SchedulePicker stories
export const SchedulePickerDefault: Story = {
  render: () => {
    const [enabled, setEnabled] = useState(false)
    const [value, setValue] = useState<string | null>(null)

    return (
      <SchedulePicker
        enabled={enabled}
        onEnabledChange={setEnabled}
        value={value}
        onChange={setValue}
        toggleLabel="Schedule for later"
        helperText="Post will be published at the scheduled time"
      />
    )
  },
  parameters: {
    docs: {
      description: {
        story:
          'SchedulePicker combines a toggle switch with DateTimePicker. When disabled, the datetime input is hidden.',
      },
    },
  },
}

export const SchedulePickerEnabled: Story = {
  render: () => {
    const [enabled, setEnabled] = useState(true)
    const [value, setValue] = useState<string | null>(
      new Date(2026, 0, 20, 9, 0).toISOString()
    )

    return (
      <SchedulePicker
        enabled={enabled}
        onEnabledChange={setEnabled}
        value={value}
        onChange={setValue}
        toggleLabel="Schedule for later"
        helperText="Post will be published at the scheduled time"
      />
    )
  },
  parameters: {
    docs: {
      description: {
        story: 'SchedulePicker with scheduling enabled and a date selected.',
      },
    },
  },
}
