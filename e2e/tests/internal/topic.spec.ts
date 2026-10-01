import { expect, test } from '@playwright/test';

import { expectNoAccessibilityViolations } from '../support/accessibility.ts';
import { PUBLISHER } from '../support/sign-in.ts';

test.use({ storageState: PUBLISHER.storageState });

test.beforeEach(async ({ page }) => {
  await page.goto('/topics/alcohol');
});

test('shows a topic to a publisher', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1, name: 'Alcohol' })).toBeVisible();
});

test('has no WCAG 2.2 AA violations', async ({ page }, testInfo) => {
  await expectNoAccessibilityViolations(page, testInfo);
});
