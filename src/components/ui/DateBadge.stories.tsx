import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DateBadge } from "./date-badge";

const meta: Meta<typeof DateBadge> = {
  title: "Display/DateBadge",
  component: DateBadge,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Tomorrowland-style date badge with month abbreviation on top and day number below.",
      },
    },
  },
  argTypes: {
    date: {
      control: "date",
      description: "The date to display",
    },
    size: {
      control: "select",
      options: ["sm", "md", "lg"],
      description: "Badge size",
    },
    showYear: {
      control: "boolean",
      description: "Whether to show the year",
    },
    timezone: {
      control: "text",
      description: "IANA timezone name (e.g., Australia/Brisbane)",
    },
  },
};

export default meta;
type Story = StoryObj<typeof DateBadge>;

// Default date badge
export const Default: Story = {
  args: {
    date: new Date("2025-10-23"),
    size: "md",
    showYear: false,
  },
};

// With year
export const WithYear: Story = {
  args: {
    date: new Date("2025-10-23"),
    size: "md",
    showYear: true,
  },
  parameters: {
    docs: {
      description: {
        story: "Date badge showing the year below the day.",
      },
    },
  },
};

// Size variants
export const Small: Story = {
  args: {
    date: new Date("2025-10-23"),
    size: "sm",
  },
};

export const Medium: Story = {
  args: {
    date: new Date("2025-10-23"),
    size: "md",
  },
};

export const Large: Story = {
  args: {
    date: new Date("2025-10-23"),
    size: "lg",
    showYear: true,
  },
};

// All sizes showcase
export const AllSizes: Story = {
  render: () => (
    <div className="flex items-end gap-4">
      <DateBadge date={new Date("2025-10-23")} size="sm" />
      <DateBadge date={new Date("2025-10-23")} size="md" />
      <DateBadge date={new Date("2025-10-23")} size="lg" showYear />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Date badges in all available sizes.",
      },
    },
  },
};

// Date range (multiple badges)
export const DateRange: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <DateBadge date={new Date("2025-07-17")} size="md" />
      <span className="text-text-dim">—</span>
      <DateBadge date={new Date("2025-07-19")} size="md" />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "For date ranges, stack multiple badges horizontally.",
      },
    },
  },
};

// Different months
export const DifferentMonths: Story = {
  render: () => (
    <div className="flex gap-4">
      <DateBadge date={new Date("2025-01-15")} size="md" />
      <DateBadge date={new Date("2025-06-01")} size="md" />
      <DateBadge date={new Date("2025-12-25")} size="md" showYear />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Date badges showing different months.",
      },
    },
  },
};

