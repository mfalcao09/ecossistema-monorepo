import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 60000,
    hookTimeout: 30000,
    reporters: ['verbose'],
    include: ['**/*.spec.ts'],
    exclude: ['node_modules/**'],
    setupFiles: ['./helpers/setup.ts'],
  },
});
