import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // A projects glob rejects any non-config file it matches, and both workspace directories hold
    // shared tsconfigs and `apps/web-config.ts` alongside the package directories.
    projects: ['apps/*', 'packages/*', '!**/*.json', '!**/*.ts'],
  },
});
