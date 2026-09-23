import { expect, type Page, test } from '@playwright/test';

import { expectNoAccessibilityViolations } from '../support/accessibility.ts';
import { createIndicator, uniqueIndicatorName } from '../support/create-indicator.ts';
import { MORTALITY_ID } from '../support/indicator-page.ts';
import { signInAs } from '../support/sign-in.ts';

const QUESTION = 'What is the polarity of this indicator?';

// The header and footer have lists of their own, so the task row is read inside the page.
function taskRow(page: Page) {
  return page.getByRole('main').getByRole('listitem').filter({ hasText: 'Polarity' }).first();
}

/** A new draft's polarity page, opened from its task list. */
async function openPage(page: Page): Promise<string> {
  await createIndicator(page, uniqueIndicatorName('polarity'));
  const taskListPath = new URL(page.url()).pathname;

  await taskRow(page).getByRole('link').click();
  await expect(page).toHaveURL(/\/publish\/indicators\/[0-9a-f-]{36}\/polarity$/);

  return taskListPath;
}

test.beforeEach(async ({ page }) => {
  await signInAs(page, 'Riley Singh');
});

test('is reached from the task list, where it starts as not started', async ({ page }) => {
  await createIndicator(page, uniqueIndicatorName('polarity'));
  await expect(taskRow(page)).toContainText('Not started');

  await taskRow(page).getByRole('link').click();

  await expect(page.getByRole('heading', { level: 1, name: QUESTION })).toBeVisible();
  const options = page.getByRole('group', { name: QUESTION }).getByRole('radio');
  await expect(options).toHaveCount(4);
  for (const option of await options.all()) {
    await expect(option).not.toBeChecked();
  }
});

test('asks for a polarity when Continue is selected with none chosen', async ({ page }) => {
  await openPage(page);
  const pagePath = new URL(page.url()).pathname;

  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL(pagePath);
  await expect(page).toHaveTitle(/^Error: /);
  const summary = page.getByRole('alert');
  await expect(summary.getByRole('link')).toHaveText(['Select the polarity of the indicator']);

  await summary.getByRole('link').click();
  await expect(page.getByLabel('Higher is better')).toBeFocused();
});

test('saves the polarity on Continue and shows the task as completed', async ({ page }) => {
  const taskListPath = await openPage(page);

  await page.getByLabel('Lower is better').check();
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL(taskListPath);
  await expect(taskRow(page)).toContainText('Completed');

  await taskRow(page).getByRole('link').click();
  await expect(page.getByLabel('Lower is better')).toBeChecked();
});

test('goes back to the task list', async ({ page }) => {
  const taskListPath = await openPage(page);

  await page.getByRole('link', { name: 'Back', exact: true }).click();

  await expect(page).toHaveURL(taskListPath);
});

test('answers an indicator with no draft with the not-found page', async ({ page }) => {
  for (const path of [
    '/publish/indicators/108/polarity',
    '/publish/indicators/00000000-0000-7000-8000-000000000000/polarity',
    // The seeded indicator is published, so it has no draft to answer for.
    `/publish/indicators/${MORTALITY_ID}/polarity`,
  ]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(404);
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
  }
});

test('has no WCAG 2.2 AA violations', async ({ page }, testInfo) => {
  await openPage(page);

  await expectNoAccessibilityViolations(page, testInfo);
});

test('has no WCAG 2.2 AA violations when the submission is rejected', async ({
  page,
}, testInfo) => {
  await openPage(page);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('alert')).toContainText('Select the polarity of the indicator');

  await expectNoAccessibilityViolations(page, testInfo);
});
