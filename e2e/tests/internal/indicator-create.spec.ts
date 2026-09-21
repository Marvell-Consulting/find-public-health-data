import { expect, type Page, test } from '@playwright/test';

import { expectNoAccessibilityViolations } from '../support/accessibility.ts';
import { signInAs } from '../support/sign-in.ts';

// Every indicator created here carries a name no other spec or run uses, so the shared seeded
// database is only ever added to and each test asserts on the row it made itself.
function uniqueName() {
  return `E2E indicator ${test.info().parallelIndex} ${Date.now().toString(36)}`;
}

async function openNamePage(page: Page) {
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Create new indicator' }).click();
  await expect(page).toHaveURL('/dashboard/indicators/new');
}

test.beforeEach(async ({ page }) => {
  await signInAs(page, 'Riley Singh');
});

test('starts the journey from the indicator dashboard', async ({ page }) => {
  await openNamePage(page);

  await expect(
    page.getByRole('heading', { level: 1, name: 'What is the name of the indicator?' }),
  ).toBeVisible();
  await expect(
    page.getByText('The name should be unique, descriptive and written in plain English.'),
  ).toBeVisible();
});

test('asks for a name when Continue is selected with the box empty', async ({ page }) => {
  await openNamePage(page);
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL('/dashboard/indicators/new');
  const summary = page.getByRole('alert');
  await expect(summary.getByRole('link')).toHaveText(['Enter the name of the indicator']);

  await summary.getByRole('link', { name: 'Enter the name of the indicator' }).click();
  await expect(page.getByLabel('What is the name of the indicator?')).toBeFocused();
});

test('creates the indicator and shows it as incomplete on its overview page', async ({ page }) => {
  const name = uniqueName();

  await openNamePage(page);
  await page.getByLabel('What is the name of the indicator?').fill(name);
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL(/\/dashboard\/indicators\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  await expect(page.getByText('Incomplete')).toBeVisible();
});

test('leaves an indicator abandoned before submission on the dashboard', async ({ page }) => {
  const name = uniqueName();

  await openNamePage(page);
  await page.getByLabel('What is the name of the indicator?').fill(name);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();

  await page.getByRole('link', { name: 'Back to indicators' }).click();

  await expect(page).toHaveURL('/dashboard');
  await expect(page.getByRole('link', { name })).toBeVisible();
});

test('has no WCAG 2.2 AA violations', async ({ page }, testInfo) => {
  await openNamePage(page);
  await expectNoAccessibilityViolations(page, testInfo);
});

test('has no WCAG 2.2 AA violations when the submission is rejected', async ({
  page,
}, testInfo) => {
  await openNamePage(page);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('alert')).toContainText('Enter the name of the indicator');

  await expectNoAccessibilityViolations(page, testInfo);
});
