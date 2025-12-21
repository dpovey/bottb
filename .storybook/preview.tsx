import type { Preview } from '@storybook/nextjs-vite'
import { themes } from 'storybook/theming'
import React from 'react'

// Import global CSS with Tailwind
import '../src/app/globals.css'

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
      default: 'bottb-dark',
      values: [
        { name: 'bottb-dark', value: '#0a0a0a' },
        { name: 'bottb-elevated', value: '#141414' },
        { name: 'bottb-surface', value: '#222222' },
      ],
    },

    // Viewport presets for responsive testing
    viewport: {
      viewports: {
        mobile: {
          name: 'Mobile',
          styles: { width: '375px', height: '812px' },
        },
        tablet: {
          name: 'Tablet',
          styles: { width: '768px', height: '1024px' },
        },
        desktop: {
          name: 'Desktop',
          styles: { width: '1280px', height: '800px' },
        },
      },
    },

    // A11y testing configuration
    a11y: {
      test: 'todo',
    },

    // Docs configuration for dark theme
    docs: {
      theme: {
        ...themes.dark,
        appBg: '#0a0a0a',
        appContentBg: '#0a0a0a',
        barBg: '#141414',
        textColor: '#ffffff',
        textMutedColor: '#999999',
      },
      canvas: {
        sourceState: 'shown',
      },
    },
  },

  // Global decorator to wrap stories with dark background and Jost font
  decorators: [
    (Story) => (
      <>
        {/* Load Jost font */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Jost:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <style>{`
          :root {
            --font-jost: 'Jost', system-ui, sans-serif;
          }
          /* Ensure the entire canvas has dark background */
          html, body, #storybook-root {
            background-color: #0a0a0a !important;
            min-height: 100%;
          }
        `}</style>
        {/* Story wrapper with dark background */}
        <div className="bg-bg text-white p-4 font-sans">
          <Story />
        </div>
      </>
    ),
  ],
}

export default preview
