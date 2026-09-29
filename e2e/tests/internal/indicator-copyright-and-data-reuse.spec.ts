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

const SECTION: Section = {
  key: 'copyright-and-data-reuse',
  taskName: 'Copyright and data re-use',
};
const COPYRIGHT = 'Is the copyright different to the default?';
const DATA_REUSE = 'Is the data re-use different to the default?';

function question(page: Page, legend: string) {
  return page.getByRole('group', { name: legend });
}

function answer(page: Page, legend: string, label: 'Yes' | 'No') {
  return question(page, legend).getByLabel(label, { exact: true });
}

function details(page: Page, legend: string) {
  return question(page, legend).getByLabel('Provide details', { exact: true });
}

async function answerEvery(page: Page) {
  await answer(page, COPYRIGHT, 'Yes').check();
  await details(page, COPYRIGHT).fill('  Copyright © NHS England  ');
  await answer(page, DATA_REUSE, 'No').check();
}

async function submitYesWithoutDetails(page: Page) {
  await answer(page, COPYRIGHT, 'Yes').check();
  await answer(page, DATA_REUSE, 'Yes').check();
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
    page.getByRole('heading', { level: 1, name: 'Copyright and data re-use' }),
  ).toBeVisible();
  await expect(page.getByRole('main').getByRole('radio', { checked: true })).toHaveCount(0);
  await expect(question(page, COPYRIGHT)).toContainText('The default is "© Crown copyright"');
  await expect(question(page, DATA_REUSE)).toContainText(
    'The default is "The data may be used referencing Office for Health Improvement and Disparities"',
  );
});

test('asks both questions when Continue is selected with the form empty', async ({ page }) => {
  await openSectionPage(page, SECTION);
  const pagePath = new URL(page.url()).pathname;

  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL(pagePath);
  await expect(page).toHaveTitle(/^Error: /);
  const summary = page.getByRole('alert');
  await expect(summary.getByRole('link')).toHaveText([
    'Select whether the copyright is anything other than Crown copyright',
    'Select whether the data re-use is different to the default',
  ]);

  await expectErrorSummaryReady(page);
  await summary.getByRole('link', { name: 'Select whether the data re-use' }).click();
  await expect(answer(page, DATA_REUSE, 'Yes')).toBeFocused();
});

test('reveals the details only while Yes is chosen', async ({ page }) => {
  await openSectionPage(page, SECTION);

  for (const legend of [COPYRIGHT, DATA_REUSE]) {
    await expect(details(page, legend)).toBeHidden();

    await answer(page, legend, 'Yes').check();
    await expect(details(page, legend)).toBeVisible();

    await answer(page, legend, 'No').check();
    await expect(details(page, legend)).toBeHidden();
  }
});

test('asks for the details of each answer Yes given without them', async ({ page }) => {
  await openSectionPage(page, SECTION);

  await submitYesWithoutDetails(page);

  const summary = page.getByRole('alert');
  await expect(summary.getByRole('link')).toHaveText([
    'Provide details of the copyright',
    'Provide details of the data re-use',
  ]);
  await expect(answer(page, COPYRIGHT, 'Yes')).toBeChecked();

  await expectErrorSummaryReady(page);
  await summary.getByRole('link', { name: 'Provide details of the data re-use' }).click();
  await expect(details(page, DATA_REUSE)).toBeFocused();
});

test('saves nothing until every answer is given', async ({ page }) => {
  await openSectionPage(page, SECTION);
  const pagePath = new URL(page.url()).pathname;

  await submitYesWithoutDetails(page);
  await expect(page.getByRole('alert')).toBeVisible();

  await page.goto(pagePath);
  await expect(page.getByRole('main').getByRole('radio', { checked: true })).toHaveCount(0);
});

test('saves every answer on Continue and shows the task as completed', async ({ page }) => {
  const taskListPath = await openSectionPage(page, SECTION);

  await answerEvery(page);
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL(taskListPath);
  await expect(taskRow(page, SECTION.taskName)).toContainText('Completed');

  await taskRow(page, SECTION.taskName).getByRole('link').click();
  await expect(answer(page, COPYRIGHT, 'Yes')).toBeChecked();
  await expect(details(page, COPYRIGHT)).toHaveValue('Copyright © NHS England');
  await expect(answer(page, DATA_REUSE, 'No')).toBeChecked();
});

test('forgets the copyright details once it is answered No instead', async ({ page }) => {
  await openSectionPage(page, SECTION);
  const pagePath = new URL(page.url()).pathname;
  await answerEvery(page);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(taskRow(page, SECTION.taskName)).toContainText('Completed');

  await page.goto(pagePath);
  await answer(page, COPYRIGHT, 'No').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(taskRow(page, SECTION.taskName)).toContainText('Completed');

  await page.goto(pagePath);
  await expect(answer(page, COPYRIGHT, 'No')).toBeChecked();
  await answer(page, COPYRIGHT, 'Yes').check();
  await expect(details(page, COPYRIGHT)).toBeEmpty();
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
  await expect(page.getByRole('alert')).toContainText('Select whether the copyright');

  await expectNoAccessibilityViolations(page, testInfo);
});

test('has no WCAG 2.2 AA violations when the details are refused', async ({ page }, testInfo) => {
  await openSectionPage(page, SECTION);
  await submitYesWithoutDetails(page);
  await expect(page.getByRole('alert')).toContainText('Provide details of the copyright');

  await expectNoAccessibilityViolations(page, testInfo);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('shows both details fields and saves the answers', async ({ page }) => {
    const taskListPath = await openSectionPage(page, SECTION);

    await expect(details(page, COPYRIGHT)).toBeVisible();
    await expect(details(page, DATA_REUSE)).toBeVisible();

    await answerEvery(page);
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page).toHaveURL(taskListPath);
    await expect(taskRow(page, SECTION.taskName)).toContainText('Completed');
  });
});
