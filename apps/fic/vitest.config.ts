import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['agents/**/*.test.ts'],
    exclude: ['agents/**/e2e-sandbox.test.ts'],
    globals: false,
    pool: 'forks',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['agents/**/*.ts'],
      exclude: [
        'agents/**/*.test.ts',
        'agents/**/index.ts',
      ],
    },
  },
});
