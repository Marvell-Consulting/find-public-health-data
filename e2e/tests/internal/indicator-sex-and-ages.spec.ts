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

const SECTION: Section = { key: 'sex-and-ages', taskName: 'Sex and ages' };
const TITLE = 'What are the sexes and ages included in this indicator?';

function label(page: Page, text: string) {
  return page.getByLabel(text, { exact: true });
}

/** Fills one limit: its number, and the period chosen beside it. */
async function fillLimit(page: Page, limit: string, value: string, period: string) {
  await label(page, limit).fill(value);
  await label(page, `Periods for ${limit.toLowerCase()}`).selectOption(period);
}

// The Other field shares its label with the Other age type.
function ageType(page: Page, name: string) {
  return page.getByRole('radio', { name, exact: true });
}

function otherField(page: Page) {
  return page.getByRole('textbox', { name: 'Other', exact: true });
}

test.beforeEach(async ({ page }) => {
  await signInAs(page, 'Riley Singh');
});

test('is reached from the task list, where it starts as not started', async ({ page }) => {
  await createIndicator(page, uniqueIndicatorName(SECTION.key));
  await expect(taskRow(page, SECTION.taskName)).toContainText('Not started');

  await taskRow(page, SECTION.taskName).getByRole('link').click();

  await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible();
  for (const sex of ['Persons', 'Females', 'Males']) {
    await expect(label(page, sex)).not.toBeChecked();
  }
  for (const name of ['All ages', 'Age range', 'Specific age', 'Other']) {
    await expect(ageType(page, name)).not.toBeChecked();
  }
});

test('asks for the sexes and the age type when Continue is selected with the form empty', async ({
  page,
}) => {
  await openSectionPage(page, SECTION);
  const pagePath = new URL(page.url()).pathname;

  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL(pagePath);
  await expect(page).toHaveTitle(/^Error: /);
  const summary = page.getByRole('alert');
  await expect(summary.getByRole('link')).toHaveText([
    'Select sexes included',
    'Select the age type',
  ]);

  await expectErrorSummaryReady(page);
  await summary.getByRole('link', { name: 'Select sexes included' }).click();
  await expect(label(page, 'Persons')).toBeFocused();
});

test('reveals the fields of each age type only while it is chosen', async ({ page }) => {
  await openSectionPage(page, SECTION);

  await expect(label(page, 'Lower limit')).toBeHidden();
  await expect(label(page, 'Age')).toBeHidden();
  await expect(otherField(page)).toBeHidden();

  await ageType(page, 'Age range').check();
  await expect(label(page, 'Lower limit')).toBeVisible();
  await expect(label(page, 'Upper limit')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add another range' })).toBeVisible();

  await ageType(page, 'Specific age').check();
  await expect(label(page, 'Lower limit')).toBeHidden();
  await expect(label(page, 'Age')).toBeVisible();

  await ageType(page, 'Other').check();
  await expect(label(page, 'Age')).toBeHidden();
  await expect(otherField(page)).toBeVisible();
});

test('adds and removes age ranges, keeping what was typed', async ({ page }) => {
  await openSectionPage(page, SECTION);
  await ageType(page, 'Age range').check();
  await fillLimit(page, 'Lower limit', '16', 'years');

  await page.getByRole('button', { name: 'Add another range' }).click();
  await page.getByRole('button', { name: 'Add another range' }).click();

  await expect(label(page, 'Lower limit')).toHaveValue('16');
  await expect(label(page, 'Lower limit 3')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Remove range/ })).toHaveText([
    'Remove range 2',
    'Remove range 3',
  ]);

  await fillLimit(page, 'Upper limit 3', '4', 'months');
  await page.getByRole('button', { name: 'Remove range 2' }).click();

  await expect(label(page, 'Upper limit 2')).toHaveValue('4');
  await expect(label(page, 'Periods for upper limit 2')).toHaveValue('months');
  await expect(label(page, 'Lower limit 3')).toHaveCount(0);
});

test('shows each range after a removed one with its own values', async ({ page }) => {
  await openSectionPage(page, SECTION);
  await ageType(page, 'Age range').check();
  await fillLimit(page, 'Lower limit', '1', 'days');
  await page.getByRole('button', { name: 'Add another range' }).click();
  await fillLimit(page, 'Lower limit 2', '2', 'weeks');
  await fillLimit(page, 'Upper limit 2', '20', 'weeks');
  await page.getByRole('button', { name: 'Add another range' }).click();
  await fillLimit(page, 'Lower limit 3', '3', 'years');
  await fillLimit(page, 'Upper limit 3', '30', 'years');

  await page.getByRole('button', { name: 'Remove range 2' }).click();

  await expect(label(page, 'Lower limit')).toHaveValue('1');
  await expect(label(page, 'Lower limit 2')).toHaveValue('3');
  await expect(label(page, 'Periods for lower limit 2')).toHaveValue('years');
  await expect(label(page, 'Upper limit 2')).toHaveValue('30');
  await expect(label(page, 'Periods for upper limit 2')).toHaveValue('years');
  await expect(label(page, 'Lower limit 3')).toHaveCount(0);
});

test('refuses each range on the field at fault, naming the range from the second on', async ({
  page,
}) => {
  await openSectionPage(page, SECTION);
  await label(page, 'Persons').check();
  await ageType(page, 'Age range').check();
  await label(page, 'Lower limit').fill('16');
  await page.getByRole('button', { name: 'Add another range' }).click();
  await page.getByRole('button', { name: 'Add another range' }).click();
  await fillLimit(page, 'Lower limit 3', '5', 'years');
  await fillLimit(page, 'Upper limit 3', '4', 'years');

  await page.getByRole('button', { name: 'Continue' }).click();

  const summary = page.getByRole('alert');
  await expect(summary.getByRole('link')).toHaveText([
    'Select the periods for the lower limit',
    'You must enter at least a lower or upper limit for range 2',
    'Upper limit 3 must not be lower than lower limit 3',
  ]);

  await expectErrorSummaryReady(page);
  await summary.getByRole('link', { name: /range 2$/ }).click();
  await expect(label(page, 'Lower limit 2')).toBeFocused();
});

