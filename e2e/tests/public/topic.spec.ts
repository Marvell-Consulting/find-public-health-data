import { expect, test } from '@playwright/test';

import { expectNoAccessibilityViolations } from '../support/accessibility.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/topics/alcohol');
});

test('shows a topic', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1, name: 'Alcohol' })).toBeVisible();
  await expect(page.getByText('Alcohol indicators cover levels of drinking')).toBeVisible();
});

test('answers a topic that does not exist with the not-found page', async ({ page }) => {
  const response = await page.goto('/topics/no-such-topic');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
});

test('has no WCAG 2.2 AA violations', async ({ page }, testInfo) => {
  await expectNoAccessibilityViolations(page, testInfo);
});
