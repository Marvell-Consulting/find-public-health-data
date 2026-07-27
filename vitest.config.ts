import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Runs once per vitest invocation; a no-op unless INTEGRATION_DB=1 (set by
    // test:integration), where it builds the seeded template database.
    globalSetup: ['./vitest.global-setup.ts'],
    // A projects glob rejects any non-config file it matches, and both workspace directories hold
    // shared tsconfigs and `apps/web-config.ts` alongside the package directories.
    projects: ['apps/*', 'packages/*', '!**/*.json', '!**/*.ts'],
  },
});
