import { expect, test } from '@playwright/test';

import { expectNoAccessibilityViolations } from '../support/accessibility.js';
import { signInAs } from '../support/sign-in.js';

test('shows an indicator to a viewer', async ({ page }, testInfo) => {
  await signInAs(page, 'Sam Taylor');
  await page.goto('/indicators/108');
  await expect(
    page.getByRole('heading', { level: 2, name: 'Under 75 mortality rate from all causes' }),
  ).toBeVisible();
  await expectNoAccessibilityViolations(page, testInfo);
});
