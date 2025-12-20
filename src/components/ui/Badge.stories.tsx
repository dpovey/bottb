import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Badge } from "./badge";

const meta: Meta<typeof Badge> = {
  title: "Display/Badge",
  component: Badge,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Badge component for status indicators, labels, and tags. Uses semantic colors sparingly per BOTTB design guidelines.",
      },
    },
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "accent", "error", "success", "warning", "info"],
      description: "Visual style variant",
    },
    children: {
      control: "text",
      description: "Badge content",
    },
  },
};

export default meta;
type Story = StoryObj<typeof Badge>;

// Default badge
export const Default: Story = {
  args: {
    children: "Upcoming",
    variant: "default",
  },
};

// All variants
export const Accent: Story = {
  args: {
    children: "🏆 Winner",
    variant: "accent",
  },
  parameters: {
    docs: {
      description: {
        story: "For winners, featured items, and selected states.",
      },
    },
  },
};

export const Error: Story = {
  args: {
    children: "Cancelled",
    variant: "error",
  },
  parameters: {
    docs: {
      description: {
        story: "For error states and cancelled items.",
      },
    },
  },
};

export const Success: Story = {
  args: {
    children: "Confirmed",
    variant: "success",
  },
  parameters: {
    docs: {
      description: {
        story: "For completed and confirmed states.",
      },
    },
  },
};

export const Warning: Story = {
  args: {
    children: "Attention",
    variant: "warning",
  },
  parameters: {
    docs: {
      description: {
        story: "For items requiring attention.",
      },
    },
  },
};

export const Info: Story = {
  args: {
    children: "8 Bands",
    variant: "info",
  },
  parameters: {
    docs: {
      description: {
        story: "For informational messages.",
      },
    },
  },
};

// Status badges showcase
export const StatusBadges: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Badge variant="default">Upcoming</Badge>
      <Badge variant="success">Live</Badge>
      <Badge variant="accent">Winner</Badge>
      <Badge variant="default">Past</Badge>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Common event status badges.",
      },
    },
  },
};

// All variants showcase
export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Badge variant="default">Default</Badge>
      <Badge variant="accent">Accent</Badge>
      <Badge variant="success">Success</Badge>
      <Badge variant="warning">Warning</Badge>
      <Badge variant="error">Error</Badge>
      <Badge variant="info">Info</Badge>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "All badge variants. Use semantic colors sparingly.",
      },
    },
  },
};

