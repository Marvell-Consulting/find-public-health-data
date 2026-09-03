import { expect, test } from '@playwright/test';

import { expectNoAccessibilityViolations } from '../support/accessibility.js';
import { signInAs } from '../support/sign-in.js';

test.beforeEach(async ({ page }) => {
  await signInAs(page, 'Sam Taylor');
  await page.goto('/topics');
});

test('lists the public health topics to a viewer', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1, name: 'Public health topics' })).toBeVisible();
});

test('has no WCAG 2.2 AA violations', async ({ page }, testInfo) => {
  await expectNoAccessibilityViolations(page, testInfo);
});
