import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Integration files share one isolated test database, so they must not run concurrently.
    fileParallelism: false,
  },
});
