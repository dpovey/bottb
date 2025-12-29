import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { ScoreBreakdown, BandResultData } from './ScoreBreakdown'

const meta: Meta<typeof ScoreBreakdown> = {
  title: 'Features/ScoreBreakdown',
  component: ScoreBreakdown,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Complete results table showing all bands with detailed score breakdown by category.',
      },
    },
  },
  argTypes: {
    scoringVersion: {
      control: 'select',
      options: ['2022.1', '2025.1', '2026.1'],
      description: 'Scoring version determines which columns are shown',
    },
    totalVoters: {
      control: 'number',
      description: 'Total number of crowd voters',
    },
  },
}

export default meta
type Story = StoryObj<typeof ScoreBreakdown>

// Sample results data
const sample2025Results: BandResultData[] = [
  {
    id: '1',
    name: 'The Agentics',
    companySlug: 'salesforce',
    companyName: 'Salesforce',
    rank: 1,
    songChoice: 9.2,
    performance: 9.5,
    crowdVibe: 9.0,
    crowdVote: 450,
    crowdVoteCount: 45,
    screamOMeter: 92,
    totalScore: 87.5,
  },
  {
    id: '2',
    name: 'Code Rockers',
    companySlug: 'google',
    companyName: 'Google',
    rank: 2,
    songChoice: 9.0,
    performance: 9.2,
    crowdVibe: 8.8,
    crowdVote: 380,
    crowdVoteCount: 38,
    screamOMeter: 88,
    totalScore: 82.1,
  },
  {
    id: '3',
    name: 'Bandlassian',
    companySlug: 'atlassian',
    companyName: 'Atlassian',
    rank: 3,
    songChoice: 8.8,
    performance: 8.9,
    crowdVibe: 8.5,
    crowdVote: 320,
    crowdVoteCount: 32,
    screamOMeter: 85,
    totalScore: 78.4,
  },
  {
    id: '4',
    name: 'Byte Club',
    companySlug: 'microsoft',
    companyName: 'Microsoft',
    rank: 4,
    songChoice: 8.5,
    performance: 8.7,
    crowdVibe: 8.2,
    crowdVote: 280,
    crowdVoteCount: 28,
    screamOMeter: 80,
    totalScore: 74.2,
  },
]

const sample2026Results: BandResultData[] = sample2025Results.map(
  (band, i) => ({
    ...band,
    screamOMeter: undefined,
    visuals: [9.2, 8.8, 9.5, 8.3][i] ?? 8.5, // Static values per band
  })
)

// 2025.1 scoring (with scream-o-meter)
export const Scoring2025: Story = {
  args: {
    scoringVersion: '2025.1',
    results: sample2025Results,
    totalVoters: 143,
  },
  parameters: {
    docs: {
      description: {
        story:
          '2025.1 scoring includes Song Choice, Performance, Crowd Vibe, Crowd Vote, and Scream-o-meter.',
      },
    },
  },
}

// 2026.1 scoring (with visuals)
export const Scoring2026: Story = {
  args: {
    scoringVersion: '2026.1',
    results: sample2026Results,
    totalVoters: 189,
  },
  parameters: {
    docs: {
      description: {
        story: '2026.1 scoring replaces Scream-o-meter with Visuals category.',
      },
    },
  },
}

// Legacy 2022.1 (no detailed breakdown - returns null)
export const Scoring2022: Story = {
  args: {
    scoringVersion: '2022.1',
    results: sample2025Results,
    totalVoters: 98,
  },
  parameters: {
    docs: {
      description: {
        story:
          '2022.1 scoring has no detailed breakdown - component returns null.',
      },
    },
  },
}

// With band logos
export const WithBandLogos: Story = {
  args: {
    scoringVersion: '2025.1',
    results: sample2025Results.map((band, i) => ({
      ...band,
      logoUrl:
        i % 2 === 0
          ? '/images/test/thumbnail-1.jpg'
          : '/images/test/thumbnail-2.jpg',
    })),
    totalVoters: 143,
  },
  parameters: {
    docs: {
      description: {
        story: 'Results table with band logo thumbnails.',
      },
    },
  },
}

// With hero thumbnails
export const WithHeroThumbnails: Story = {
  args: {
    scoringVersion: '2025.1',
    results: sample2025Results.map((band, i) => ({
      ...band,
      heroThumbnailUrl:
        i % 2 === 0
          ? '/images/test/band-stage.jpg'
          : '/images/test/crowd-energy.jpg',
    })),
    totalVoters: 143,
  },
  parameters: {
    docs: {
      description: {
        story: 'Results table with hero image thumbnails as fallback.',
      },
    },
  },
}

// Many bands
export const ManyBands: Story = {
  args: {
    scoringVersion: '2025.1',
    results: [
      ...sample2025Results,
      {
        id: '5',
        name: 'Devcade',
        companyName: 'Apple',
        rank: 5,
        songChoice: 8.2,
        performance: 8.4,
        crowdVibe: 8.0,
        crowdVote: 240,
        crowdVoteCount: 24,
        screamOMeter: 75,
        totalScore: 70.8,
      },
      {
        id: '6',
        name: 'Syntax Error',
        companyName: 'Meta',
        rank: 6,
        songChoice: 8.0,
        performance: 8.1,
        crowdVibe: 7.8,
        crowdVote: 200,
        crowdVoteCount: 20,
        screamOMeter: 72,
        totalScore: 67.5,
      },
      {
        id: '7',
        name: 'Null Pointers',
        companyName: 'Amazon',
        rank: 7,
        songChoice: 7.8,
        performance: 7.9,
        crowdVibe: 7.5,
        crowdVote: 180,
        crowdVoteCount: 18,
        screamOMeter: 68,
        totalScore: 64.2,
      },
      {
        id: '8',
        name: 'Stack Overflow',
        companyName: 'Netflix',
        rank: 8,
        songChoice: 7.5,
        performance: 7.6,
        crowdVibe: 7.2,
        crowdVote: 160,
        crowdVoteCount: 16,
        screamOMeter: 65,
        totalScore: 61.0,
      },
    ],
    totalVoters: 215,
  },
  parameters: {
    docs: {
      description: {
        story: 'Results table with 8 bands.',
      },
    },
  },
}
