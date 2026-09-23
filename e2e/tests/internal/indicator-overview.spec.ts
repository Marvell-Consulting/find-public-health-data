import { expect, test } from '@playwright/test';

import { expectNoAccessibilityViolations } from '../support/accessibility.ts';
import { createIndicator, uniqueIndicatorName } from '../support/create-indicator.ts';
import { MORTALITY_ID, MORTALITY_NAME } from '../support/indicator-page.ts';
import { signInAs } from '../support/sign-in.ts';

const PUBLISHED_OVERVIEW_PATH = `/dashboard/indicators/${MORTALITY_ID}`;

test.beforeEach(async ({ page }) => {
  await signInAs(page, 'Riley Singh');
});

test('shows the indicator a publisher picked from the dashboard', async ({ page }) => {
  const name = uniqueIndicatorName('overview');
  const id = await createIndicator(page, name);

  await page.goto('/dashboard');
  await page.getByRole('table').getByRole('link', { name, exact: true }).click();

  await expect(page).toHaveURL(`/dashboard/indicators/${id}`);
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  await expect(page.getByText(/^ID: \d+$/)).toBeVisible();
});

test('shows a published indicator as live and published', async ({ page }) => {
  await page.goto(PUBLISHED_OVERVIEW_PATH);

  await expect(page.getByRole('heading', { level: 1, name: MORTALITY_NAME })).toBeVisible();
  // The tags follow the public number, under the heading.
  await expect(page.getByRole('main').locator('h1 ~ p .govuk-tag')).toHaveText([
    'Indicator status: Live indicator',
    'Publishing status: Published',
  ]);
});

test('opens the published indicator from the actions tab', async ({ page }) => {
  await page.goto(PUBLISHED_OVERVIEW_PATH);

  await expect(page.getByRole('tab', { name: 'Actions' })).toBeVisible();
  await page.getByRole('link', { name: 'View published indicator' }).click();

  await expect(page).toHaveURL(/\/indicators\/[a-z0-9-]+$/);
  await expect(page.getByRole('heading', { level: 1, name: MORTALITY_NAME })).toBeVisible();
});

test('goes back to the dashboard', async ({ page }) => {
  await page.goto(PUBLISHED_OVERVIEW_PATH);

  await page.getByRole('link', { name: 'Back', exact: true }).click();

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

test('has no WCAG 2.2 AA violations for a draft', async ({ page }, testInfo) => {
  const name = uniqueIndicatorName('overview');
  const id = await createIndicator(page, name);

  await page.goto(`/dashboard/indicators/${id}`);
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();

  await expectNoAccessibilityViolations(page, testInfo);
});

test('has no WCAG 2.2 AA violations for a published indicator', async ({ page }, testInfo) => {
  await page.goto(PUBLISHED_OVERVIEW_PATH);
  await expect(page.getByRole('heading', { level: 1, name: MORTALITY_NAME })).toBeVisible();

  await expectNoAccessibilityViolations(page, testInfo);
});
