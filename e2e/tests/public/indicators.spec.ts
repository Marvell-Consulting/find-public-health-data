import { expect, test } from '@playwright/test';

import { expectNoAccessibilityViolations } from '../support/accessibility.js';

test.describe('with nothing selected', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/indicators');
  });

  test('shows the indicator selection', async ({ page }) => {
    await expect(
      page.getByRole('heading', { level: 1, name: 'Selected indicators' }),
    ).toBeVisible();
  });

  test('has no WCAG 2.2 AA violations', async ({ page }, testInfo) => {
    await expectNoAccessibilityViolations(page, testInfo);
  });
});

test.describe('searching', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/indicators?searchSubject=smoking');
  });

  test('lists the matching indicators', async ({ page }) => {
    await expect(
      page.getByRole('heading', { level: 1, name: 'Search results for “smoking”' }),
    ).toBeVisible();
  });

  test('has no WCAG 2.2 AA violations', async ({ page }, testInfo) => {
    await expectNoAccessibilityViolations(page, testInfo);
  });
});
