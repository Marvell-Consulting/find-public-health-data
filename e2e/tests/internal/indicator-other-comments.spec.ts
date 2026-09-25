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

const SECTION: Section = { key: 'other-comments', taskName: 'Other comments' };
const SPONSORS = 'Enter any applicable sponsors or stakeholders for this indicator (optional)';
const COMMENTS = 'Are there any other comments for the reviewers?';

function hasComments(page: Page, label: 'Yes' | 'No') {
  return page.getByRole('group', { name: COMMENTS }).getByLabel(label, { exact: true });
}

function comments(page: Page) {
  return page.getByRole('group', { name: COMMENTS }).getByLabel('Enter comments');
}

async function answerEvery(page: Page) {
  await page.getByLabel(SPONSORS).fill('  The national screening committee.  ');
  await hasComments(page, 'Yes').check();
  await comments(page).fill('Replaces indicator 108.');
}

async function submitYesWithoutComments(page: Page) {
  await page.getByLabel(SPONSORS).fill('The committee.');
  await hasComments(page, 'Yes').check();
  await page.getByRole('button', { name: 'Continue' }).click();
}

test.beforeEach(async ({ page }) => {
  await signInAs(page, 'Riley Singh');
});

test('is reached from the task list, where it starts as not started', async ({ page }) => {
  await createIndicator(page, uniqueIndicatorName(SECTION.key));
  await expect(taskRow(page, SECTION.taskName)).toContainText('Not started');

  await taskRow(page, SECTION.taskName).getByRole('link').click();

  await expect(page.getByRole('heading', { level: 1, name: 'Other comments' })).toBeVisible();
  await expect(page.getByLabel(SPONSORS)).toBeEmpty();
  await expect(page.getByRole('main').getByRole('radio', { checked: true })).toHaveCount(0);
});

test('asks whether there are comments when Continue is selected with the form empty', async ({
  page,
}) => {
  await openSectionPage(page, SECTION);
  const pagePath = new URL(page.url()).pathname;

  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL(pagePath);
  await expect(page).toHaveTitle(/^Error: /);
  const summary = page.getByRole('alert');
  await expect(summary.getByRole('link')).toHaveText([
    'Select whether you have additional comments',
  ]);

  await expectErrorSummaryReady(page);
  await summary.getByRole('link', { name: 'Select whether you have additional comments' }).click();
  await expect(hasComments(page, 'Yes')).toBeFocused();
});

test('reveals the comments only while Yes is chosen', async ({ page }) => {
  await openSectionPage(page, SECTION);

  await expect(comments(page)).toBeHidden();

  await hasComments(page, 'Yes').check();
  await expect(comments(page)).toBeVisible();

  await hasComments(page, 'No').check();
  await expect(comments(page)).toBeHidden();
});

test('asks for the comments when Yes is answered without them', async ({ page }) => {
  await openSectionPage(page, SECTION);

  await submitYesWithoutComments(page);

  const summary = page.getByRole('alert');
  await expect(summary.getByRole('link')).toHaveText(['Enter your comments']);
  await expect(page.getByLabel(SPONSORS)).toHaveValue('The committee.');
  await expect(hasComments(page, 'Yes')).toBeChecked();

  await expectErrorSummaryReady(page);
  await summary.getByRole('link').click();
  await expect(comments(page)).toBeFocused();
});

test('saves nothing until every answer is given', async ({ page }) => {
  await openSectionPage(page, SECTION);
  const pagePath = new URL(page.url()).pathname;

  await submitYesWithoutComments(page);
  await expect(page.getByRole('alert')).toBeVisible();

  await page.goto(pagePath);
  await expect(page.getByLabel(SPONSORS)).toBeEmpty();
  await expect(page.getByRole('main').getByRole('radio', { checked: true })).toHaveCount(0);
});

test('saves every answer on Continue and shows the task as completed', async ({ page }) => {
  const taskListPath = await openSectionPage(page, SECTION);

  await answerEvery(page);
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL(taskListPath);
  await expect(taskRow(page, SECTION.taskName)).toContainText('Completed');

  await taskRow(page, SECTION.taskName).getByRole('link').click();
  await expect(page.getByLabel(SPONSORS)).toHaveValue('The national screening committee.');
  await expect(hasComments(page, 'Yes')).toBeChecked();
  await expect(comments(page)).toHaveValue('Replaces indicator 108.');
});

test('completes the task without sponsors or stakeholders', async ({ page }) => {
  const taskListPath = await openSectionPage(page, SECTION);

  await hasComments(page, 'No').check();
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL(taskListPath);
  await expect(taskRow(page, SECTION.taskName)).toContainText('Completed');

  await taskRow(page, SECTION.taskName).getByRole('link').click();
  await expect(page.getByLabel(SPONSORS)).toBeEmpty();
  await expect(hasComments(page, 'No')).toBeChecked();
});

test('forgets the comments once the question is answered No instead', async ({ page }) => {
  await openSectionPage(page, SECTION);
  const pagePath = new URL(page.url()).pathname;
  await answerEvery(page);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(taskRow(page, SECTION.taskName)).toContainText('Completed');

  await page.goto(pagePath);
  await hasComments(page, 'No').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(taskRow(page, SECTION.taskName)).toContainText('Completed');

  await page.goto(pagePath);
  await expect(hasComments(page, 'No')).toBeChecked();
  await hasComments(page, 'Yes').check();
  await expect(comments(page)).toBeEmpty();
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
  await expect(page.getByRole('alert')).toContainText(
    'Select whether you have additional comments',
  );

  await expectNoAccessibilityViolations(page, testInfo);
});

test('has no WCAG 2.2 AA violations when the comments are refused', async ({ page }, testInfo) => {
  await openSectionPage(page, SECTION);
  await submitYesWithoutComments(page);
  await expect(page.getByRole('alert')).toContainText('Enter your comments');

  await expectNoAccessibilityViolations(page, testInfo);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('shows the comments field and saves the answers', async ({ page }) => {
    const taskListPath = await openSectionPage(page, SECTION);

    await expect(comments(page)).toBeVisible();

    await answerEvery(page);
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page).toHaveURL(taskListPath);
    await expect(taskRow(page, SECTION.taskName)).toContainText('Completed');
  });
});
