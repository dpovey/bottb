/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-jost)', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Background colors (near-black scale)
        bg: {
          DEFAULT: '#0a0a0a',
          elevated: '#141414',
          muted: '#1a1a1a',
          surface: '#222222',
        },
        // Text colors
        text: {
          DEFAULT: '#ffffff',
          muted: '#a0a0a0',
          dim: '#666666',
        },
        // Accent color (Vibrant Gold - use sparingly)
        accent: {
          DEFAULT: '#F5A623',
          light: '#FFBE3D',
        },
        // Semantic colors (use rarely, only for feedback)
        error: {
          DEFAULT: '#f10e34',
          light: '#f33f5d',
        },
        success: {
          DEFAULT: '#31eb14',
          light: '#98f58a',
        },
        warning: {
          DEFAULT: '#F5A623',
          light: '#FFBE3D',
        },
        info: {
          DEFAULT: '#3B82F6',
          light: '#60A5FA',
        },
        // Legacy colors for backwards compatibility during migration
        card: '#1a1a1a',
        'text-muted': '#a0a0a0',
        'accent-hover': '#FFBE3D',
      },
      letterSpacing: {
        'widest': '0.2em', // For ALL CAPS elements
      },
      boxShadow: {
        'glow': '0 0 20px rgba(245, 166, 35, 0.3)',
        'glow-accent': '0 0 30px rgba(245, 166, 35, 0.4)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      borderColor: {
        DEFAULT: 'rgba(255, 255, 255, 0.1)',
      },
    },
  },
  plugins: [],
}
