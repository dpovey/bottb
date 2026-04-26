import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { BandThumbnail } from './band-thumbnail'

const meta: Meta<typeof BandThumbnail> = {
  title: 'Layout/BandThumbnail',
  component: BandThumbnail,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Band thumbnail with logo, hero image fallback, or initials placeholder.',
      },
    },
  },
  argTypes: {
    bandName: {
      control: 'text',
      description: 'Band name (used for alt text and initials fallback)',
    },
    logoUrl: {
      control: 'text',
      description: 'URL to the band logo image',
    },
    heroThumbnailUrl: {
      control: 'text',
      description: 'URL to the hero image thumbnail (fallback)',
    },
    size: {
      control: 'select',
      options: ['xs', 'sm', 'md', 'lg', 'xl', 'xxl', 'hero'],
      description: 'Size variant',
    },
  },
}

export default meta
type Story = StoryObj<typeof BandThumbnail>

// Default with initials
export const Default: Story = {
  args: {
    bandName: 'The Agentics',
    size: 'md',
  },
  parameters: {
    docs: {
      description: {
        story: 'When no image is available, displays initials.',
      },
    },
  },
}

// With logo
export const WithLogo: Story = {
  args: {
    bandName: 'Code Rockers',
    logoUrl: '/images/test/thumbnail-1.jpg',
    size: 'lg',
  },
  parameters: {
    docs: {
      description: {
        story: 'Band logo is displayed when available.',
      },
    },
  },
}

// With hero image fallback
export const WithHeroFallback: Story = {
  args: {
    bandName: 'Bandlassian',
    heroThumbnailUrl: '/images/test/thumbnail-2.jpg',
    size: 'lg',
  },
  parameters: {
    docs: {
      description: {
        story: 'Hero image is used when no logo is available.',
      },
    },
  },
}

// Size variants
export const AllSizes: Story = {
  render: () => (
    <div className="flex items-end gap-4">
      <BandThumbnail bandName="XS" size="xs" />
      <BandThumbnail bandName="SM" size="sm" />
      <BandThumbnail bandName="MD" size="md" />
      <BandThumbnail bandName="LG" size="lg" />
      <BandThumbnail bandName="XL" size="xl" />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'All available sizes from xs to xl.',
      },
    },
  },
}

// Hero size (for band page header)
export const HeroSize: Story = {
  args: {
    bandName: 'The Agentics',
    size: 'hero',
  },
  parameters: {
    docs: {
      description: {
        story: 'Large hero size for band page headers.',
      },
    },
  },
}

// XXL size
export const XXLSize: Story = {
  args: {
    bandName: 'Code Rockers',
    size: 'xxl',
  },
}

// Different band names showing initials
export const InitialsExamples: Story = {
  render: () => (
    <div className="flex gap-4">
      <BandThumbnail bandName="The Agentics" size="lg" />
      <BandThumbnail bandName="Code Rockers" size="lg" />
      <BandThumbnail bandName="Bandlassian" size="lg" />
      <BandThumbnail bandName="Single" size="lg" />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Initials are generated from band name (first letter of each word, max 2).',
      },
    },
  },
}

// List item example
export const ListItemExample: Story = {
  render: () => (
    <div className="space-y-4 max-w-md">
      {['The Agentics', 'Code Rockers', 'Bandlassian'].map((name) => (
        <div key={name} className="flex items-center gap-4">
          <BandThumbnail bandName={name} size="md" />
          <div>
            <p className="font-medium text-white">{name}</p>
            <p className="text-sm text-text-muted">Company Name</p>
          </div>
        </div>
      ))}
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Typical usage in a band list.',
      },
    },
  },
}
