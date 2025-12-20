import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Skeleton, SkeletonText, SkeletonCard } from "./skeleton";

const meta: Meta<typeof Skeleton> = {
  title: "Display/Skeleton",
  component: Skeleton,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Skeleton loading placeholder with shimmer animation. Respects prefers-reduced-motion for accessibility.",
      },
    },
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["rectangle", "circle", "text"],
      description: "Shape variant",
    },
    className: {
      control: "text",
      description: "Additional CSS classes for sizing",
    },
  },
};

export default meta;
type Story = StoryObj<typeof Skeleton>;

// Default rectangle
export const Default: Story = {
  args: {
    variant: "rectangle",
    className: "h-8 w-48",
  },
};

// Shape variants
export const Rectangle: Story = {
  args: {
    variant: "rectangle",
    className: "h-32 w-64",
  },
  parameters: {
    docs: {
      description: {
        story: "Default shape with rounded-sm corners.",
      },
    },
  },
};

export const Circle: Story = {
  args: {
    variant: "circle",
    className: "h-16 w-16",
  },
  parameters: {
    docs: {
      description: {
        story: "Perfect circle for avatar placeholders. Use equal width/height.",
      },
    },
  },
};

export const Text: Story = {
  args: {
    variant: "text",
    className: "h-4 w-full max-w-md",
  },
  parameters: {
    docs: {
      description: {
        story: "Pill-shaped for text line placeholders.",
      },
    },
  },
};

// Pre-composed SkeletonText
export const TextBlock: Story = {
  render: () => (
    <div className="w-80">
      <SkeletonText lines={3} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Pre-composed text skeleton. Last line is shorter for natural appearance.",
      },
    },
  },
};

// Pre-composed SkeletonCard
export const CardSkeleton: Story = {
  render: () => (
    <div className="w-80">
      <SkeletonCard />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Pre-composed card skeleton with avatar and text.",
      },
    },
  },
};

// Avatar + text pattern
export const AvatarWithText: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Skeleton variant="circle" className="h-12 w-12" />
      <div className="space-y-2">
        <Skeleton variant="text" className="h-4 w-32" />
        <Skeleton variant="text" className="h-3 w-24" />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Common pattern for loading user/band cards.",
      },
    },
  },
};

// Image placeholder
export const ImagePlaceholder: Story = {
  render: () => (
    <div className="space-y-3 w-72">
      <Skeleton variant="rectangle" className="h-48 w-full" />
      <Skeleton variant="text" className="h-5 w-3/4" />
      <Skeleton variant="text" className="h-4 w-1/2" />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Image card loading state.",
      },
    },
  },
};

// Grid of cards
export const CardGrid: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-4 w-[600px]">
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Grid of skeleton cards for list loading states.",
      },
    },
  },
};

// Different text line counts
export const TextLineCounts: Story = {
  render: () => (
    <div className="space-y-6 w-80">
      <div>
        <p className="text-text-dim text-xs mb-2">1 Line</p>
        <SkeletonText lines={1} />
      </div>
      <div>
        <p className="text-text-dim text-xs mb-2">2 Lines</p>
        <SkeletonText lines={2} />
      </div>
      <div>
        <p className="text-text-dim text-xs mb-2">4 Lines</p>
        <SkeletonText lines={4} />
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "SkeletonText with different line counts.",
      },
    },
  },
};

