import { expect, test } from '@playwright/test';

import { expectNoAccessibilityViolations } from '../support/accessibility.js';

test('answers an unknown path with the not-found page', async ({ page }) => {
  const response = await page.goto('/no-such-page');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
});

test('has no WCAG 2.2 AA violations', async ({ page }, testInfo) => {
  await page.goto('/no-such-page');
  await expectNoAccessibilityViolations(page, testInfo);
});
