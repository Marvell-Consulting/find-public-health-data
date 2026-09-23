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
  await expect(page).toHaveURL('/publish/indicators/new');
}

/** Names a new indicator and leaves the publisher on its task list, as Continue does. */
async function createIndicator(page: Page, name: string) {
  await openNamePage(page);
  await page.getByLabel('What is the name of the indicator?').fill(name);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(/\/publish\/indicators\/[0-9a-f-]{36}\/task-list$/);
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

/** The id of the indicator whose page the publisher is on. */
function indicatorIdFrom(page: Page): string {
  const [, id] = new URL(page.url()).pathname.match(/([0-9a-f-]{36})/) ?? [];
  if (id === undefined) throw new Error(`no indicator id in ${page.url()}`);
  return id;
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

  await expect(page).toHaveURL('/publish/indicators/new');
  const summary = page.getByRole('alert');
  await expect(summary.getByRole('link')).toHaveText(['Enter the name of the indicator']);

  await summary.getByRole('link', { name: 'Enter the name of the indicator' }).click();
  await expect(page.getByLabel('What is the name of the indicator?')).toBeFocused();
});

test('creates the indicator and shows its task list', async ({ page }) => {
  const name = uniqueName();

  await createIndicator(page, name);

  await expect(page.getByRole('link', { name: 'Name' })).toBeVisible();
});

test('shows a draft indicator on the dashboard', async ({ page }) => {
  const name = uniqueName();

  await createIndicator(page, name);
  await page.getByRole('link', { name: 'Back', exact: true }).click();
  await page.getByRole('link', { name: 'Back to indicators' }).click();

  await expect(page).toHaveURL('/dashboard');
  await expect(page.getByRole('link', { name })).toBeVisible();
});

test('refuses a name another indicator already holds', async ({ page }) => {
  const name = uniqueName();
  await createIndicator(page, name);

  await openNamePage(page);
  await page.getByLabel('What is the name of the indicator?').fill(name);
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL('/publish/indicators/new');
  await expect(page.getByRole('alert')).toContainText('An indicator with this name already exists');
  await expect(page.getByLabel('What is the name of the indicator?')).toHaveValue(name);
});

test('renames a draft from its name page', async ({ page }) => {
  const name = uniqueName();
  await createIndicator(page, name);
  const taskListPath = new URL(page.url()).pathname;
  const id = indicatorIdFrom(page);

  await page.goto(`/publish/indicators/${id}/name`);
  const field = page.getByLabel('What is the name of the indicator?');
  await expect(field).toHaveValue(name);

  await field.fill(`${name} renamed`);
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL(taskListPath);
  await expect(page.getByRole('heading', { level: 1, name: `${name} renamed` })).toBeVisible();
});

test('goes back to the task list from its name page', async ({ page }) => {
  await createIndicator(page, uniqueName());
  const taskListPath = new URL(page.url()).pathname;
  const id = indicatorIdFrom(page);

  await page.goto(`/publish/indicators/${id}/name`);
  await page.getByRole('link', { name: 'Back to task list' }).click();

  await expect(page).toHaveURL(taskListPath);
});

test('answers a name page with nothing to rename with the not-found page', async ({ page }) => {
  for (const path of [
    '/publish/indicators/108/name',
    '/publish/indicators/00000000-0000-7000-8000-000000000000/name',
    // The seeded indicator is published, so it has no draft whose name can be edited.
    '/publish/indicators/019fa38f-1346-7094-b773-79dcd43ae4b4/name',
  ]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(404);
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
  }
});

test('has no WCAG 2.2 AA violations', async ({ page }, testInfo) => {
  await openNamePage(page);
  await expectNoAccessibilityViolations(page, testInfo);
});

test('has no WCAG 2.2 AA violations when renaming a draft', async ({ page }, testInfo) => {
  await createIndicator(page, uniqueName());
  const id = indicatorIdFrom(page);

  await page.goto(`/publish/indicators/${id}/name`);
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
