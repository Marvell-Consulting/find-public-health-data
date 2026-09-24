import { expect, type Page, test } from '@playwright/test';

import { expectNoAccessibilityViolations } from '../support/accessibility.ts';
import { createIndicator, uniqueIndicatorName } from '../support/create-indicator.ts';
import { MORTALITY_ID } from '../support/indicator-page.ts';
import { signInAs } from '../support/sign-in.ts';

const METHODOLOGY = 'Enter methodology';
const OHID = 'Office for Health Improvement and Disparities';
const DHSC = 'Department of Health and Social Care';
const OTHER = 'Other organisation or organisations';
const DETAILS = 'Enter details of the other organisation or organisations';

// The header and footer have lists of their own, so the task row is read inside the page.
function taskRow(page: Page) {
  return page
    .getByRole('main')
    .getByRole('listitem')
    .filter({ hasText: 'How the indicator was calculated' })
    .first();
}

/** A new draft's calculation page, opened from its task list. */
async function openPage(page: Page): Promise<string> {
  await createIndicator(page, uniqueIndicatorName('calculation'));
  const taskListPath = new URL(page.url()).pathname;

  await taskRow(page).getByRole('link').click();
  await expect(page).toHaveURL(/\/publish\/indicators\/[0-9a-f-]{36}\/calculation$/);

  return taskListPath;
}

async function submitOtherWithoutDetails(page: Page) {
  await page.getByLabel(METHODOLOGY, { exact: true }).fill('Directly age-standardised rates.');
  await page.getByLabel(OTHER, { exact: true }).check();
  await page.getByRole('button', { name: 'Continue' }).click();
}

test.beforeEach(async ({ page }) => {
  await signInAs(page, 'Riley Singh');
});

test('is reached from the task list, where it starts as not started', async ({ page }) => {
  await createIndicator(page, uniqueIndicatorName('calculation'));
  await expect(taskRow(page)).toContainText('Not started');

  await taskRow(page).getByRole('link').click();

  await expect(
    page.getByRole('heading', { level: 1, name: 'How was the indicator calculated?' }),
  ).toBeVisible();
  await expect(page.getByLabel(METHODOLOGY, { exact: true })).toBeEmpty();
  for (const option of [OHID, DHSC, OTHER]) {
    await expect(page.getByLabel(option, { exact: true })).not.toBeChecked();
  }
});

test('asks for the methodology and who calculated it when Continue is selected with the form empty', async ({
  page,
}) => {
  await openPage(page);
  const pagePath = new URL(page.url()).pathname;

  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL(pagePath);
  await expect(page).toHaveTitle(/^Error: /);
  const summary = page.getByRole('alert');
  await expect(summary.getByRole('link')).toHaveText([
    'Enter the methodology',
    'Select who calculated the indicator',
  ]);

  await summary.getByRole('link', { name: 'Select who calculated the indicator' }).click();
  await expect(page.getByLabel(OHID, { exact: true })).toBeFocused();
});

test('reveals the other organisations only while "Other" is chosen', async ({ page }) => {
  await openPage(page);

  await expect(page.getByLabel(DETAILS, { exact: true })).toBeHidden();

  await page.getByLabel(OTHER, { exact: true }).check();
  await expect(page.getByLabel(DETAILS, { exact: true })).toBeVisible();

  await page.getByLabel(DHSC, { exact: true }).check();
  await expect(page.getByLabel(DETAILS, { exact: true })).toBeHidden();
});

test('asks for the other organisations when "Other" is chosen without them', async ({ page }) => {
  await openPage(page);

  await submitOtherWithoutDetails(page);

  const summary = page.getByRole('alert');
  await expect(summary.getByRole('link')).toHaveText([DETAILS]);
  await expect(page.getByLabel(OTHER, { exact: true })).toBeChecked();
  await expect(page.getByLabel(METHODOLOGY, { exact: true })).toHaveValue(
    'Directly age-standardised rates.',
  );

  await summary.getByRole('link', { name: DETAILS }).click();
  await expect(page.getByLabel(DETAILS, { exact: true })).toBeFocused();
});

