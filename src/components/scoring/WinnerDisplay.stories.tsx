import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { WinnerDisplay } from './WinnerDisplay'

const meta: Meta<typeof WinnerDisplay> = {
  title: 'Features/WinnerDisplay',
  component: WinnerDisplay,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Winner display card with trophy, glow effect, and optional hero image background.',
      },
    },
  },
  argTypes: {
    scoringVersion: {
      control: 'select',
      options: ['2022.1', '2025.1', '2026.1'],
      description: 'Scoring version determines display style',
    },
    winnerName: { control: 'text' },
    totalScore: { control: 'number' },
  },
}

export default meta
type Story = StoryObj<typeof WinnerDisplay>

// Default (2025.1 with score)
export const Default: Story = {
  args: {
    winnerName: 'The Agentics',
    companySlug: 'salesforce',
    companyName: 'Salesforce',
    totalScore: 87.5,
    scoringVersion: '2025.1',
  },
  parameters: {
    docs: {
      description: {
        story: 'Standard winner display with score breakdown.',
      },
    },
  },
}

// With hero image
export const WithHeroImage: Story = {
  args: {
    winnerName: 'Code Rockers',
    companySlug: 'google',
    companyName: 'Google',
    totalScore: 92.3,
    scoringVersion: '2025.1',
    heroThumbnailUrl: '/images/test/hero-concert.jpg',
    heroFocalPoint: { x: 50, y: 30 },
  },
  parameters: {
    docs: {
      description: {
        story: 'Winner card with hero image as background.',
      },
    },
  },
}

// With logo
export const WithLogo: Story = {
  args: {
    winnerName: 'Bandlassian',
    companySlug: 'atlassian',
    companyName: 'Atlassian',
    totalScore: 89.1,
    scoringVersion: '2025.1',
    logoUrl: '/images/test/thumbnail-1.jpg',
  },
  parameters: {
    docs: {
      description: {
        story: 'Winner card with band logo.',
      },
    },
  },
}

// Legacy 2022.1 (no score breakdown)
export const LegacyWinnerOnly: Story = {
  args: {
    winnerName: 'The Agentics',
    company: 'Salesforce',
    scoringVersion: '2022.1',
    eventName: 'Brisbane Tech Battle 2022',
    eventDate: 'September 15, 2022',
    eventLocation: 'The Fortitude Music Hall',
  },
  parameters: {
    docs: {
      description: {
        story: 'Legacy 2022.1 scoring - winner only, no detailed breakdown.',
      },
    },
  },
}

// 2026.1 (with visuals category)
export const With2026Scoring: Story = {
  args: {
    winnerName: 'Byte Club',
    companySlug: 'microsoft',
    companyName: 'Microsoft',
    totalScore: 94.7,
    scoringVersion: '2026.1',
    heroThumbnailUrl: '/images/test/hero-concert.jpg',
  },
  parameters: {
    docs: {
      description: {
        story: '2026.1 scoring includes visuals category.',
      },
    },
  },
}

// Full example with all props
export const FullExample: Story = {
  args: {
    winnerName: 'The Agentics',
    companySlug: 'salesforce',
    companyName: 'Salesforce',
    companyIconUrl: '/images/test/thumbnail-2.jpg',
    totalScore: 91.8,
    logoUrl: '/images/test/thumbnail-1.jpg',
    heroThumbnailUrl: '/images/test/hero-concert.jpg',
    heroFocalPoint: { x: 60, y: 40 },
    scoringVersion: '2025.1',
  },
  parameters: {
    docs: {
      description: {
        story: 'Winner display with all optional props enabled.',
      },
    },
  },
}

// Score comparison
export const ScoreComparison: Story = {
  render: () => (
    <div className="space-y-8">
      <WinnerDisplay
        winnerName="High Score"
        companyName="Company A"
        totalScore={95.0}
        scoringVersion="2025.1"
      />
      <WinnerDisplay
        winnerName="Medium Score"
        companyName="Company B"
        totalScore={82.5}
        scoringVersion="2025.1"
      />
      <WinnerDisplay
        winnerName="Lower Score"
        companyName="Company C"
        totalScore={71.2}
        scoringVersion="2025.1"
      />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Comparison of different score displays.',
      },
    },
  },
}
