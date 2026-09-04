import { expect, test } from '@playwright/test';

import { expectNoAccessibilityViolations } from '../support/accessibility.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/topics');
});

test('lists the public health topics', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1, name: 'Public health topics' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Alcohol' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Smoking and tobacco' })).toBeVisible();
});

test('opens a topic from its card', async ({ page }) => {
  await page.getByRole('link', { name: 'Smoking and tobacco' }).click();
  await expect(page).toHaveURL('/topics/smoking-and-tobacco');
  await expect(page.getByRole('heading', { level: 1, name: 'Smoking and tobacco' })).toBeVisible();
});

test('has no WCAG 2.2 AA violations', async ({ page }, testInfo) => {
  await expectNoAccessibilityViolations(page, testInfo);
});
