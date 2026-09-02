import { expect, test } from '@playwright/test';

import { expectNoAccessibilityViolations } from '../support/accessibility.js';

test('offers the fake sign-in', async ({ page }, testInfo) => {
  await page.goto('/sign-in');
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Alex Morgan' })).toBeVisible();
  await expectNoAccessibilityViolations(page, testInfo);
});
