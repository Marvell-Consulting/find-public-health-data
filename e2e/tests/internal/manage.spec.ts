import { expect, test } from '@playwright/test';

import { expectNoAccessibilityViolations } from '../support/accessibility.js';
import { signInAs, submitSignIn } from '../support/sign-in.js';

// Proof of life for internal-web: the fake sign-in is drivable, the session survives the
// redirect back, and the publisher-gated route renders — the wiring every internal test needs.
test('bounces to sign-in and returns a publisher to the manage page', async ({ page }) => {
  await page.goto('/manage');
  await expect(page).toHaveURL('/sign-in?returnTo=%2Fmanage');
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();

  await submitSignIn(page, 'Riley Singh');

  await expect(page).toHaveURL('/manage');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Manage public health data' }),
  ).toBeVisible();
});

test('links to topic administration', async ({ page }) => {
  await signInAs(page, 'Riley Singh');
  await page.goto('/manage');

  await page.getByRole('link', { name: 'Manage topics' }).click();

  await expect(page).toHaveURL('/manage/topics');
  await expect(page.getByRole('heading', { level: 1, name: 'Manage topics' })).toBeVisible();
});

test('has no WCAG 2.2 AA violations', async ({ page }, testInfo) => {
  await signInAs(page, 'Riley Singh');
  await page.goto('/manage');
  await expectNoAccessibilityViolations(page, testInfo);
});
