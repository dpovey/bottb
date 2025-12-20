import type { Preview } from "@storybook/nextjs-vite";
import React from "react";

// Import global CSS with Tailwind
import "../src/app/globals.css";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },

    // Dark theme to match BOTTB design
    backgrounds: {
      default: "bottb-dark",
      values: [
        { name: "bottb-dark", value: "#0a0a0a" },
        { name: "bottb-elevated", value: "#141414" },
        { name: "bottb-surface", value: "#222222" },
      ],
    },

    // Viewport presets for responsive testing
    viewport: {
      viewports: {
        mobile: {
          name: "Mobile",
          styles: { width: "375px", height: "812px" },
        },
        tablet: {
          name: "Tablet",
          styles: { width: "768px", height: "1024px" },
        },
        desktop: {
          name: "Desktop",
          styles: { width: "1280px", height: "800px" },
        },
      },
    },

    // A11y testing configuration
    a11y: {
      test: "todo",
    },
  },

  // Global decorator to wrap stories with dark background and Jost font
  decorators: [
    (Story) => (
      <>
        {/* Load Jost font */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Jost:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <style>{`
          :root {
            --font-jost: 'Jost', system-ui, sans-serif;
          }
        `}</style>
        <div className="bg-bg text-white min-h-screen p-4 font-sans">
          <Story />
        </div>
      </>
    ),
  ],
};

export default preview;
