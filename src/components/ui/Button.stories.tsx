import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "./button";
import { ChevronRightIcon } from "@/components/icons";

const meta: Meta<typeof Button> = {
  title: "Actions/Button",
  component: Button,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Primary button component with multiple variants and sizes. Follows BOTTB design system with outline-solid as the default style.",
      },
    },
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["outline-solid", "filled", "accent", "ghost", "danger"],
      description: "Visual style variant (outline-solid is default)",
    },
    size: {
      control: "select",
      options: ["sm", "md", "lg"],
      description: "Button size",
    },
    disabled: {
      control: "boolean",
      description: "Disabled state",
    },
    children: {
      control: "text",
      description: "Button content",
    },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

// Default outline button
export const Default: Story = {
  args: {
    children: "View Events",
    variant: "outline-solid",
    size: "md",
  },
};

// All variants
export const Outline: Story = {
  args: {
    children: "Register Interest",
    variant: "outline-solid",
    size: "lg",
  },
  parameters: {
    docs: {
      description: {
        story: "Default button style - white outline on dark background.",
      },
    },
  },
};

export const Filled: Story = {
  args: {
    children: "Vote Now",
    variant: "filled",
    size: "lg",
  },
  parameters: {
    docs: {
      description: {
        story: "Use sparingly for primary CTAs like 'Vote Now'.",
      },
    },
  },
};

export const Accent: Story = {
  args: {
    children: "Live Event",
    variant: "accent",
    size: "lg",
  },
  parameters: {
    docs: {
      description: {
        story: "For live events, winners, and very important actions.",
      },
    },
  },
};

export const Ghost: Story = {
  args: {
    children: "Cancel",
    variant: "ghost",
    size: "md",
  },
  parameters: {
    docs: {
      description: {
        story: "No border, just text. For secondary actions.",
      },
    },
  },
};

export const Danger: Story = {
  args: {
    children: "Delete Event",
    variant: "danger",
    size: "md",
  },
  parameters: {
    docs: {
      description: {
        story: "For destructive actions like delete.",
      },
    },
  },
};

// Size variants
export const Small: Story = {
  args: {
    children: "Small",
    variant: "outline-solid",
    size: "sm",
  },
};

export const Medium: Story = {
  args: {
    children: "Medium",
    variant: "outline-solid",
    size: "md",
  },
};

export const Large: Story = {
  args: {
    children: "Large",
    variant: "outline-solid",
    size: "lg",
  },
};

// With icon
export const WithIcon: Story = {
  render: () => (
    <Button variant="outline-solid" size="lg">
      View All
      <ChevronRightIcon className="w-4 h-4" />
    </Button>
  ),
  parameters: {
    docs: {
      description: {
        story: "Buttons can include icons before or after text.",
      },
    },
  },
};

// Icon only
export const IconOnly: Story = {
  render: () => (
    <Button variant="outline-solid" className="p-3">
      <ChevronRightIcon className="w-5 h-5" />
    </Button>
  ),
  parameters: {
    docs: {
      description: {
        story: "Icon-only button with square padding.",
      },
    },
  },
};

// Disabled states
export const DisabledStates: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Button variant="outline-solid" disabled>
        Outline
      </Button>
      <Button variant="filled" disabled>
        Filled
      </Button>
      <Button variant="accent" disabled>
        Accent
      </Button>
      <Button variant="danger" disabled>
        Danger
      </Button>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "All variants support disabled state.",
      },
    },
  },
};

// All variants showcase
export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Button variant="outline-solid">Outline</Button>
      <Button variant="filled">Filled</Button>
      <Button variant="accent">Accent</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="danger">Danger</Button>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "All button variants side by side.",
      },
    },
  },
};

// All sizes showcase
export const AllSizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "All button sizes side by side.",
      },
    },
  },
};

