import { expect, test } from '@playwright/test';

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

const SECTION: Section = { key: 'definition-and-rationale', taskName: 'Definition and rationale' };
const DEFINITION = 'What is the definition of this indicator?';
const RATIONALE = 'What is the rationale for this indicator?';

test.beforeEach(async ({ page }) => {
  await signInAs(page, 'Riley Singh');
});

test('is reached from the task list, where it starts as not started', async ({ page }) => {
  await createIndicator(page, uniqueIndicatorName(SECTION.key));
  await expect(taskRow(page, SECTION.taskName)).toContainText('Not started');

  await taskRow(page, SECTION.taskName).getByRole('link').click();

  await expect(
    page.getByRole('heading', { level: 1, name: 'Definition and rationale' }),
  ).toBeVisible();
  await expect(page.getByLabel(DEFINITION)).toBeEmpty();
  await expect(page.getByLabel(RATIONALE)).toBeEmpty();
});

test('asks for both answers when Continue is selected with the form empty', async ({ page }) => {
  await openSectionPage(page, SECTION);
  const pagePath = new URL(page.url()).pathname;

  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL(pagePath);
  await expect(page).toHaveTitle(/^Error: /);
  const summary = page.getByRole('alert');
  await expect(summary.getByRole('link')).toHaveText([
    'Enter the definition of the indicator',
    'Enter the rationale for the indicator',
  ]);

  await expectErrorSummaryReady(page);
  await summary.getByRole('link', { name: 'Enter the rationale for the indicator' }).click();
  await expect(page.getByLabel(RATIONALE)).toBeFocused();
});

test('saves nothing until both are answered, keeping what was typed', async ({ page }) => {
  await openSectionPage(page, SECTION);
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
  const taskListPath = await openSectionPage(page, SECTION);

  await page.getByLabel(DEFINITION).fill('  The average number of years a newborn would live.  ');
  await page.getByLabel(RATIONALE).fill('A summary measure of mortality.');
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL(taskListPath);
  await expect(taskRow(page, SECTION.taskName)).toContainText('Completed');

  await taskRow(page, SECTION.taskName).getByRole('link').click();
  await expect(page.getByLabel(DEFINITION)).toHaveValue(
    'The average number of years a newborn would live.',
  );
  await expect(page.getByLabel(RATIONALE)).toHaveValue('A summary measure of mortality.');
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

test('has no WCAG 2.2 AA violations when the submission is rejected', async ({
  page,
}, testInfo) => {
  await openSectionPage(page, SECTION);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('alert')).toContainText('Enter the definition of the indicator');

  await expectNoAccessibilityViolations(page, testInfo);
});
