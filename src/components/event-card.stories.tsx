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
          'Event card with two layouts: `tile` (square 4:3 with image background, for grids) and `horizontal` (wider row with date / content / side image, for the featured next event). Shows date badge, status, and winner information.',
      },
    },
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['upcoming', 'past', 'active'],
    },
    layout: {
      control: 'select',
      options: ['horizontal', 'tile'],
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
  {
    id: '1',
    name: 'The Agentics',
    order: 1,
    company_slug: 'seek',
    company_name: 'SEEK',
  },
  {
    id: '2',
    name: 'Code Rockers',
    order: 2,
    company_slug: 'rea-group',
    company_name: 'REA Group',
  },
  {
    id: '3',
    name: 'Bandlassian',
    order: 3,
    company_slug: 'atlassian',
    company_name: 'Atlassian',
  },
  {
    id: '4',
    name: 'Byte Club',
    order: 4,
    company_slug: 'canva',
    company_name: 'Canva',
  },
]

// Tile card (used in grids of multiple events)
export const TileCard: Story = {
  args: {
    event: sampleEvent,
    relativeDate: 'in 4 months',
    variant: 'upcoming',
    layout: 'tile',
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
    layout: 'tile',
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
    layout: 'tile',
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
    layout: 'tile',
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
    layout: 'horizontal',
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
    layout: 'horizontal',
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
    layout: 'horizontal',
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

// Grid of tile cards
export const TileGrid: Story = {
  render: () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <EventCard
        event={sampleEvent}
        relativeDate="in 4 months"
        variant="upcoming"
        layout="tile"
      />
      <EventCard
        event={{
          ...sampleEvent,
          id: 'event-2',
          name: 'Melbourne Tech Battle 2025',
        }}
        relativeDate="in 6 months"
        variant="upcoming"
        layout="tile"
        heroPhoto={{ blob_url: '/images/test/crowd-energy.jpg' }}
      />
      <EventCard
        event={pastEvent}
        relativeDate="3 months ago"
        variant="past"
        layout="tile"
        showWinner
        winner={{ name: 'The Agentics' }}
        heroPhoto={{ blob_url: '/images/test/hero-concert.jpg' }}
      />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Tile cards displayed in a responsive grid.',
      },
    },
  },
}
