import { expect, test } from '@playwright/test';

import { expectNoAccessibilityViolations } from '../support/accessibility.js';
import { signInAs } from '../support/sign-in.js';

test.describe('as a publisher', () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, 'Riley Singh');
    await page.goto('/');
  });

  test('lands on the dashboard', async ({ page }) => {
    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByRole('heading', { level: 1, name: 'Indicators' })).toBeVisible();
  });

  test('links the service name straight to the dashboard', async ({ page }) => {
    await page.goto('/manage');
    const serviceLink = page.getByRole('link', { name: 'Find public health data' });

    await expect(serviceLink).toHaveAttribute('href', '/dashboard');
    await serviceLink.click();

    await expect(page).toHaveURL('/dashboard');
  });

  test('offers the internal navigation', async ({ page }) => {
    const navigation = page.getByRole('navigation', { name: 'Menu' });

    await expect(navigation.getByRole('link')).toHaveText(['Manage', 'Account']);

    await navigation.getByRole('link', { name: 'Manage' }).click();

    await expect(page).toHaveURL('/manage');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Manage public health data' }),
    ).toBeVisible();
  });

  test('has no WCAG 2.2 AA violations where it lands', async ({ page }, testInfo) => {
    await expect(page).toHaveURL('/dashboard');
    await expectNoAccessibilityViolations(page, testInfo);
  });
});

test.describe('as a viewer', () => {
  test.beforeEach(async ({ page }) => {
    await signInAs(page, 'Sam Taylor');
    await page.goto('/');
  });

  test('is turned away from the dashboard', async ({ page }) => {
    await expect(page).toHaveURL('/access-denied');
  });

  test('hides the manage link', async ({ page }) => {
    const navigation = page.getByRole('navigation', { name: 'Menu' });

    await expect(navigation.getByRole('link')).toHaveText(['Account']);
  });
});

test('sends a visitor without a session on to sign in for the dashboard', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL('/sign-in?returnTo=%2Fdashboard');
});
