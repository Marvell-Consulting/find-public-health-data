import { expect, type Page, test } from '@playwright/test';

import { expectNoAccessibilityViolations } from '../support/accessibility.js';
import { signInAs } from '../support/sign-in.js';

// The dashboard orders by last edit, so the first row is whichever indicator that is; the
// overview is reached the way a publisher reaches it, and its name read off the link.
async function openFirstIndicator(page: Page): Promise<string> {
  await page.goto('/dashboard');
  const link = page.getByRole('table').getByRole('rowheader').first().getByRole('link');
  const name = await link.innerText();

  await link.click();
  await expect(page).toHaveURL(/\/dashboard\/indicators\/[0-9a-f-]{36}$/);

  return name;
}

test.beforeEach(async ({ page }) => {
  await signInAs(page, 'Riley Singh');
});

test('shows the indicator a publisher picked from the dashboard', async ({ page }) => {
  const name = await openFirstIndicator(page);

  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  await expect(page.getByText('Indicator number')).toBeVisible();
  await expect(page.getByText('Web address')).toBeVisible();
  await expect(page.getByText('Approved')).toBeVisible();
});

test('opens the published indicator from the actions tab', async ({ page }) => {
  const name = await openFirstIndicator(page);

  await expect(page.getByRole('tab', { name: 'Actions' })).toBeVisible();
  await page.getByRole('link', { name: 'View published indicator' }).click();

  await expect(page).toHaveURL(/\/indicators\/[a-z0-9-]+$/);
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
});

test('goes back to the dashboard', async ({ page }) => {
  await openFirstIndicator(page);

  await page.getByRole('link', { name: 'Back to indicators' }).click();

  await expect(page).toHaveURL('/dashboard');
});

test('answers an indicator that does not exist with the not-found page', async ({ page }) => {
  for (const path of [
    '/dashboard/indicators/108',
    '/dashboard/indicators/00000000-0000-7000-8000-000000000000',
  ]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(404);
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
  }
});

test('has no WCAG 2.2 AA violations', async ({ page }, testInfo) => {
  await openFirstIndicator(page);
  await expectNoAccessibilityViolations(page, testInfo);
});
