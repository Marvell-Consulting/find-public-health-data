import { expect, test } from '@playwright/test';

import { expectNoAccessibilityViolations } from '../support/accessibility.ts';
import { signInAs } from '../support/sign-in.ts';

test.beforeEach(async ({ page }) => {
  await signInAs(page, 'Sam Taylor');
  await page.goto('/search');
});

test('shows the search page to a publisher', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1, name: 'Search for data' })).toBeVisible();
});

test('has no WCAG 2.2 AA violations', async ({ page }, testInfo) => {
  await page.getByRole('heading', { level: 1, name: 'Search for data' }).waitFor();
  await expectNoAccessibilityViolations(page, testInfo);
});
