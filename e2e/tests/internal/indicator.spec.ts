import { expect, test } from '@playwright/test';

import { expectNoAccessibilityViolations } from '../support/accessibility.ts';
import { MORTALITY_PATH } from '../support/indicator-page.ts';
import { PUBLISHER } from '../support/sign-in.ts';

test.use({ storageState: PUBLISHER.storageState });

test.beforeEach(async ({ page }) => {
  await page.goto(MORTALITY_PATH);
});

test('shows an indicator to a publisher', async ({ page }) => {
  await expect(
    page.getByRole('heading', { level: 1, name: 'Under 75 mortality rate from all causes' }),
  ).toBeVisible();
});

test('has no WCAG 2.2 AA violations', async ({ page }, testInfo) => {
  await expectNoAccessibilityViolations(page, testInfo);
});
