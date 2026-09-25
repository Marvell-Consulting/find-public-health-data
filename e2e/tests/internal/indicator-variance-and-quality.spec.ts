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

const SECTION: Section = { key: 'variance-and-quality', taskName: 'Variance and quality' };
const VARIATION = 'How does the indicator vary?';
const QUALITY_ASSURANCE = 'What quality assurance has been done on the indicator?';
const SOURCE_DATA_ISSUES = 'Are there any data quality issues with the source data?';
const DETAILS =
  'Enter details, including what is being done to improve the quality of the source data';

function sourceDataIssues(page: Page, label: 'Yes' | 'No') {
  return page.getByRole('group', { name: SOURCE_DATA_ISSUES }).getByLabel(label, { exact: true });
}

function details(page: Page) {
  return page.getByRole('group', { name: SOURCE_DATA_ISSUES }).getByLabel(DETAILS);
}

async function answerEvery(page: Page) {
  await page.getByLabel(VARIATION).fill('  Varies with the age structure of each area.  ');
  await page.getByLabel(QUALITY_ASSURANCE).fill('Checked against the published ONS figures.');
  await sourceDataIssues(page, 'Yes').check();
  await details(page).fill('Late returns from two areas.');
}

async function submitYesWithoutDetails(page: Page) {
  await page.getByLabel(VARIATION).fill('Varies by area.');
  await page.getByLabel(QUALITY_ASSURANCE).fill('Checked.');
  await sourceDataIssues(page, 'Yes').check();
  await page.getByRole('button', { name: 'Continue' }).click();
}

test.beforeEach(async ({ page }) => {
  await signInAs(page, 'Riley Singh');
});

test('is reached from the task list, where it starts as not started', async ({ page }) => {
  await createIndicator(page, uniqueIndicatorName(SECTION.key));
  await expect(taskRow(page, SECTION.taskName)).toContainText('Not started');

  await taskRow(page, SECTION.taskName).getByRole('link').click();

  await expect(page.getByRole('heading', { level: 1, name: 'Variance and quality' })).toBeVisible();
  await expect(page.getByLabel(VARIATION)).toBeEmpty();
  await expect(page.getByLabel(QUALITY_ASSURANCE)).toBeEmpty();
  await expect(page.getByRole('main').getByRole('radio', { checked: true })).toHaveCount(0);
});

test('asks every question when Continue is selected with the form empty', async ({ page }) => {
  await openSectionPage(page, SECTION);
  const pagePath = new URL(page.url()).pathname;

  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL(pagePath);
  await expect(page).toHaveTitle(/^Error: /);
  const summary = page.getByRole('alert');
  await expect(summary.getByRole('link')).toHaveText([
    'Enter how the indicator varies',
    'Enter what quality assurance has been done on the indicator',
    'Select whether there are any data quality issues with the source data',
  ]);

  await expectErrorSummaryReady(page);
  await summary
    .getByRole('link', { name: 'Select whether there are any data quality issues' })
    .click();
  await expect(sourceDataIssues(page, 'Yes')).toBeFocused();
});

test('reveals the details only while Yes is chosen', async ({ page }) => {
  await openSectionPage(page, SECTION);

  await expect(details(page)).toBeHidden();

  await sourceDataIssues(page, 'Yes').check();
  await expect(details(page)).toBeVisible();

  await sourceDataIssues(page, 'No').check();
  await expect(details(page)).toBeHidden();
});

test('asks for the details of source data issues answered Yes without them', async ({ page }) => {
  await openSectionPage(page, SECTION);

  await submitYesWithoutDetails(page);

  const summary = page.getByRole('alert');
  await expect(summary.getByRole('link')).toHaveText([
    'Enter details of the data quality issues with the source data',
  ]);
  await expect(page.getByLabel(VARIATION)).toHaveValue('Varies by area.');
  await expect(sourceDataIssues(page, 'Yes')).toBeChecked();

  await expectErrorSummaryReady(page);
  await summary.getByRole('link').click();
  await expect(details(page)).toBeFocused();
});

test('saves nothing until every answer is given', async ({ page }) => {
  await openSectionPage(page, SECTION);
  const pagePath = new URL(page.url()).pathname;

  await submitYesWithoutDetails(page);
  await expect(page.getByRole('alert')).toBeVisible();

  await page.goto(pagePath);
  await expect(page.getByLabel(VARIATION)).toBeEmpty();
  await expect(page.getByRole('main').getByRole('radio', { checked: true })).toHaveCount(0);
});

test('saves every answer on Continue and shows the task as completed', async ({ page }) => {
  const taskListPath = await openSectionPage(page, SECTION);

  await answerEvery(page);
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL(taskListPath);
  await expect(taskRow(page, SECTION.taskName)).toContainText('Completed');

  await taskRow(page, SECTION.taskName).getByRole('link').click();
  await expect(page.getByLabel(VARIATION)).toHaveValue(
    'Varies with the age structure of each area.',
  );
  await expect(page.getByLabel(QUALITY_ASSURANCE)).toHaveValue(
    'Checked against the published ONS figures.',
  );
  await expect(sourceDataIssues(page, 'Yes')).toBeChecked();
  await expect(details(page)).toHaveValue('Late returns from two areas.');
});

test('forgets the details once source data issues are answered No instead', async ({ page }) => {
  await openSectionPage(page, SECTION);
  const pagePath = new URL(page.url()).pathname;
  await answerEvery(page);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(taskRow(page, SECTION.taskName)).toContainText('Completed');

  await page.goto(pagePath);
  await sourceDataIssues(page, 'No').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(taskRow(page, SECTION.taskName)).toContainText('Completed');

  await page.goto(pagePath);
  await expect(sourceDataIssues(page, 'No')).toBeChecked();
  await sourceDataIssues(page, 'Yes').check();
  await expect(details(page)).toBeEmpty();
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

test('has no WCAG 2.2 AA violations when the answers are refused', async ({ page }, testInfo) => {
  await openSectionPage(page, SECTION);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('alert')).toContainText('Enter how the indicator varies');

  await expectNoAccessibilityViolations(page, testInfo);
});

test('has no WCAG 2.2 AA violations when the details are refused', async ({ page }, testInfo) => {
  await openSectionPage(page, SECTION);
  await submitYesWithoutDetails(page);
  await expect(page.getByRole('alert')).toContainText('Enter details of the data quality issues');

  await expectNoAccessibilityViolations(page, testInfo);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('shows the details field and saves the answers', async ({ page }) => {
    const taskListPath = await openSectionPage(page, SECTION);

    await expect(details(page)).toBeVisible();

    await answerEvery(page);
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page).toHaveURL(taskListPath);
    await expect(taskRow(page, SECTION.taskName)).toContainText('Completed');
  });
});
