import { expect, test } from '@playwright/test';

import { expectNoAccessibilityViolations } from '../support/accessibility.js';
import { signInAs } from '../support/sign-in.js';

test('shows the indicator selection to a viewer', async ({ page }, testInfo) => {
  await signInAs(page, 'Sam Taylor');
  await page.goto('/indicators');
  await expect(page.getByRole('heading', { level: 1, name: 'Selected indicators' })).toBeVisible();
  await expectNoAccessibilityViolations(page, testInfo);
});
