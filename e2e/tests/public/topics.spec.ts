import { expect, test } from '@playwright/test';

import { expectNoAccessibilityViolations } from '../support/accessibility.js';

test('lists the public health topics', async ({ page }, testInfo) => {
  await page.goto('/topics');
  await expect(page.getByRole('heading', { level: 1, name: 'Public health topics' })).toBeVisible();
  await expectNoAccessibilityViolations(page, testInfo);
});
