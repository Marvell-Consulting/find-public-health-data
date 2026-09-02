import { expect, test } from '@playwright/test';

import { expectNoAccessibilityViolations } from '../support/accessibility.js';

// Proof of life for public-web: the home page serves, and following it to /topics renders
// core data — the SSR path down to Postgres is live.
test('serves the home page and renders core-data topics', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Find public health data' }),
  ).toBeVisible();
  await expectNoAccessibilityViolations(page, testInfo);

  await page.getByRole('link', { name: 'Browse by topics' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Public health topics' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Alcohol', exact: true })).toBeVisible();
});
