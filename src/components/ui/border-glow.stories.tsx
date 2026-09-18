import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { BorderGlow } from './border-glow'

const meta: Meta<typeof BorderGlow> = {
  title: 'Display/BorderGlow',
  component: BorderGlow,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'One clockwise lap of light around the parent card, run once as the card scrolls into view. Used on the National Partner card on /sponsors. Scroll the card out of view and back to re-trigger a fresh mount.',
      },
    },
  },
  argTypes: {
    radius: {
      control: { type: 'number' },
      description: 'Corner radius in px — match the parent rounded-* class',
    },
    duration: {
      control: { type: 'number' },
      description: 'Lap duration in ms',
    },
    arc: {
      control: { type: 'range', min: 0.05, max: 1, step: 0.01 },
      description: 'Fraction of the perimeter that is lit',
    },
    threshold: {
      control: { type: 'range', min: 0, max: 1, step: 0.05 },
      description: 'How much of the card must be visible before it runs',
    },
  },
  decorators: [
    (Story) => (
      <div className="bg-bg p-10">
        <div className="relative w-[480px] max-w-full overflow-hidden rounded-2xl border border-accent/20 bg-bg-elevated p-10">
          <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-transparent via-accent/50 to-transparent" />
          <Story />
          <p className="mb-2 text-xs uppercase tracking-[0.3em] text-accent">
            National Partner
          </p>
          <h2 className="text-2xl font-semibold">Jumbo Interactive</h2>
        </div>
      </div>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof BorderGlow>

export const Default: Story = {
  args: { radius: 16 },
}

export const SlowFullArc: Story = {
  args: { radius: 16, duration: 2400, arc: 0.4 },
}
