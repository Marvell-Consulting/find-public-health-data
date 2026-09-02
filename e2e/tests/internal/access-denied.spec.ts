import { expect, test } from '@playwright/test';

import { expectNoAccessibilityViolations } from '../support/accessibility.js';
import { signInAs } from '../support/sign-in.js';

test('turns a viewer away from the manage page', async ({ page }, testInfo) => {
  await signInAs(page, 'Sam Taylor');
  const response = await page.goto('/manage');
  await expect(page).toHaveURL('/access-denied');
  expect(response?.status()).toBe(403);
  await expect(page.getByRole('heading', { level: 1, name: 'Access denied' })).toBeVisible();
  await expectNoAccessibilityViolations(page, testInfo);
});
