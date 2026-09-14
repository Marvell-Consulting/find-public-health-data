import { expect, test } from '@playwright/test';

import { expectNoAccessibilityViolations } from '../support/accessibility.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

// Proof of life for public-web: the home page serves, and following it to /topics renders
// core data — the SSR path down to Postgres is live.
test('serves the home page and renders core-data topics', async ({ page }) => {
  await expect(
    page.getByRole('heading', { level: 1, name: 'Find public health data' }),
  ).toBeVisible();

  await page.getByRole('link', { name: 'Browse by topics' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Public health topics' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Alcohol', exact: true })).toBeVisible();
});

test('has no WCAG 2.2 AA violations', async ({ page }, testInfo) => {
  await expectNoAccessibilityViolations(page, testInfo);
});

test('uses the application-wide content width', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });

  await expect(page.locator('.not-govuk-page__container')).toHaveCSS('max-width', '1400px');
  await expect(page.locator('.not-govuk-page__container')).toHaveCSS('width', '1400px');
});
