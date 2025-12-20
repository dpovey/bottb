import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { TicketCTA } from "./ticket-cta";

const meta: Meta<typeof TicketCTA> = {
  title: "Layout/TicketCTA",
  component: TicketCTA,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Call-to-action button for purchasing event tickets. Supports default (card) and compact (button) variants.",
      },
    },
  },
  argTypes: {
    ticketUrl: {
      control: "text",
      description: "URL to the ticket purchase page",
    },
    eventName: {
      control: "text",
      description: "Name of the event (for personalized messaging)",
    },
    variant: {
      control: "select",
      options: ["default", "compact"],
      description: "Display variant",
    },
  },
};

export default meta;
type Story = StoryObj<typeof TicketCTA>;

// Default card variant
export const Default: Story = {
  args: {
    ticketUrl: "https://example.com/tickets",
    eventName: "Sydney Tech Battle 2025",
    variant: "default",
  },
  parameters: {
    docs: {
      description: {
        story: "Full card variant with icon, description, and Youngcare message.",
      },
    },
  },
};

// Compact button variant
export const Compact: Story = {
  args: {
    ticketUrl: "https://example.com/tickets",
    variant: "compact",
  },
  parameters: {
    docs: {
      description: {
        story: "Compact button variant for inline placement.",
      },
    },
  },
};

// Without event name
export const WithoutEventName: Story = {
  args: {
    ticketUrl: "https://example.com/tickets",
    variant: "default",
  },
  parameters: {
    docs: {
      description: {
        story: "Default card without personalized event name.",
      },
    },
  },
};

// Both variants side by side
export const Comparison: Story = {
  render: () => (
    <div className="space-y-8">
      <div>
        <p className="text-xs tracking-widest uppercase text-text-dim mb-4">
          Default (Card)
        </p>
        <div className="max-w-md">
          <TicketCTA
            ticketUrl="https://example.com/tickets"
            eventName="Sydney Tech Battle 2025"
            variant="default"
          />
        </div>
      </div>
      <div>
        <p className="text-xs tracking-widest uppercase text-text-dim mb-4">
          Compact (Button)
        </p>
        <TicketCTA
          ticketUrl="https://example.com/tickets"
          variant="compact"
        />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Comparison of default card and compact button variants.",
      },
    },
  },
};

// In context - header usage
export const HeaderUsage: Story = {
  render: () => (
    <div className="flex items-center justify-between p-4 bg-bg-elevated rounded-xl border border-white/5 max-w-2xl">
      <div>
        <h3 className="font-semibold text-lg">Sydney Tech Battle 2025</h3>
        <p className="text-text-muted text-sm">October 23, 2025 • The Metro Theatre</p>
      </div>
      <TicketCTA
        ticketUrl="https://example.com/tickets"
        variant="compact"
      />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Compact variant used in a header or inline context.",
      },
    },
  },
};

