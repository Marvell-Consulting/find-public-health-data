import { expect, type Page, test } from '@playwright/test';

import { expectNoAccessibilityViolations } from '../support/accessibility.ts';
import { createIndicator, uniqueIndicatorName } from '../support/create-indicator.ts';
import { MORTALITY_ID } from '../support/indicator-page.ts';
import { signInAs } from '../support/sign-in.ts';

const DEFINITION = 'What is the definition of this indicator?';
const RATIONALE = 'What is the rationale for this indicator?';

// The header and footer have lists of their own, so the task row is read inside the page.
function taskRow(page: Page) {
  return page
    .getByRole('main')
    .getByRole('listitem')
    .filter({ hasText: 'Definition and rationale' })
    .first();
}

/** A new draft's definition and rationale page, opened from its task list. */
async function openPage(page: Page): Promise<string> {
  await createIndicator(page, uniqueIndicatorName('definition'));
  const taskListPath = new URL(page.url()).pathname;

  await taskRow(page).getByRole('link').click();
  await expect(page).toHaveURL(/\/publish\/indicators\/[0-9a-f-]{36}\/definition-and-rationale$/);

  return taskListPath;
}

test.beforeEach(async ({ page }) => {
  await signInAs(page, 'Riley Singh');
});

test('is reached from the task list, where it starts as not started', async ({ page }) => {
  await createIndicator(page, uniqueIndicatorName('definition'));
  await expect(taskRow(page)).toContainText('Not started');

  await taskRow(page).getByRole('link').click();

  await expect(
    page.getByRole('heading', { level: 1, name: 'Definition and rationale' }),
  ).toBeVisible();
  await expect(page.getByLabel(DEFINITION)).toBeEmpty();
  await expect(page.getByLabel(RATIONALE)).toBeEmpty();
});

test('asks for both answers when Continue is selected with the form empty', async ({ page }) => {
  await openPage(page);
  const pagePath = new URL(page.url()).pathname;

  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL(pagePath);
  await expect(page).toHaveTitle(/^Error: /);
  const summary = page.getByRole('alert');
  await expect(summary.getByRole('link')).toHaveText([
    'Enter the definition of the indicator',
    'Enter the rationale for the indicator',
  ]);

  await summary.getByRole('link', { name: 'Enter the rationale for the indicator' }).click();
  await expect(page.getByLabel(RATIONALE)).toBeFocused();
});

test('saves nothing until both are answered, keeping what was typed', async ({ page }) => {
  await openPage(page);
  const pagePath = new URL(page.url()).pathname;

  await page.getByLabel(DEFINITION).fill('A definition on its own');
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByRole('alert').getByRole('link')).toHaveText([
    'Enter the rationale for the indicator',
  ]);
  await expect(page.getByLabel(DEFINITION)).toHaveValue('A definition on its own');

  await page.goto(pagePath);
  await expect(page.getByLabel(DEFINITION)).toBeEmpty();
});

test('saves both answers on Continue and shows the task as completed', async ({ page }) => {
  const taskListPath = await openPage(page);

  await page.getByLabel(DEFINITION).fill('  The average number of years a newborn would live.  ');
  await page.getByLabel(RATIONALE).fill('A summary measure of mortality.');
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL(taskListPath);
  await expect(taskRow(page)).toContainText('Completed');

  await taskRow(page).getByRole('link').click();
  await expect(page.getByLabel(DEFINITION)).toHaveValue(
    'The average number of years a newborn would live.',
  );
  await expect(page.getByLabel(RATIONALE)).toHaveValue('A summary measure of mortality.');
});

test('goes back to the task list', async ({ page }) => {
  const taskListPath = await openPage(page);

  await page.getByRole('link', { name: 'Back', exact: true }).click();

  await expect(page).toHaveURL(taskListPath);
});

test('answers an indicator with no draft with the not-found page', async ({ page }) => {
  for (const path of [
    '/publish/indicators/108/definition-and-rationale',
    '/publish/indicators/00000000-0000-7000-8000-000000000000/definition-and-rationale',
    // The seeded indicator is published, so it has no draft to answer for.
    `/publish/indicators/${MORTALITY_ID}/definition-and-rationale`,
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
  await expect(page.getByRole('alert')).toContainText('Enter the definition of the indicator');

  await expectNoAccessibilityViolations(page, testInfo);
});
