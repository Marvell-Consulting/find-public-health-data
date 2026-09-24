import { expect, type Page, test } from '@playwright/test';

import { expectNoAccessibilityViolations } from '../support/accessibility.ts';
import { createIndicator, uniqueIndicatorName } from '../support/create-indicator.ts';
import { expectErrorSummaryReady } from '../support/govuk-frontend.ts';
import {
  expectBackToTaskList,
  expectNotFoundWithoutDraft,
  openSectionPage,
  type Section,
  taskRow,
} from '../support/section-page.ts';
import { signInAs } from '../support/sign-in.ts';

const SECTION: Section = { key: 'calculation', taskName: 'How the indicator was calculated' };
const METHODOLOGY = 'Enter methodology';
const OHID = 'Office for Health Improvement and Disparities';
const DHSC = 'Department of Health and Social Care';
const OTHER = 'Other organisation or organisations';
const DETAILS = 'Enter details of the other organisation or organisations';

async function submitOtherWithoutDetails(page: Page) {
  await page.getByLabel(METHODOLOGY, { exact: true }).fill('Directly age-standardised rates.');
  await page.getByLabel(OTHER, { exact: true }).check();
  await page.getByRole('button', { name: 'Continue' }).click();
}

test.beforeEach(async ({ page }) => {
  await signInAs(page, 'Riley Singh');
});

test('is reached from the task list, where it starts as not started', async ({ page }) => {
  await createIndicator(page, uniqueIndicatorName(SECTION.key));
  await expect(taskRow(page, SECTION.taskName)).toContainText('Not started');

  await taskRow(page, SECTION.taskName).getByRole('link').click();

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
  await openSectionPage(page, SECTION);
  const pagePath = new URL(page.url()).pathname;

  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL(pagePath);
  await expect(page).toHaveTitle(/^Error: /);
  const summary = page.getByRole('alert');
  await expect(summary.getByRole('link')).toHaveText([
    'Enter the methodology',
    'Select who calculated the indicator',
  ]);

  await expectErrorSummaryReady(page);
  await summary.getByRole('link', { name: 'Select who calculated the indicator' }).click();
  await expect(page.getByLabel(OHID, { exact: true })).toBeFocused();
});

test('reveals the other organisations only while "Other" is chosen', async ({ page }) => {
  await openSectionPage(page, SECTION);

  await expect(page.getByLabel(DETAILS, { exact: true })).toBeHidden();

  await page.getByLabel(OTHER, { exact: true }).check();
  await expect(page.getByLabel(DETAILS, { exact: true })).toBeVisible();

  await page.getByLabel(DHSC, { exact: true }).check();
  await expect(page.getByLabel(DETAILS, { exact: true })).toBeHidden();
});

test('asks for the other organisations when "Other" is chosen without them', async ({ page }) => {
  await openSectionPage(page, SECTION);

  await submitOtherWithoutDetails(page);

  const summary = page.getByRole('alert');
  await expect(summary.getByRole('link')).toHaveText([DETAILS]);
  await expect(page.getByLabel(OTHER, { exact: true })).toBeChecked();
  await expect(page.getByLabel(METHODOLOGY, { exact: true })).toHaveValue(
    'Directly age-standardised rates.',
  );

  await expectErrorSummaryReady(page);
  await summary.getByRole('link', { name: DETAILS }).click();
  await expect(page.getByLabel(DETAILS, { exact: true })).toBeFocused();
});

test('saves nothing until every answer is given', async ({ page }) => {
  await openSectionPage(page, SECTION);
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
  const taskListPath = await openSectionPage(page, SECTION);

  await page.getByLabel(METHODOLOGY, { exact: true }).fill('  Directly age-standardised rates.  ');
  await page.getByLabel(OTHER, { exact: true }).check();
  await page.getByLabel(DETAILS, { exact: true }).fill(' Office for National Statistics ');
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL(taskListPath);
  await expect(taskRow(page, SECTION.taskName)).toContainText('Completed');

  await taskRow(page, SECTION.taskName).getByRole('link').click();
  await expect(page.getByLabel(METHODOLOGY, { exact: true })).toHaveValue(
    'Directly age-standardised rates.',
  );
  await expect(page.getByLabel(OTHER, { exact: true })).toBeChecked();
  await expect(page.getByLabel(DETAILS, { exact: true })).toHaveValue(
    'Office for National Statistics',
  );
});

test('forgets the other organisations once OHID or DHSC is chosen instead', async ({ page }) => {
  await openSectionPage(page, SECTION);
  const pagePath = new URL(page.url()).pathname;
  await page.getByLabel(METHODOLOGY, { exact: true }).fill('Directly age-standardised rates.');
  await page.getByLabel(OTHER, { exact: true }).check();
  await page.getByLabel(DETAILS, { exact: true }).fill('Office for National Statistics');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(taskRow(page, SECTION.taskName)).toContainText('Completed');

  await page.goto(pagePath);
  await page.getByLabel(OHID, { exact: true }).check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(taskRow(page, SECTION.taskName)).toContainText('Completed');

  await page.goto(pagePath);
  await expect(page.getByLabel(OHID, { exact: true })).toBeChecked();
  await page.getByLabel(OTHER, { exact: true }).check();
  await expect(page.getByLabel(DETAILS, { exact: true })).toBeEmpty();
});

test('goes back to the task list', async ({ page }) => {
  const taskListPath = await openSectionPage(page, SECTION);

  await expectBackToTaskList(page, taskListPath);
});

test('answers an indicator with no draft with the not-found page', async ({ page }) => {
  await expectNotFoundWithoutDraft(page, SECTION.key);
});

test('has no WCAG 2.2 AA violations', async ({ page }, testInfo) => {
  await openSectionPage(page, SECTION);

  await expectNoAccessibilityViolations(page, testInfo);
});

test('has no WCAG 2.2 AA violations when the other organisations are refused', async ({
  page,
}, testInfo) => {
  await openSectionPage(page, SECTION);
  await submitOtherWithoutDetails(page);
  await expect(page.getByRole('alert')).toContainText(DETAILS);

  await expectNoAccessibilityViolations(page, testInfo);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('shows the other organisations field and saves the answers', async ({ page }) => {
    const taskListPath = await openSectionPage(page, SECTION);

    await expect(page.getByLabel(DETAILS, { exact: true })).toBeVisible();

    await page.getByLabel(METHODOLOGY, { exact: true }).fill('Directly age-standardised rates.');
    await page.getByLabel(OTHER, { exact: true }).check();
    await page.getByLabel(DETAILS, { exact: true }).fill('Office for National Statistics');
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page).toHaveURL(taskListPath);
    await expect(taskRow(page, SECTION.taskName)).toContainText('Completed');
  });
});
