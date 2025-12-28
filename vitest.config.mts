import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    // Exclude Storybook stories and Playwright E2E tests from unit tests
    exclude: ['**/node_modules/**', '**/dist/**', '**/*.stories.{ts,tsx}', '**/e2e/**'],
  },
  resolve: {
    alias: {
      'next/server': 'next/server.js',
      'next-auth': 'next-auth',
      '@vercel/postgres': '@vercel/postgres',
    },
  },
  define: {
    'process.env': '{}',
  },
})
