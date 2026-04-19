import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/types.ts', 'src/index.ts'],
      thresholds: {
        lines: 80,
        statements: 80,
        branches: 75,
        functions: 80,
      },
    },
  },
});
