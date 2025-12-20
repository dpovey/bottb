import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { NumberedIndicator } from "./numbered-indicator";

const meta: Meta<typeof NumberedIndicator> = {
  title: "Display/NumberedIndicator",
  component: NumberedIndicator,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Displays a number in a styled container. Use for ordered lists, rankings, and positions.",
      },
    },
  },
  argTypes: {
    number: {
      control: "number",
      description: "The number to display",
    },
    shape: {
      control: "select",
      options: ["circle", "square"],
      description: "Shape of the indicator",
    },
    size: {
      control: "select",
      options: ["xs", "sm", "md", "lg", "xl"],
      description: "Size variant",
    },
    variant: {
      control: "select",
      options: [
        "default",
        "muted",
        "winner",
        "accent",
        "rank-1",
        "rank-2",
        "rank-3",
      ],
      description: "Visual variant",
    },
  },
};

export default meta;
type Story = StoryObj<typeof NumberedIndicator>;

// Default
export const Default: Story = {
  args: {
    number: 1,
    shape: "circle",
    size: "md",
    variant: "default",
  },
};

// Shape variants
export const Circle: Story = {
  args: {
    number: 1,
    shape: "circle",
    size: "md",
    variant: "default",
  },
};

export const Square: Story = {
  args: {
    number: 1,
    shape: "square",
    size: "lg",
    variant: "muted",
  },
  parameters: {
    docs: {
      description: {
        story: "Square shape commonly used for band order in event lists.",
      },
    },
  },
};

// Ranking variants
export const Rank1: Story = {
  args: {
    number: 1,
    shape: "circle",
    size: "md",
    variant: "rank-1",
  },
  parameters: {
    docs: {
      description: {
        story: "Gold styling for 1st place.",
      },
    },
  },
};

export const Rank2: Story = {
  args: {
    number: 2,
    shape: "circle",
    size: "md",
    variant: "rank-2",
  },
  parameters: {
    docs: {
      description: {
        story: "Silver styling for 2nd place.",
      },
    },
  },
};

export const Rank3: Story = {
  args: {
    number: 3,
    shape: "circle",
    size: "md",
    variant: "rank-3",
  },
  parameters: {
    docs: {
      description: {
        story: "Bronze styling for 3rd place.",
      },
    },
  },
};

// Size variants
export const AllSizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <NumberedIndicator number={1} size="xs" />
      <NumberedIndicator number={2} size="sm" />
      <NumberedIndicator number={3} size="md" />
      <NumberedIndicator number={4} size="lg" />
      <NumberedIndicator number={5} size="xl" />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "All available sizes from xs to xl.",
      },
    },
  },
};

// Ranking podium
export const RankingPodium: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <NumberedIndicator number={1} size="lg" variant="rank-1" />
      <NumberedIndicator number={2} size="lg" variant="rank-2" />
      <NumberedIndicator number={3} size="lg" variant="rank-3" />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Podium positions with gold, silver, and bronze styling.",
      },
    },
  },
};

// Setlist example
export const SetlistPositions: Story = {
  render: () => (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((num) => (
        <div key={num} className="flex items-center gap-3">
          <NumberedIndicator number={num} shape="circle" size="md" />
          <span className="text-white">Song Title {num}</span>
        </div>
      ))}
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Circle shape for setlist song positions.",
      },
    },
  },
};

// Band order example
export const BandOrder: Story = {
  render: () => (
    <div className="space-y-4">
      {[1, 2, 3].map((num) => (
        <div key={num} className="flex items-center gap-4">
          <NumberedIndicator
            number={num}
            shape="square"
            size="lg"
            variant="muted"
          />
          <div>
            <p className="font-medium text-white">Band Name {num}</p>
            <p className="text-sm text-text-muted">Company</p>
          </div>
        </div>
      ))}
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Square shape with muted variant for band order in event lists.",
      },
    },
  },
};

// All variants
export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <NumberedIndicator number={1} variant="default" />
      <NumberedIndicator number={2} variant="muted" />
      <NumberedIndicator number={3} variant="winner" />
      <NumberedIndicator number={4} variant="accent" />
      <NumberedIndicator number={1} variant="rank-1" />
      <NumberedIndicator number={2} variant="rank-2" />
      <NumberedIndicator number={3} variant="rank-3" />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "All visual variants.",
      },
    },
  },
};

