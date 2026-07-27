import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Copying a template database is quick but not instant, and copies queue behind one
    // another. Set explicitly so the integration tier's beforeAll has room; it is not
    // load-bearing — nothing retries against it.
    hookTimeout: 60_000,
    // Runs once per vitest invocation; a no-op unless INTEGRATION_DB=1 (set by
    // test:integration), where it builds the template databases.
    globalSetup: ['./vitest.global-setup.ts'],
    // A projects glob rejects any non-config file it matches, and both workspace directories hold
    // shared tsconfigs and `apps/web-config.ts` alongside the package directories.
    projects: ['apps/*', 'packages/*', 'tools/*', '!**/*.json', '!**/*.ts'],
  },
});
