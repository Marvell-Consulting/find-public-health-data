import { expect, test } from '@playwright/test';

import { expectNoAccessibilityViolations } from '../support/accessibility.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/sign-in');
});

test('offers the internal users only', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Sam Taylor' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Alex Morgan' })).toHaveCount(0);
});

test('has no WCAG 2.2 AA violations', async ({ page }, testInfo) => {
  await expectNoAccessibilityViolations(page, testInfo);
});
