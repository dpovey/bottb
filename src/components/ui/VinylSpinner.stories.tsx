import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { VinylSpinner } from './vinyl-spinner'

const meta: Meta<typeof VinylSpinner> = {
  title: 'Feedback/VinylSpinner',
  component: VinylSpinner,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Vinyl record spinner with Battle of the Tech Bands logo. Rotates at authentic 33⅓ RPM speed (1.8 seconds per rotation). Includes a soft shadow that creates a subtle blur effect underneath.',
      },
    },
  },
  argTypes: {
    size: {
      control: 'select',
      options: ['xxs', 'xs', 'sm', 'md', 'lg'],
      description: 'Size variant of the spinner',
    },
    speed: {
      control: 'number',
      description: 'Rotation speed in seconds (33⅓ RPM = 1.8s)',
    },
  },
}

export default meta
type Story = StoryObj<typeof VinylSpinner>

// Default medium size
export const Default: Story = {
  args: {
    size: 'md',
    speed: 1.8,
  },
  parameters: {
    docs: {
      description: {
        story: 'Default medium size spinner at authentic 33⅓ RPM speed.',
      },
    },
  },
}

// Extra extra small variant
export const ExtraExtraSmall: Story = {
  args: {
    size: 'xxs',
    speed: 1.8,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Extra extra small variant (16px) - for very small inline indicators.',
      },
    },
  },
}

// Extra small variant
export const ExtraSmall: Story = {
  args: {
    size: 'xs',
    speed: 1.8,
  },
  parameters: {
    docs: {
      description: {
        story: 'Extra small variant (32px) - for small inline indicators.',
      },
    },
  },
}

// Small variant
export const Small: Story = {
  args: {
    size: 'sm',
    speed: 1.8,
  },
  parameters: {
    docs: {
      description: {
        story: 'Small variant (64px) - for medium inline loading states.',
      },
    },
  },
}

// Medium variant
export const Medium: Story = {
  args: {
    size: 'md',
    speed: 1.8,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Medium variant (128px) - standard size for most loading states.',
      },
    },
  },
}

// Large variant
export const Large: Story = {
  args: {
    size: 'lg',
    speed: 1.8,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Large variant (256px) - for prominent loading states or full-page loading.',
      },
    },
  },
}

// All sizes showcase
export const AllSizes: Story = {
  render: () => (
    <div className="flex items-center gap-8">
      <div className="flex flex-col items-center gap-2">
        <VinylSpinner size="xxs" />
        <span className="text-sm text-text-muted">XXS (16px)</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <VinylSpinner size="xs" />
        <span className="text-sm text-text-muted">XS (32px)</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <VinylSpinner size="sm" />
        <span className="text-sm text-text-muted">SM (64px)</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <VinylSpinner size="md" />
        <span className="text-sm text-text-muted">MD (128px)</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <VinylSpinner size="lg" />
        <span className="text-sm text-text-muted">LG (256px)</span>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'All size variants side by side for comparison.',
      },
    },
  },
}

// Custom speed
export const CustomSpeed: Story = {
  render: () => (
    <div className="flex flex-col items-center gap-8">
      <div className="flex flex-col items-center gap-2">
        <VinylSpinner size="md" speed={0.9} />
        <span className="text-sm text-text-muted">Fast (0.9s - 66⅔ RPM)</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <VinylSpinner size="md" speed={1.8} />
        <span className="text-sm text-text-muted">Normal (1.8s - 33⅓ RPM)</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <VinylSpinner size="md" speed={3.6} />
        <span className="text-sm text-text-muted">Slow (3.6s - 16⅔ RPM)</span>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Different rotation speeds. Default is 1.8s (authentic 33⅓ RPM).',
      },
    },
  },
}

// On different backgrounds
export const OnBackgrounds: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      <div className="bg-bg p-8 rounded-lg flex items-center justify-center">
        <VinylSpinner size="md" />
      </div>
      <div className="bg-bg-elevated p-8 rounded-lg flex items-center justify-center">
        <VinylSpinner size="md" />
      </div>
      <div className="bg-bg-surface p-8 rounded-lg flex items-center justify-center">
        <VinylSpinner size="md" />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Spinner on different background colors showing the shadow effect.',
      },
    },
  },
}

// With text
export const WithText: Story = {
  render: () => (
    <div className="flex flex-col items-center gap-4">
      <VinylSpinner size="md" />
      <p className="text-text-muted">Loading...</p>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Common pattern: spinner with loading text below.',
      },
    },
  },
}
