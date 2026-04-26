import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { EventCard } from './event-card'

const meta: Meta<typeof EventCard> = {
  title: 'Features/EventCard',
  component: EventCard,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Event card with visual (4:3 aspect) and horizontal variants. Shows date badge, status, and winner information.',
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['upcoming', 'past', 'active'],
    },
    visual: {
      control: 'boolean',
    },
    showWinner: {
      control: 'boolean',
    },
  },
}

export default meta
type Story = StoryObj<typeof EventCard>

// Sample event data
const sampleEvent = {
  id: 'sydney-2025',
  name: 'Sydney Tech Battle 2025',
  date: '2025-10-23',
  location: 'The Metro Theatre, Sydney',
  timezone: 'Australia/Sydney',
  info: {
    image_url: '/images/test/band-stage.jpg',
  },
  status: 'upcoming',
}

const pastEvent = {
  ...sampleEvent,
  id: 'brisbane-2024',
  name: 'Brisbane Tech Battle 2024',
  date: '2024-09-15',
  location: 'The Fortitude Music Hall',
  timezone: 'Australia/Brisbane',
  status: 'finalized',
}

const sampleBands = [
  { id: '1', name: 'The Agentics', order: 1 },
  { id: '2', name: 'Code Rockers', order: 2 },
  { id: '3', name: 'Bandlassian', order: 3 },
  { id: '4', name: 'Byte Club', order: 4 },
]

// Visual card (default for grids)
export const VisualCard: Story = {
  args: {
    event: sampleEvent,
    relativeDate: 'in 4 months',
    variant: 'upcoming',
    visual: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Visual card style (4:3 aspect ratio) for use in grids.',
      },
    },
  },
}

// Visual card with hero photo
export const VisualWithImage: Story = {
  args: {
    event: sampleEvent,
    relativeDate: 'in 4 months',
    variant: 'upcoming',
    visual: true,
    heroPhoto: {
      blob_url: '/images/test/band-stage.jpg',
      hero_focal_point: { x: 50, y: 30 },
    },
  },
}

// Visual card - past event with winner
export const VisualPastWithWinner: Story = {
  args: {
    event: pastEvent,
    relativeDate: '3 months ago',
    variant: 'past',
    visual: true,
    showWinner: true,
    winner: { name: 'The Agentics', totalScore: 87.5 },
    heroPhoto: {
      blob_url: '/images/test/band-stage.jpg',
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Past event showing winner badge.',
      },
    },
  },
}

// Visual card - active/live event
export const VisualLiveEvent: Story = {
  args: {
    event: { ...sampleEvent, status: 'active' },
    relativeDate: 'now',
    variant: 'active',
    visual: true,
    heroPhoto: {
      blob_url: '/images/test/band-stage.jpg',
    },
  },
  parameters: {
    docs: {
      description: {
        story: 'Active/live event with live indicator.',
      },
    },
  },
}

// Horizontal card (original style)
export const HorizontalCard: Story = {
  args: {
    event: sampleEvent,
    relativeDate: 'in 4 months',
    variant: 'upcoming',
    visual: false,
    bands: sampleBands,
  },
  parameters: {
    docs: {
      description: {
        story: 'Original horizontal card style with bands list.',
      },
    },
  },
}

// Horizontal card - past with winner
export const HorizontalPastWithWinner: Story = {
  args: {
    event: pastEvent,
    relativeDate: '3 months ago',
    variant: 'past',
    visual: false,
    showWinner: true,
    winner: { name: 'The Agentics', totalScore: 87.5 },
    bands: sampleBands,
  },
}

// Horizontal card - active
export const HorizontalActive: Story = {
  args: {
    event: { ...sampleEvent, status: 'active' },
    relativeDate: 'now',
    variant: 'active',
    visual: false,
    bands: sampleBands,
  },
  parameters: {
    docs: {
      description: {
        story: 'Active event with Vote Now button.',
      },
    },
  },
}

// Grid of visual cards
export const VisualCardGrid: Story = {
  render: () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <EventCard
        event={sampleEvent}
        relativeDate="in 4 months"
        variant="upcoming"
        visual
      />
      <EventCard
        event={{
          ...sampleEvent,
          id: 'event-2',
          name: 'Melbourne Tech Battle 2025',
        }}
        relativeDate="in 6 months"
        variant="upcoming"
        visual
        heroPhoto={{ blob_url: '/images/test/crowd-energy.jpg' }}
      />
      <EventCard
        event={pastEvent}
        relativeDate="3 months ago"
        variant="past"
        visual
        showWinner
        winner={{ name: 'The Agentics' }}
        heroPhoto={{ blob_url: '/images/test/hero-concert.jpg' }}
      />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Visual cards displayed in a responsive grid.',
      },
    },
  },
}
