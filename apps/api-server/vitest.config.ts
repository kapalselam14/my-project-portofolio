import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // `npm run build` compiles src (including *.test.ts) into dist/.
    // Without this, vitest's default include pattern collects both the
    // fresh src tests AND the stale compiled dist copies — running every
    // suite twice and reporting phantom failures from outdated build
    // output. dist/ is gitignored build output, never a test source.
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      // Floors, not goals: measured ~60% lines / ~51% branches at
      // introduction — these lock the floor so coverage can only ratchet
      // upward. Raise deliberately when new suites land (see
      // docs/architecture/testing-strategy.md).
      thresholds: {
        lines: 55,
        functions: 45,
        branches: 45,
        statements: 55,
      },
    },
  },
});
