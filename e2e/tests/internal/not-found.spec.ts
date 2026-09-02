import { expect, test } from '@playwright/test';

import { expectNoAccessibilityViolations } from '../support/accessibility.js';
import { signInAs } from '../support/sign-in.js';

test('answers an unknown path with the not-found page for a viewer', async ({ page }, testInfo) => {
  await signInAs(page, 'Sam Taylor');
  const response = await page.goto('/no-such-page');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
  await expectNoAccessibilityViolations(page, testInfo);
});
