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

const SECTION: Section = { key: 'other-notes-and-caveats', taskName: 'Other notes and caveats' };
const DISCLOSURE = 'Has disclosure control been applied?';
const ROUNDING = 'Has any rounding been applied?';
const CAVEATS = 'Are there any caveats needed?';
const OTHER_NOTES = 'Are there any other notes needed?';
const QUESTIONS = [DISCLOSURE, ROUNDING, CAVEATS, OTHER_NOTES];

function question(page: Page, legend: string) {
  return page.getByRole('group', { name: legend });
}

function answer(page: Page, legend: string, label: 'Yes' | 'No' | 'Not applicable') {
  return question(page, legend).getByLabel(label, { exact: true });
}

function details(page: Page, legend: string) {
  return question(page, legend).getByLabel('Provide details', { exact: true });
}

/** Answers every question, giving details where the answer is Yes. */
async function answerEvery(page: Page) {
  await answer(page, DISCLOSURE, 'Yes').check();
  await details(page, DISCLOSURE).fill('  Counts under 5 are suppressed.  ');
  await answer(page, ROUNDING, 'No').check();
  await answer(page, CAVEATS, 'Yes').check();
  await details(page, CAVEATS).fill('Survey data.');
  await answer(page, OTHER_NOTES, 'No').check();
}

async function submitYesWithoutDetails(page: Page) {
  await answer(page, DISCLOSURE, 'Not applicable').check();
  await answer(page, ROUNDING, 'Yes').check();
  await answer(page, CAVEATS, 'No').check();
  await answer(page, OTHER_NOTES, 'Yes').check();
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
    page.getByRole('heading', { level: 1, name: 'Provide any other notes and caveats' }),
  ).toBeVisible();
  await expect(page.getByRole('main').getByRole('radio', { checked: true })).toHaveCount(0);
  for (const legend of QUESTIONS) {
    await expect(question(page, legend)).toBeVisible();
  }
});

test('asks every question when Continue is selected with the form empty', async ({ page }) => {
  await openSectionPage(page, SECTION);
  const pagePath = new URL(page.url()).pathname;

  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL(pagePath);
  await expect(page).toHaveTitle(/^Error: /);
  const summary = page.getByRole('alert');
  await expect(summary.getByRole('link')).toHaveText([
    'Select whether disclosure control has been applied',
    'Select whether rounding has been applied',
    'Select whether there are any caveats needed',
    'Select whether there are any other notes needed',
  ]);

  await expectErrorSummaryReady(page);
  await summary.getByRole('link', { name: 'Select whether rounding has been applied' }).click();
  await expect(answer(page, ROUNDING, 'Yes')).toBeFocused();
});

test('reveals the details of a question only while Yes is chosen', async ({ page }) => {
  await openSectionPage(page, SECTION);

  await expect(details(page, CAVEATS)).toBeHidden();

  await answer(page, CAVEATS, 'Yes').check();
  await expect(details(page, CAVEATS)).toBeVisible();
  await expect(details(page, DISCLOSURE)).toBeHidden();

  await answer(page, CAVEATS, 'No').check();
  await expect(details(page, CAVEATS)).toBeHidden();
});

test('asks for the details of each question answered Yes without them', async ({ page }) => {
  await openSectionPage(page, SECTION);

  await submitYesWithoutDetails(page);

  const summary = page.getByRole('alert');
  await expect(summary.getByRole('link')).toHaveText([
    'Provide details of the rounding',
    'Provide details of the other notes',
  ]);
  await expect(answer(page, DISCLOSURE, 'Not applicable')).toBeChecked();
  await expect(answer(page, OTHER_NOTES, 'Yes')).toBeChecked();

  await expectErrorSummaryReady(page);
  await summary.getByRole('link', { name: 'Provide details of the other notes' }).click();
  await expect(details(page, OTHER_NOTES)).toBeFocused();
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
  await expect(answer(page, DISCLOSURE, 'Yes')).toBeChecked();
  await expect(details(page, DISCLOSURE)).toHaveValue('Counts under 5 are suppressed.');
  await expect(answer(page, ROUNDING, 'No')).toBeChecked();
  await expect(answer(page, CAVEATS, 'Yes')).toBeChecked();
  await expect(details(page, CAVEATS)).toHaveValue('Survey data.');
  await expect(answer(page, OTHER_NOTES, 'No')).toBeChecked();
});

test('forgets the details of a question once it is answered No instead', async ({ page }) => {
  await openSectionPage(page, SECTION);
  const pagePath = new URL(page.url()).pathname;
  await answerEvery(page);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(taskRow(page, SECTION.taskName)).toContainText('Completed');

  await page.goto(pagePath);
  await answer(page, CAVEATS, 'No').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(taskRow(page, SECTION.taskName)).toContainText('Completed');

  await page.goto(pagePath);
  await expect(answer(page, CAVEATS, 'No')).toBeChecked();
  await answer(page, CAVEATS, 'Yes').check();
  await expect(details(page, CAVEATS)).toBeEmpty();
  await expect(details(page, DISCLOSURE)).toHaveValue('Counts under 5 are suppressed.');
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

test('has no WCAG 2.2 AA violations when details are refused', async ({ page }, testInfo) => {
  await openSectionPage(page, SECTION);
  await submitYesWithoutDetails(page);
  await expect(page.getByRole('alert')).toContainText('Provide details of the rounding');

  await expectNoAccessibilityViolations(page, testInfo);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('shows every details field and saves the answers', async ({ page }) => {
    const taskListPath = await openSectionPage(page, SECTION);

    for (const legend of QUESTIONS) {
      await expect(details(page, legend)).toBeVisible();
    }

    await answerEvery(page);
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page).toHaveURL(taskListPath);
    await expect(taskRow(page, SECTION.taskName)).toContainText('Completed');
  });
});
