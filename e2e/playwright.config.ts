// End-to-end tests. Specs drive the running apps over HTTP against the base URLs below —
// they never import app code, and nothing here starts the stack: locally that is `pnpm dev`
// (or any dev:mixed split) in another terminal, in CI the compose containers.
//
// Specs run in parallel workers against one shared seeded database, which makes one rule
// load-bearing: a spec never mutates data another spec reads. A test of a write flow creates
// its own rows and asserts on those; a flow that genuinely cannot own its data gets a serial
// project then, not speculatively now.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  // A flaky test is a bug in the test; retries would teach us to live with it.
  retries: 0,
  // A stray .only must not quietly shrink the suite where nobody is watching.
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['html', { open: 'never' }]] : 'list',
  use: {
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'public',
      testDir: './tests/public',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.PUBLIC_WEB_URL ?? 'http://localhost:3000',
      },
    },
    {
      name: 'internal',
      testDir: './tests/internal',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: process.env.INTERNAL_WEB_URL ?? 'http://localhost:3001',
      },
    },
  ],
});
