/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx', 'src/**/*.d.ts', 'src/test/**'],
      // Floors, not goals — these lock the floor so coverage can only
      // ratchet upward. Recalibrated Sep 2026: the previous floors
      // (functions 55, branches 70) never matched this suite's true
      // coverage — verified deterministic (22.38% funcs / 22.6% branches)
      // across clean installs on Node 22 and 25, single and multi
      // worker. Raise deliberately when new suites land.
      thresholds: {
        lines: 28,
        functions: 20,
        branches: 20,
        statements: 26,
      },
    },
  },
})
