import { expect, test } from '@playwright/test';

import { expectNoAccessibilityViolations } from '../support/accessibility.js';
import { submitSignIn } from '../support/sign-in.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/sign-in');
});

test('offers the fake sign-in', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Alex Morgan' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Sam Taylor' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Riley Singh' })).toBeVisible();
});

test('signs in, shows the account, and signs out', async ({ page }) => {
  const navigation = page.getByRole('navigation', { name: 'Menu' });
  await expect(navigation.getByRole('link', { name: 'Sign in' })).toBeVisible();

  await submitSignIn(page, 'Alex Morgan');

  await expect(page).toHaveURL('/');
  await expect(navigation.getByRole('link', { name: 'Account' })).toBeVisible();
  await expect(navigation.getByRole('link', { name: 'Sign in' })).toHaveCount(0);

  await navigation.getByRole('link', { name: 'Account' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Your account' })).toBeVisible();
  await expect(page.getByText('You are signed in as Alex Morgan')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Continue to the service' })).toHaveAttribute(
    'href',
    '/',
  );

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL('/sign-in');
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
  await expect(navigation.getByRole('link', { name: 'Sign in' })).toBeVisible();
});

test('returns to the page that was asked for', async ({ page }) => {
  await page.goto('/sign-in?returnTo=%2Ftopics');
  await submitSignIn(page, 'Alex Morgan');
  await expect(page).toHaveURL('/topics');
});

test('ignores a return address on another site', async ({ page }) => {
  await page.goto('/sign-in?returnTo=https%3A%2F%2Fexample.com%2F');
  await submitSignIn(page, 'Alex Morgan');
  await expect(page).toHaveURL('/');
});

test('has no WCAG 2.2 AA violations', async ({ page }, testInfo) => {
  await expectNoAccessibilityViolations(page, testInfo);
});

test('has no WCAG 2.2 AA violations when signed in', async ({ page }, testInfo) => {
  await submitSignIn(page, 'Alex Morgan');
  await page.goto('/sign-in');
  await expect(page.getByRole('heading', { level: 1, name: 'Your account' })).toBeVisible();
  await expectNoAccessibilityViolations(page, testInfo);
});
