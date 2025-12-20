import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    // Exclude Storybook stories from unit tests (they're tested visually via Chromatic)
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/*.stories.{ts,tsx}",
    ],
  },
  resolve: {
    alias: {
      "next/server": "next/server.js",
      "next-auth": "next-auth",
      "@vercel/postgres": "@vercel/postgres",
    },
  },
  define: {
    "process.env": "{}",
  },
});
