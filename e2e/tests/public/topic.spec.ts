import { expect, test } from '@playwright/test';

import { expectNoAccessibilityViolations } from '../support/accessibility.js';

test('shows a topic', async ({ page }, testInfo) => {
  await page.goto('/topics/alcohol');
  await expect(page.getByRole('heading', { level: 1, name: 'Alcohol' })).toBeVisible();
  await expectNoAccessibilityViolations(page, testInfo);
});
