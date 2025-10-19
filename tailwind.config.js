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
        display: ['var(--font-rock-salt)', 'cursive'],
        sans: ['var(--font-lato)', 'sans-serif'],
      },
      colors: {
        bg: '#0a0a0a',
        card: '#1a1a1a',
        text: '#ffffff',
        'text-muted': '#a3a3a3',
        accent: '#3b82f6',
        'accent-hover': '#2563eb',
      },
      letterSpacing: {
        'display': '0.05em',
      },
      boxShadow: {
        'glow': '0 0 20px rgba(59, 130, 246, 0.3)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
}