test('asks for the specific age and its period, and for other ages', async ({ page }) => {
  await openSectionPage(page, SECTION);
  await label(page, 'Males').check();
  await ageType(page, 'Specific age').check();
  await label(page, 'Periods for age').selectOption('weeks');

  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('alert').getByRole('link')).toHaveText(['Enter the age']);

  await ageType(page, 'Other').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('alert').getByRole('link')).toHaveText(['Enter the ages included']);
});

test('continues when Enter is pressed in a field, rather than adding or removing a range', async ({
  page,
}) => {
  const taskListPath = await openSectionPage(page, SECTION);
  await label(page, 'Females').check();
  await ageType(page, 'Age range').check();
  await fillLimit(page, 'Lower limit', '16', 'years');
  await page.getByRole('button', { name: 'Add another range' }).click();
  await fillLimit(page, 'Upper limit 2', '4', 'years');

  await label(page, 'Upper limit 2').press('Enter');

  await expect(page).toHaveURL(taskListPath);
  await expect(taskRow(page, SECTION.taskName)).toContainText('Completed');
});

test('saves nothing until Continue is selected', async ({ page }) => {
  await openSectionPage(page, SECTION);
  const pagePath = new URL(page.url()).pathname;
  await ageType(page, 'Age range').check();
  await fillLimit(page, 'Lower limit', '16', 'years');
  await page.getByRole('button', { name: 'Add another range' }).click();

  await page.goto(pagePath);

  await expect(ageType(page, 'Age range')).not.toBeChecked();
  await expect(label(page, 'Lower limit 2')).toHaveCount(0);
});

test('saves the sexes and ages on Continue and shows the task as completed', async ({ page }) => {
  const taskListPath = await openSectionPage(page, SECTION);
  const pagePath = new URL(page.url()).pathname;
  await label(page, 'Females').check();
  await label(page, 'Males').check();
  await ageType(page, 'Age range').check();
  await fillLimit(page, 'Upper limit', '11', 'months');
  await page.getByRole('button', { name: 'Add another range' }).click();
  await fillLimit(page, 'Lower limit 2', '1', 'years');
  await fillLimit(page, 'Upper limit 2', '4', 'years');

  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL(taskListPath);
  await expect(taskRow(page, SECTION.taskName)).toContainText('Completed');

  await page.goto(pagePath);
  await expect(label(page, 'Persons')).not.toBeChecked();
  await expect(label(page, 'Females')).toBeChecked();
  await expect(label(page, 'Males')).toBeChecked();
  await expect(ageType(page, 'Age range')).toBeChecked();
  await expect(label(page, 'Lower limit')).toHaveValue('');
  await expect(label(page, 'Upper limit')).toHaveValue('11');
  await expect(label(page, 'Periods for upper limit')).toHaveValue('months');
  await expect(label(page, 'Lower limit 2')).toHaveValue('1');
  await expect(label(page, 'Upper limit 2')).toHaveValue('4');
});

test('saves all ages alone and shows the task as completed', async ({ page }) => {
  const taskListPath = await openSectionPage(page, SECTION);
  const pagePath = new URL(page.url()).pathname;
  await label(page, 'Persons').check();
  await ageType(page, 'All ages').check();

  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL(taskListPath);
  await expect(taskRow(page, SECTION.taskName)).toContainText('Completed');
  await page.goto(pagePath);
  await expect(ageType(page, 'All ages')).toBeChecked();
});

test('saves another age type and forgets the ranges saved before', async ({ page }) => {
  const taskListPath = await openSectionPage(page, SECTION);
  const pagePath = new URL(page.url()).pathname;
  await label(page, 'Persons').check();
  await ageType(page, 'Age range').check();
  await fillLimit(page, 'Lower limit', '65', 'years');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(taskListPath);

  await page.goto(pagePath);
  await ageType(page, 'Other').check();
  await otherField(page).fill('School year 6');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(taskRow(page, SECTION.taskName)).toContainText('Completed');

  await page.goto(pagePath);
  await expect(ageType(page, 'Other')).toBeChecked();
  await expect(otherField(page)).toHaveValue('School year 6');
  await ageType(page, 'Age range').check();
  await expect(label(page, 'Lower limit')).toHaveValue('');
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

test('has no WCAG 2.2 AA violations with ranges added and refused', async ({ page }, testInfo) => {
  await openSectionPage(page, SECTION);
  await ageType(page, 'Age range').check();
  await page.getByRole('button', { name: 'Add another range' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('alert')).toContainText('for range 2');

  await expectNoAccessibilityViolations(page, testInfo);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('adds and removes age ranges, then saves them', async ({ page }) => {
    const taskListPath = await openSectionPage(page, SECTION);

    await expect(label(page, 'Lower limit')).toBeVisible();

    await label(page, 'Persons').check();
    await fillLimit(page, 'Lower limit', '16', 'years');
    await page.getByRole('button', { name: 'Add another range' }).click();
    await expect(ageType(page, 'Age range')).toBeChecked();
    await page.getByRole('button', { name: 'Add another range' }).click();
    await page.getByRole('button', { name: 'Remove range 3' }).click();
    await fillLimit(page, 'Upper limit 2', '4', 'years');
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page).toHaveURL(taskListPath);
    await expect(taskRow(page, SECTION.taskName)).toContainText('Completed');
  });
});
