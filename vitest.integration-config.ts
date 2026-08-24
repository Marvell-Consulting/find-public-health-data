import type { ViteUserConfig as VitestUserConfig } from 'vitest/config';

/**
 * Shared by every project whose tests build a database from a template. Copying is quick
 * but not instant, and copies queue behind one another on an advisory lock, so a
 * `beforeAll` that builds one needs far longer than Vitest's ten-second default. Vitest
 * does not pass the root config's `test` options down to projects, so each of those
 * projects re-exports this as its own config.
 */
export const integrationVitestConfig = {
  test: {
    hookTimeout: 60_000,
  },
} satisfies VitestUserConfig;
