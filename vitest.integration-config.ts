import type { ViteUserConfig as VitestUserConfig } from 'vitest/config';

/**
 * Shared by every project whose tests build a database from a template. Copying is quick
 * but not instant and the copies queue behind one another on an advisory lock, and what
 * the tests then do runs over hundreds of thousands of rows, so hooks and test bodies
 * alike need far longer than Vitest's defaults. Vitest does not pass the root config's
 * `test` options down to projects, so each of those projects re-exports this as its own
 * config.
 *
 * Applied only to the tier that waits on Postgres — the same `INTEGRATION_DB` gate the
 * global setup uses — so a hanging unit test still fails in seconds.
 */
const DATABASE_TIMEOUT_MS = 60_000;

const timeouts =
  process.env.INTEGRATION_DB === '1'
    ? { hookTimeout: DATABASE_TIMEOUT_MS, testTimeout: DATABASE_TIMEOUT_MS }
    : {};

export const integrationVitestConfig = {
  test: timeouts,
} satisfies VitestUserConfig;
