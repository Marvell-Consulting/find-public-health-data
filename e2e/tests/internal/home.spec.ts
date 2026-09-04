import { expect, test } from '@playwright/test';

import { expectNoAccessibilityViolations } from '../support/accessibility.js';
import { signInAs } from '../support/sign-in.js';

test.describe('as a viewer', () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, 'Sam Taylor');
    await page.goto('/');
  });

  test('serves the home page without the manage link', async ({ page }) => {
    await expect(
      page.getByRole('heading', { level: 1, name: 'Find public health data' }),
    ).toBeVisible();
    const navigation = page.getByRole('navigation', { name: 'Menu' });
    await expect(navigation.getByRole('link', { name: 'Topics' })).toBeVisible();
    await expect(navigation.getByRole('link', { name: 'Manage data' })).toHaveCount(0);
  });

  test('has no WCAG 2.2 AA violations', async ({ page }, testInfo) => {
    await expectNoAccessibilityViolations(page, testInfo);
  });
});

test.describe('as a publisher', () => {
  test('offers the manage link in the navigation', async ({ page }) => {
    await signInAs(page, 'Riley Singh');
    const navigation = page.getByRole('navigation', { name: 'Menu' });

    await navigation.getByRole('link', { name: 'Manage data' }).click();

    await expect(page).toHaveURL('/manage');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Manage public health data' }),
    ).toBeVisible();
  });
});
