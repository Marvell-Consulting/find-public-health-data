import { expect, test } from '@playwright/test';

import { expectNoAccessibilityViolations } from '../support/accessibility.js';
import { signInAs } from '../support/sign-in.js';

test.beforeEach(async ({ page }) => {
  await signInAs(page, 'Riley Singh');
  await page.goto('/dashboard');
});

// The seed holds more indicators than one page, and specs only ever add to it.
test('lists a page of indicators for a publisher', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1, name: 'Indicators' })).toBeVisible();

  const rows = page.getByRole('table').getByRole('row');

  await expect(rows).toHaveCount(11);
  await expect(rows.first().getByRole('columnheader')).toHaveText([
    'Indicator name',
    'Last edited',
    'Indicator status',
    'Publishing status',
  ]);
});

test('moves between pages', async ({ page }) => {
  await page.getByRole('link', { name: 'Next page' }).click();

  await expect(page).toHaveURL('/dashboard?page=2');
  await expect(page.getByRole('table').getByRole('row').nth(1)).toBeVisible();

  await page.getByRole('link', { name: 'Previous page' }).click();

  await expect(page).toHaveURL('/dashboard');
});

test('has no WCAG 2.2 AA violations', async ({ page }, testInfo) => {
  await expectNoAccessibilityViolations(page, testInfo);
});
