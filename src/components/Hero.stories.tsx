import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Hero, PageHeader } from "./hero";

const meta: Meta<typeof Hero> = {
  title: "Features/Hero",
  component: Hero,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Full-viewport hero section with background image support, overlay options, and CTA buttons.",
      },
    },
  },
  argTypes: {
    title: { control: "text" },
    subtitle: { control: "text" },
    backgroundImage: { control: "text" },
    size: {
      control: "select",
      options: ["sm", "md", "lg", "full"],
    },
    overlay: {
      control: "select",
      options: ["light", "medium", "heavy"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Hero>;

// Default hero (no image)
export const Default: Story = {
  args: {
    title: "Battle of the Tech Bands",
    subtitle: "Where tech companies compete through the power of music",
    size: "lg",
    overlay: "heavy",
    actions: [
      { label: "View Events", href: "#", variant: "outline-solid" },
      { label: "Register Interest", href: "#", variant: "outline-solid" },
    ],
  },
};

// With background image
export const WithImage: Story = {
  args: {
    title: "Sydney Tech Battle 2025",
    subtitle: "October 23 • The Metro Theatre",
    backgroundImage: "https://picsum.photos/1920/1080",
    size: "lg",
    overlay: "heavy",
    actions: [
      { label: "Get Tickets", href: "#", variant: "filled" },
      { label: "View Lineup", href: "#", variant: "outline-solid" },
    ],
  },
  parameters: {
    docs: {
      description: {
        story: "Hero with background image and gradient overlay.",
      },
    },
  },
};

// Different sizes
export const SmallSize: Story = {
  args: {
    title: "Photo Gallery",
    subtitle: "Browse photos from all events",
    size: "sm",
    overlay: "medium",
  },
};

export const MediumSize: Story = {
  args: {
    title: "About BOTTB",
    subtitle: "The story behind the battle",
    size: "md",
    overlay: "medium",
  },
};

export const FullScreen: Story = {
  args: {
    title: "Battle of the Tech Bands",
    subtitle: "Tech companies. Live music. One champion.",
    size: "full",
    overlay: "heavy",
    actions: [
      { label: "Vote Now", href: "#", variant: "accent" },
    ],
  },
};

// Overlay intensities
export const LightOverlay: Story = {
  args: {
    title: "Light Overlay",
    subtitle: "More image visible",
    backgroundImage: "https://picsum.photos/1920/1080",
    size: "md",
    overlay: "light",
  },
};

export const MediumOverlay: Story = {
  args: {
    title: "Medium Overlay",
    subtitle: "Balanced visibility",
    backgroundImage: "https://picsum.photos/1920/1080",
    size: "md",
    overlay: "medium",
  },
};

export const HeavyOverlay: Story = {
  args: {
    title: "Heavy Overlay",
    subtitle: "Maximum text readability",
    backgroundImage: "https://picsum.photos/1920/1080",
    size: "md",
    overlay: "heavy",
  },
};

// With custom focal point
export const CustomFocalPoint: Story = {
  args: {
    title: "Custom Focal Point",
    subtitle: "Image centered on specific area",
    backgroundImage: "https://picsum.photos/1920/1080",
    focalPoint: { x: 30, y: 20 },
    size: "lg",
    overlay: "medium",
  },
  parameters: {
    docs: {
      description: {
        story: "Focal point controls which part of the image is centered.",
      },
    },
  },
};

// PageHeader variant
export const PageHeaderDefault: StoryObj<typeof PageHeader> = {
  render: () => (
    <PageHeader
      title="Photo Gallery"
      subtitle="Browse photos from all Battle of the Tech Bands events"
    />
  ),
  parameters: {
    docs: {
      description: {
        story: "Simpler variant for page headers (not full hero).",
      },
    },
  },
};

// PageHeader with children
export const PageHeaderWithChildren: StoryObj<typeof PageHeader> = {
  render: () => (
    <PageHeader
      title="Events"
      subtitle="Past and upcoming battles"
    >
      <div className="mt-6 flex gap-3">
        <span className="bg-white/10 border border-white/20 text-white px-3 py-1 rounded-sm text-xs tracking-wider uppercase">
          12 Events
        </span>
        <span className="bg-accent/20 border border-accent/30 text-accent px-3 py-1 rounded-sm text-xs tracking-wider uppercase">
          2 Upcoming
        </span>
      </div>
    </PageHeader>
  ),
};