test('saves nothing until every answer is given', async ({ page }) => {
  await openPage(page);
  const pagePath = new URL(page.url()).pathname;

  await submitOtherWithoutDetails(page);
  await expect(page.getByRole('alert')).toBeVisible();

  await page.goto(pagePath);
  await expect(page.getByLabel(METHODOLOGY, { exact: true })).toBeEmpty();
  await expect(page.getByLabel(OTHER, { exact: true })).not.toBeChecked();
});

test('saves every answer with "Other" on Continue and shows the task as completed', async ({
  page,
}) => {
  const taskListPath = await openPage(page);

  await page.getByLabel(METHODOLOGY, { exact: true }).fill('  Directly age-standardised rates.  ');
  await page.getByLabel(OTHER, { exact: true }).check();
  await page.getByLabel(DETAILS, { exact: true }).fill(' Office for National Statistics ');
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL(taskListPath);
  await expect(taskRow(page)).toContainText('Completed');

  await taskRow(page).getByRole('link').click();
  await expect(page.getByLabel(METHODOLOGY, { exact: true })).toHaveValue(
    'Directly age-standardised rates.',
  );
  await expect(page.getByLabel(OTHER, { exact: true })).toBeChecked();
  await expect(page.getByLabel(DETAILS, { exact: true })).toHaveValue(
    'Office for National Statistics',
  );
});

test('forgets the other organisations once OHID or DHSC is chosen instead', async ({ page }) => {
  await openPage(page);
  const pagePath = new URL(page.url()).pathname;
  await page.getByLabel(METHODOLOGY, { exact: true }).fill('Directly age-standardised rates.');
  await page.getByLabel(OTHER, { exact: true }).check();
  await page.getByLabel(DETAILS, { exact: true }).fill('Office for National Statistics');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(taskRow(page)).toContainText('Completed');

  await page.goto(pagePath);
  await page.getByLabel(OHID, { exact: true }).check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(taskRow(page)).toContainText('Completed');

  await page.goto(pagePath);
  await expect(page.getByLabel(OHID, { exact: true })).toBeChecked();
  await page.getByLabel(OTHER, { exact: true }).check();
  await expect(page.getByLabel(DETAILS, { exact: true })).toBeEmpty();
});

test('goes back to the task list', async ({ page }) => {
  const taskListPath = await openPage(page);

  await page.getByRole('link', { name: 'Back', exact: true }).click();

  await expect(page).toHaveURL(taskListPath);
});

test('answers an indicator with no draft with the not-found page', async ({ page }) => {
  for (const path of [
    '/publish/indicators/108/calculation',
    '/publish/indicators/00000000-0000-7000-8000-000000000000/calculation',
    // The seeded indicator is published, so it has no draft to answer for.
    `/publish/indicators/${MORTALITY_ID}/calculation`,
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

test('has no WCAG 2.2 AA violations when the other organisations are refused', async ({
  page,
}, testInfo) => {
  await openPage(page);
  await submitOtherWithoutDetails(page);
  await expect(page.getByRole('alert')).toContainText(DETAILS);

  await expectNoAccessibilityViolations(page, testInfo);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('shows the other organisations field and saves the answers', async ({ page }) => {
    const taskListPath = await openPage(page);

    await expect(page.getByLabel(DETAILS, { exact: true })).toBeVisible();

    await page.getByLabel(METHODOLOGY, { exact: true }).fill('Directly age-standardised rates.');
    await page.getByLabel(OTHER, { exact: true }).check();
    await page.getByLabel(DETAILS, { exact: true }).fill('Office for National Statistics');
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page).toHaveURL(taskListPath);
    await expect(taskRow(page)).toContainText('Completed');
  });
});
