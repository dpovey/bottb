import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "./card";
import { Button } from "./button";

const meta: Meta<typeof Card> = {
  title: "Display/Card",
  component: Card,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Card component for containing content. Supports multiple variants and padding options.",
      },
    },
  },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "elevated", "interactive"],
      description: "Visual style variant",
    },
    padding: {
      control: "select",
      options: ["none", "sm", "md", "lg"],
      description: "Internal padding",
    },
  },
};

export default meta;
type Story = StoryObj<typeof Card>;

// Default card
export const Default: Story = {
  args: {
    variant: "default",
    padding: "md",
    children: (
      <>
        <CardHeader>
          <CardTitle>Card Title</CardTitle>
          <CardDescription>Card description goes here.</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Card content area. Add any content here.</p>
        </CardContent>
      </>
    ),
  },
};

// Elevated card
export const Elevated: Story = {
  args: {
    variant: "elevated",
    padding: "md",
    children: (
      <>
        <CardHeader>
          <CardTitle>Elevated Card</CardTitle>
          <CardDescription>Slightly more prominent surface.</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Use for content that needs to stand out.</p>
        </CardContent>
      </>
    ),
  },
};

// Interactive card
export const Interactive: Story = {
  args: {
    variant: "interactive",
    padding: "md",
    children: (
      <>
        <CardHeader>
          <CardTitle>Interactive Card</CardTitle>
          <CardDescription>Hover me to see the effect!</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Cards with hover state and cursor pointer.</p>
        </CardContent>
      </>
    ),
  },
  parameters: {
    docs: {
      description: {
        story: "Interactive cards have hover effects with scale and shadow.",
      },
    },
  },
};

// With footer
export const WithFooter: Story = {
  args: {
    variant: "default",
    padding: "md",
    children: (
      <>
        <CardHeader>
          <CardTitle>Card with Footer</CardTitle>
          <CardDescription>Complete card structure.</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Main content area of the card.</p>
        </CardContent>
        <CardFooter>
          <Button variant="outline-solid" size="sm">
            Action
          </Button>
        </CardFooter>
      </>
    ),
  },
};

// Padding variants
export const PaddingVariants: Story = {
  render: () => (
    <div className="flex flex-col gap-4 max-w-md">
      <Card padding="none">
        <div className="p-4 border-b border-white/5">
          <CardTitle>No Padding</CardTitle>
        </div>
        <CardContent className="p-4">Custom padding applied</CardContent>
      </Card>
      <Card padding="sm">
        <CardTitle>Small Padding</CardTitle>
        <CardDescription>Compact card.</CardDescription>
      </Card>
      <Card padding="md">
        <CardTitle>Medium Padding</CardTitle>
        <CardDescription>Default card padding.</CardDescription>
      </Card>
      <Card padding="lg">
        <CardTitle>Large Padding</CardTitle>
        <CardDescription>Spacious card.</CardDescription>
      </Card>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Cards with different padding options.",
      },
    },
  },
};

// Simple card (no sub-components)
export const SimpleCard: Story = {
  render: () => (
    <Card className="max-w-sm">
      <h3 className="font-semibold text-xl mb-2">Simple Card</h3>
      <p className="text-text-muted">
        You can use Card without the sub-components for simpler layouts.
      </p>
    </Card>
  ),
};

