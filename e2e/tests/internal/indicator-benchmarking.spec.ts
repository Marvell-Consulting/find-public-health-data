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

const SECTION: Section = { key: 'benchmarking', taskName: 'Benchmarking' };
const QUESTION = 'Are there any goal benchmarks for this indicator?';
const LOWER = 'Enter lower goal value';
const UPPER = 'Enter upper goal value';
const POLARITY = 'Select polarity of goal';
const DETAIL = 'Provide detail about the policy goal';

function hasGoal(page: Page, label: 'Yes' | 'No') {
  return page.getByRole('group', { name: QUESTION }).getByLabel(label, { exact: true });
}

function goalPolarity(page: Page, label: 'High is good' | 'Low is good') {
  return page.getByRole('group', { name: POLARITY }).getByLabel(label, { exact: true });
}

async function answerGoal(page: Page) {
  await hasGoal(page, 'Yes').check();
  await page.getByLabel(LOWER).fill(' 2,400 ');
  await page.getByLabel(UPPER).fill('3250.50');
  await goalPolarity(page, 'High is good').check();
  await page.getByLabel(DETAIL).fill('The national chlamydia detection rate ambition.');
}

async function continueForm(page: Page) {
  await page.getByRole('button', { name: 'Continue' }).click();
}

test.beforeEach(async ({ page }) => {
  await signInAs(page, 'Riley Singh');
});

test('is reached from the task list, where it starts as not started', async ({ page }) => {
  await createIndicator(page, uniqueIndicatorName(SECTION.key));
  await expect(taskRow(page, SECTION.taskName)).toContainText('Not started');

  await taskRow(page, SECTION.taskName).getByRole('link').click();

  await expect(page.getByRole('heading', { level: 1, name: 'Benchmarking' })).toBeVisible();
  await expect(page.getByRole('main').getByRole('radio', { checked: true })).toHaveCount(0);
});

test('asks whether there are goal benchmarks when Continue is selected with the form empty', async ({
  page,
}) => {
  await openSectionPage(page, SECTION);
  const pagePath = new URL(page.url()).pathname;

  await continueForm(page);

  await expect(page).toHaveURL(pagePath);
  await expect(page).toHaveTitle(/^Error: /);
  const summary = page.getByRole('alert');
  await expect(summary.getByRole('link')).toHaveText([
    'Select whether there are any goal benchmarks for this indicator',
  ]);

  await expectErrorSummaryReady(page);
  await summary.getByRole('link').click();
  await expect(hasGoal(page, 'Yes')).toBeFocused();
});

test('reveals the goal only while Yes is chosen', async ({ page }) => {
  await openSectionPage(page, SECTION);

  await expect(page.getByLabel(LOWER)).toBeHidden();

  await hasGoal(page, 'Yes').check();
  await expect(page.getByLabel(LOWER)).toBeVisible();
  await expect(page.getByLabel(UPPER)).toBeVisible();
  await expect(goalPolarity(page, 'Low is good')).toBeVisible();
  await expect(page.getByLabel(DETAIL)).toBeVisible();

  await hasGoal(page, 'No').check();
  await expect(page.getByLabel(LOWER)).toBeHidden();
});

test('asks for the lower value and polarity of a goal given neither', async ({ page }) => {
  await openSectionPage(page, SECTION);

  await hasGoal(page, 'Yes').check();
  await continueForm(page);

  const summary = page.getByRole('alert');
  await expect(summary.getByRole('link')).toHaveText([
    'Enter the lower goal value',
    'Select the polarity of the goal',
  ]);
  await expect(hasGoal(page, 'Yes')).toBeChecked();

  await expectErrorSummaryReady(page);
  await summary.getByRole('link', { name: 'Select the polarity of the goal' }).click();
  await expect(goalPolarity(page, 'High is good')).toBeFocused();
});

