import { expect, test } from '@playwright/test';

import { expectNoAccessibilityViolations } from '../support/accessibility.js';
import { signInAs } from '../support/sign-in.js';

test.beforeEach(async ({ page }) => {
  await signInAs(page, 'Sam Taylor');
});

test('turns a viewer away from the manage page', async ({ page }) => {
  const response = await page.goto('/manage');
  await expect(page).toHaveURL('/access-denied');
  expect(response?.status()).toBe(403);
  await expect(page.getByRole('heading', { level: 1, name: 'Access denied' })).toBeVisible();
});

test('has no WCAG 2.2 AA violations', async ({ page }, testInfo) => {
  await page.goto('/manage');
  await expect(page).toHaveURL('/access-denied');
  await expectNoAccessibilityViolations(page, testInfo);
});
