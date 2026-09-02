import { expect, test } from '@playwright/test';

import { expectNoAccessibilityViolations } from '../support/accessibility.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/indicators/108');
});

test('shows an indicator', async ({ page }) => {
  await expect(
    page.getByRole('heading', { level: 2, name: 'Under 75 mortality rate from all causes' }),
  ).toBeVisible();
});

test('has no WCAG 2.2 AA violations', async ({ page }, testInfo) => {
  await expectNoAccessibilityViolations(page, testInfo);
});
