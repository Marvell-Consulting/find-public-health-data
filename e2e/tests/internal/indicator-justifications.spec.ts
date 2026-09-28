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

const SECTION: Section = { key: 'justifications', taskName: 'Justifications' };
const CI_METHOD = 'Why was the confidence interval method chosen?';
const DATA_SOURCES = 'Why were the data sources chosen?';
const INEQUALITIES = 'What health inequalities have been included?';
const EXCLUSIONS = 'Have there been any exclusions?';
const AUTOMATION = 'Have internal automation tools been used to create this indicator?';
const QUESTIONS = {
  [EXCLUSIONS]: 'Enter why exclusions were made',
  [AUTOMATION]: 'Enter details of the tools used',
};

function answer(page: Page, legend: string, label: 'Yes' | 'No') {
  return page.getByRole('group', { name: legend }).getByLabel(label, { exact: true });
}

function details(page: Page, legend: keyof typeof QUESTIONS) {
  return page.getByRole('group', { name: legend }).getByLabel(QUESTIONS[legend]);
}

async function fillText(page: Page) {
  await page.getByLabel(CI_METHOD).fill('  The standard method for rates.  ');
  await page.getByLabel(DATA_SOURCES).fill('The only national source.');
  await page.getByLabel(INEQUALITIES).fill('Deprivation deciles.');
}

async function answerEvery(page: Page) {
  await fillText(page);
  await answer(page, EXCLUSIONS, 'Yes').check();
  await details(page, EXCLUSIONS).fill('Areas with fewer than 5 deaths.');
  await answer(page, AUTOMATION, 'No').check();
}

async function submitYesWithoutDetails(page: Page) {
  await fillText(page);
  await answer(page, EXCLUSIONS, 'Yes').check();
  await answer(page, AUTOMATION, 'Yes').check();
  await page.getByRole('button', { name: 'Continue' }).click();
}

test.beforeEach(async ({ page }) => {
  await signInAs(page, 'Riley Singh');
});

test('is reached from the task list, where it starts as not started', async ({ page }) => {
  await createIndicator(page, uniqueIndicatorName(SECTION.key));
  await expect(taskRow(page, SECTION.taskName)).toContainText('Not started');

  await taskRow(page, SECTION.taskName).getByRole('link').click();

  await expect(page.getByRole('heading', { level: 1, name: 'Justifications' })).toBeVisible();
  for (const label of [CI_METHOD, DATA_SOURCES, INEQUALITIES]) {
    await expect(page.getByLabel(label)).toBeEmpty();
  }
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
    'Enter why the confidence interval method was chosen',
    'Enter why the data sources were chosen',
    'Enter what health inequalities have been included',
    'Select whether there have been any exclusions',
    'Select whether internal automation tools have been used',
  ]);

  await expectErrorSummaryReady(page);
  await summary
    .getByRole('link', { name: 'Select whether there have been any exclusions' })
    .click();
  await expect(answer(page, EXCLUSIONS, 'Yes')).toBeFocused();
});

test('reveals the details of a question only while Yes is chosen', async ({ page }) => {
  await openSectionPage(page, SECTION);

  await expect(details(page, EXCLUSIONS)).toBeHidden();

  await answer(page, EXCLUSIONS, 'Yes').check();
  await expect(details(page, EXCLUSIONS)).toBeVisible();
  await expect(details(page, AUTOMATION)).toBeHidden();

  await answer(page, EXCLUSIONS, 'No').check();
  await expect(details(page, EXCLUSIONS)).toBeHidden();
});

test('asks for the details of each question answered Yes without them', async ({ page }) => {
  await openSectionPage(page, SECTION);

  await submitYesWithoutDetails(page);

  const summary = page.getByRole('alert');
  await expect(summary.getByRole('link')).toHaveText([
    'Enter why exclusions were made',
    'Enter details of the tools used',
  ]);
  await expect(page.getByLabel(DATA_SOURCES)).toHaveValue('The only national source.');

  await expectErrorSummaryReady(page);
  await summary.getByRole('link', { name: 'Enter details of the tools used' }).click();
  await expect(details(page, AUTOMATION)).toBeFocused();
});

test('saves nothing until every answer is given', async ({ page }) => {
  await openSectionPage(page, SECTION);
  const pagePath = new URL(page.url()).pathname;

  await submitYesWithoutDetails(page);
  await expect(page.getByRole('alert')).toBeVisible();

  await page.goto(pagePath);
  await expect(page.getByLabel(CI_METHOD)).toBeEmpty();
  await expect(page.getByRole('main').getByRole('radio', { checked: true })).toHaveCount(0);
});

test('saves every answer on Continue and shows the task as completed', async ({ page }) => {
  const taskListPath = await openSectionPage(page, SECTION);

  await answerEvery(page);
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL(taskListPath);
  await expect(taskRow(page, SECTION.taskName)).toContainText('Completed');

  await taskRow(page, SECTION.taskName).getByRole('link').click();
  await expect(page.getByLabel(CI_METHOD)).toHaveValue('The standard method for rates.');
  await expect(page.getByLabel(DATA_SOURCES)).toHaveValue('The only national source.');
  await expect(page.getByLabel(INEQUALITIES)).toHaveValue('Deprivation deciles.');
  await expect(answer(page, EXCLUSIONS, 'Yes')).toBeChecked();
  await expect(details(page, EXCLUSIONS)).toHaveValue('Areas with fewer than 5 deaths.');
  await expect(answer(page, AUTOMATION, 'No')).toBeChecked();
});

test('forgets the details of a question once it is answered No instead', async ({ page }) => {
  await openSectionPage(page, SECTION);
  const pagePath = new URL(page.url()).pathname;
  await answerEvery(page);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(taskRow(page, SECTION.taskName)).toContainText('Completed');

  await page.goto(pagePath);
  await answer(page, EXCLUSIONS, 'No').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(taskRow(page, SECTION.taskName)).toContainText('Completed');

  await page.goto(pagePath);
  await expect(answer(page, EXCLUSIONS, 'No')).toBeChecked();
  await answer(page, EXCLUSIONS, 'Yes').check();
  await expect(details(page, EXCLUSIONS)).toBeEmpty();
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
  await expect(page.getByRole('alert')).toContainText('Enter why the data sources were chosen');

  await expectNoAccessibilityViolations(page, testInfo);
});

test('has no WCAG 2.2 AA violations when details are refused', async ({ page }, testInfo) => {
  await openSectionPage(page, SECTION);
  await submitYesWithoutDetails(page);
  await expect(page.getByRole('alert')).toContainText('Enter why exclusions were made');

  await expectNoAccessibilityViolations(page, testInfo);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('shows every details field and saves the answers', async ({ page }) => {
    const taskListPath = await openSectionPage(page, SECTION);

    await expect(details(page, EXCLUSIONS)).toBeVisible();
    await expect(details(page, AUTOMATION)).toBeVisible();

    await answerEvery(page);
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page).toHaveURL(taskListPath);
    await expect(taskRow(page, SECTION.taskName)).toContainText('Completed');
  });
});
