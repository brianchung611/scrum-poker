import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Frontend tests import .tsx modules; use the same JSX transform as the app.
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: {
      // Test against shared's source so tests don't depend on a prior build.
      '@scrum-poker/shared': fileURLToPath(
        new URL('./packages/shared/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    include: ['packages/*/src/**/*.test.ts'],
    environment: 'node',
    testTimeout: 10_000,
  },
});