test('refuses values that are not numbers, and an upper value not above the lower', async ({
  page,
}) => {
  await openSectionPage(page, SECTION);

  await answerGoal(page);
  await page.getByLabel(LOWER).fill('90%');
  await page.getByLabel(UPPER).fill('9,5');
  await continueForm(page);
  await expect(page.getByRole('alert').getByRole('link')).toHaveText([
    'Lower goal value must be a number',
    'Upper goal value must be a number',
  ]);
  await expect(page.getByLabel(LOWER)).toHaveValue('90%');

  await page.getByLabel(LOWER).fill('90');
  await page.getByLabel(UPPER).fill('90');
  await continueForm(page);
  await expect(page.getByRole('alert').getByRole('link')).toHaveText([
    'Upper goal value must be higher than the lower goal value',
  ]);
});

test('saves nothing until the goal is complete', async ({ page }) => {
  await openSectionPage(page, SECTION);
  const pagePath = new URL(page.url()).pathname;

  await hasGoal(page, 'Yes').check();
  await page.getByLabel(LOWER).fill('90');
  await continueForm(page);
  await expect(page.getByRole('alert')).toBeVisible();

  await page.goto(pagePath);
  await expect(page.getByRole('main').getByRole('radio', { checked: true })).toHaveCount(0);
});

test('saves a goal on Continue and shows the task as completed', async ({ page }) => {
  const taskListPath = await openSectionPage(page, SECTION);

  await answerGoal(page);
  await continueForm(page);

  await expect(page).toHaveURL(taskListPath);
  await expect(taskRow(page, SECTION.taskName)).toContainText('Completed');

  await taskRow(page, SECTION.taskName).getByRole('link').click();
  await expect(hasGoal(page, 'Yes')).toBeChecked();
  await expect(page.getByLabel(LOWER)).toHaveValue('2400');
  await expect(page.getByLabel(UPPER)).toHaveValue('3250.5');
  await expect(goalPolarity(page, 'High is good')).toBeChecked();
  await expect(page.getByLabel(DETAIL)).toHaveValue(
    'The national chlamydia detection rate ambition.',
  );
});

test('saves a single goal value without detail', async ({ page }) => {
  const taskListPath = await openSectionPage(page, SECTION);
  const pagePath = new URL(page.url()).pathname;

  await hasGoal(page, 'Yes').check();
  await page.getByLabel(LOWER).fill('-0.5');
  await goalPolarity(page, 'Low is good').check();
  await continueForm(page);

  await expect(page).toHaveURL(taskListPath);
  await expect(taskRow(page, SECTION.taskName)).toContainText('Completed');
  await page.goto(pagePath);
  await expect(page.getByLabel(LOWER)).toHaveValue('-0.5');
  await expect(page.getByLabel(UPPER)).toHaveValue('');
  await expect(goalPolarity(page, 'Low is good')).toBeChecked();
});

test('forgets the goal once it is answered No instead', async ({ page }) => {
  await openSectionPage(page, SECTION);
  const pagePath = new URL(page.url()).pathname;
  await answerGoal(page);
  await continueForm(page);
  await expect(taskRow(page, SECTION.taskName)).toContainText('Completed');

  await page.goto(pagePath);
  await hasGoal(page, 'No').check();
  await continueForm(page);
  await expect(taskRow(page, SECTION.taskName)).toContainText('Completed');

  await page.goto(pagePath);
  await expect(hasGoal(page, 'No')).toBeChecked();
  await hasGoal(page, 'Yes').check();
  await expect(page.getByLabel(LOWER)).toBeEmpty();
  await expect(
    page.getByRole('group', { name: POLARITY }).getByRole('radio', { checked: true }),
  ).toHaveCount(0);
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
  await hasGoal(page, 'Yes').check();

  await expectNoAccessibilityViolations(page, testInfo);
});

test('has no WCAG 2.2 AA violations when the goal is refused', async ({ page }, testInfo) => {
  await openSectionPage(page, SECTION);
  await hasGoal(page, 'Yes').check();
  await page.getByLabel(UPPER).fill('abc');
  await continueForm(page);
  await expect(page.getByRole('alert')).toContainText('Enter the lower goal value');

  await expectNoAccessibilityViolations(page, testInfo);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('shows the goal fields and saves the answers', async ({ page }) => {
    const taskListPath = await openSectionPage(page, SECTION);

    await expect(page.getByLabel(LOWER)).toBeVisible();

    await answerGoal(page);
    await continueForm(page);

    await expect(page).toHaveURL(taskListPath);
    await expect(taskRow(page, SECTION.taskName)).toContainText('Completed');
  });
});
