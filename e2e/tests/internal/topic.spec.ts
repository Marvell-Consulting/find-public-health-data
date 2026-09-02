import { expect, test } from '@playwright/test';

import { expectNoAccessibilityViolations } from '../support/accessibility.js';
import { signInAs } from '../support/sign-in.js';

test('shows a topic to a viewer', async ({ page }, testInfo) => {
  await signInAs(page, 'Sam Taylor');
  await page.goto('/topics/alcohol');
  await expect(page.getByRole('heading', { level: 1, name: 'Alcohol' })).toBeVisible();
  await expectNoAccessibilityViolations(page, testInfo);
});
