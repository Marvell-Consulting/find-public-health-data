import { expect, test } from '@playwright/test';

import { expectNoAccessibilityViolations } from '../support/accessibility.js';

test('shows the indicator selection with nothing selected', async ({ page }, testInfo) => {
  await page.goto('/indicators');
  await expect(page.getByRole('heading', { level: 1, name: 'Selected indicators' })).toBeVisible();
  await expectNoAccessibilityViolations(page, testInfo);
});

test('lists the indicators matching a search', async ({ page }, testInfo) => {
  await page.goto('/indicators?searchSubject=smoking');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Search results for “smoking”' }),
  ).toBeVisible();
  await expectNoAccessibilityViolations(page, testInfo);
});
