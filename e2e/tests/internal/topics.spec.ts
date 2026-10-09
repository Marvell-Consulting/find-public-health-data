import { expect, test } from '@playwright/test';

import { expectNoAccessibilityViolations } from '../support/accessibility.ts';
import { PUBLISHER } from '../support/sign-in.ts';

test.use({ storageState: PUBLISHER.storageState });

test.beforeEach(async ({ page }) => {
  await page.goto('/topics');
});

test('lists the public health topics to a publisher', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1, name: 'Public health topics' })).toBeVisible();
});

test('has no WCAG 2.2 AA violations', async ({ page }, testInfo) => {
  await expectNoAccessibilityViolations(page, testInfo);
});

test('filters and highlights topics for a publisher', async ({ page }, testInfo) => {
  await page.getByRole('searchbox', { name: 'Search for topics' }).fill('quitting');

  await expect(page.getByRole('main').getByRole('heading', { level: 2 })).toHaveText(
    'Smoking and tobacco',
  );
  await expect(page.locator('.fphd-card-list__description mark')).toHaveText('quitting');
  await expectNoAccessibilityViolations(page, testInfo);
});
