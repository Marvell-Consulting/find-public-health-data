import { expect, test } from '@playwright/test';

import { expectNoAccessibilityViolations } from '../support/accessibility.js';
import { signInAs } from '../support/sign-in.js';

test('lists the public health topics to a viewer', async ({ page }, testInfo) => {
  await signInAs(page, 'Sam Taylor');
  await page.goto('/topics');
  await expect(page.getByRole('heading', { level: 1, name: 'Public health topics' })).toBeVisible();
  await expectNoAccessibilityViolations(page, testInfo);
});
