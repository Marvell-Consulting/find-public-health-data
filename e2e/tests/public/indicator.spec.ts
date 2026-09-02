import { expect, test } from '@playwright/test';

import { expectNoAccessibilityViolations } from '../support/accessibility.js';

test('shows an indicator', async ({ page }, testInfo) => {
  await page.goto('/indicators/108');
  await expect(
    page.getByRole('heading', { level: 2, name: 'Under 75 mortality rate from all causes' }),
  ).toBeVisible();
  await expectNoAccessibilityViolations(page, testInfo);
});
