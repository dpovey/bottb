import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { SponsorBadge } from './sponsor-badge'

const meta: Meta<typeof SponsorBadge> = {
  title: 'Display/SponsorBadge',
  component: SponsorBadge,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '"Powered by" sponsor badge used on the homepage and event pages to surface the National Partner. Rendered as a full-width section.',
      },
    },
  },
  argTypes: {
    name: { control: 'text', description: 'Sponsor display name (alt text)' },
    logoUrl: { control: 'text', description: 'URL to the sponsor logo image' },
    link: { control: 'text', description: 'Link destination' },
    label: { control: 'text', description: 'Tagline above the logo' },
    external: {
      control: 'boolean',
      description: 'Open link in new tab',
    },
  },
}

export default meta
type Story = StoryObj<typeof SponsorBadge>

export const JumboInteractive: Story = {
  args: {
    name: 'Jumbo Interactive',
    logoUrl:
      'https://0qipqwe5exqqyona.public.blob.vercel-storage.com/companies/jumbo-interactive/logo.svg?v=1765880740505',
  },
}

export const CustomLabel: Story = {
  args: {
    name: 'Jumbo Interactive',
    logoUrl:
      'https://0qipqwe5exqqyona.public.blob.vercel-storage.com/companies/jumbo-interactive/logo.svg?v=1765880740505',
    label: 'Proudly sponsored by',
  },
}

export const ExternalLink: Story = {
  args: {
    name: 'Jumbo Interactive',
    logoUrl:
      'https://0qipqwe5exqqyona.public.blob.vercel-storage.com/companies/jumbo-interactive/logo.svg?v=1765880740505',
    link: 'https://www.jumbointeractive.com',
    external: true,
  },
}
