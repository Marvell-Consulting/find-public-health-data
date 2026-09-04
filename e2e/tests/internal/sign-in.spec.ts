import { expect, test } from '@playwright/test';

import { expectNoAccessibilityViolations } from '../support/accessibility.js';
import { signInAs, submitSignIn } from '../support/sign-in.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/sign-in');
});

test('offers the internal users only', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Sam Taylor' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Riley Singh' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Alex Morgan' })).toHaveCount(0);
});

test('sends a visitor without a session to sign in, then back to the page they wanted', async ({
  page,
}) => {
  await page.goto('/topics');
  await expect(page).toHaveURL('/sign-in?returnTo=%2Ftopics');

  await submitSignIn(page, 'Sam Taylor');

  await expect(page).toHaveURL('/topics');
  await expect(page.getByRole('heading', { level: 1, name: 'Public health topics' })).toBeVisible();
});

test('shows the account and signs out', async ({ page }) => {
  await signInAs(page, 'Sam Taylor');
  const navigation = page.getByRole('navigation', { name: 'Menu' });

  await navigation.getByRole('link', { name: 'Account' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Your account' })).toBeVisible();
  await expect(page.getByText('You are signed in as Sam Taylor')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Continue to the service' })).toBeVisible();

  await page.getByRole('button', { name: 'Sign out' }).click();

  await expect(page).toHaveURL('/sign-in');
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
  await page.goto('/');
  await expect(page).toHaveURL('/sign-in?returnTo=%2F');
});

test('has no WCAG 2.2 AA violations', async ({ page }, testInfo) => {
  await expectNoAccessibilityViolations(page, testInfo);
});

test('has no WCAG 2.2 AA violations when signed in', async ({ page }, testInfo) => {
  await signInAs(page, 'Sam Taylor');
  await page.goto('/sign-in');
  await expect(page.getByRole('heading', { level: 1, name: 'Your account' })).toBeVisible();
  await expectNoAccessibilityViolations(page, testInfo);
});
