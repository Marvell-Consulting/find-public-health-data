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

const SECTION: Section = { key: 'value-type-and-units', taskName: 'Value type and units' };
const TITLE = 'What are the value type and units used in this indicator?';
const VALUE_TYPE = 'Select value type';
const UNITS = 'Select units';
const STANDARD_POPULATION = 'What standard population has been used?';
const POPULATION =
  'Enter the standard or reference population used for the standardisation calculation';
const UNIT_OTHER = 'Enter unit';

/** The page once hydrated, which hides the follow-ups while nothing is chosen. */
async function openHydratedPage(page: Page): Promise<string> {
  const taskListPath = await openSectionPage(page, SECTION);
  await expect(page.getByLabel(UNIT_OTHER)).toBeHidden();

  return taskListPath;
}

async function chooseValueType(page: Page, name: string) {
  await page.getByLabel(VALUE_TYPE).selectOption({ label: name });
}

async function chooseUnit(page: Page, name: string) {
  await page.getByLabel(UNITS).selectOption({ label: name });
}

function standardPopulationQuestion(page: Page) {
  return page.getByRole('group', { name: STANDARD_POPULATION });
}

// The directly standardised rate's other population, under its "Other" radio.
function standardPopulationOther(page: Page) {
  return standardPopulationQuestion(page).getByLabel(POPULATION);
}

// The reference population of an indirectly standardised value type.
function referencePopulation(page: Page) {
  return page.locator('#referencePopulation-input');
}

async function continueAndExpectErrors(page: Page, messages: string[]) {
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveTitle(/^Error: /);
  await expect(page.getByRole('alert').getByRole('link')).toHaveText(messages);
}

test.beforeEach(async ({ page }) => {
  await signInAs(page, 'Riley Singh');
});

test('is reached from the task list, where it starts as not started', async ({ page }) => {
  await createIndicator(page, uniqueIndicatorName(SECTION.key));
  await expect(taskRow(page, SECTION.taskName)).toContainText('Not started');

  await taskRow(page, SECTION.taskName).getByRole('link').click();

  await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible();
  await expect(page.getByLabel(VALUE_TYPE).locator('option:checked')).toHaveText('Select');
  await expect(page.getByLabel(UNITS).locator('option:checked')).toHaveText('Select');
});

test('lists the value types and units in the order the prototype does, with No unit', async ({
  page,
}) => {
  await openSectionPage(page, SECTION);

  await expect(page.getByLabel(VALUE_TYPE).locator('option')).toHaveText([
    'Select',
    'Count',
    'Crude rate',
    'Directly standardised rate',
    'Excess risk',
    'Gap',
    'Indirectly standardised proportion',
    'Indirectly standardised ratio',
    'Life expectancy',
    'Mean',
    'Median',
    'Percentage point',
    'Proportion',
    'Ratio',
    'Score',
    'Slope index of inequality',
  ]);
  await expect(page.getByLabel(UNITS).locator('option')).toHaveText([
    'Select',
    '%',
    'per 100',
    'per 1,000',
    'per 10,000',
    'per 100,000',
    'per 1,000,000',
    'minutes',
    'hours',
    'days',
    'weeks',
    'months',
    'years',
    '£',
    '£ per capita',
    'No unit',
    'Other',
  ]);
});

test('shows only the questions the chosen value type and unit ask', async ({ page }) => {
  await openHydratedPage(page);

  await expect(standardPopulationQuestion(page)).toBeHidden();
  await expect(referencePopulation(page)).toBeHidden();

  await chooseValueType(page, 'Directly standardised rate');
  await expect(standardPopulationQuestion(page)).toBeVisible();
  await expect(referencePopulation(page)).toBeHidden();

  await chooseValueType(page, 'Indirectly standardised ratio');
  await expect(standardPopulationQuestion(page)).toBeHidden();
  await expect(referencePopulation(page)).toBeVisible();

  await chooseValueType(page, 'Crude rate');
  await expect(standardPopulationQuestion(page)).toBeHidden();
  await expect(referencePopulation(page)).toBeHidden();

  await chooseUnit(page, 'Other');
  await expect(page.getByLabel(UNIT_OTHER)).toBeVisible();
  await chooseUnit(page, 'No unit');
  await expect(page.getByLabel(UNIT_OTHER)).toBeHidden();
});

test('asks for a value type and units when Continue is selected with neither', async ({ page }) => {
  await openSectionPage(page, SECTION);

  await continueAndExpectErrors(page, ['Select the value type', 'Select the units']);

  await expectErrorSummaryReady(page);
  await page.getByRole('alert').getByRole('link', { name: 'Select the units' }).click();
  await expect(page.getByLabel(UNITS)).toBeFocused();
});

test('saves nothing until the follow-ups are answered', async ({ page }) => {
  await openHydratedPage(page);
  const pagePath = new URL(page.url()).pathname;

  await chooseValueType(page, 'Directly standardised rate');
  await continueAndExpectErrors(page, ['Select the standard population used', 'Select the units']);

  await standardPopulationQuestion(page).getByLabel('Other').check();
  await chooseUnit(page, 'Other');
  await continueAndExpectErrors(page, [POPULATION, 'Enter the unit']);

  await page.getByLabel(UNIT_OTHER).fill('x'.repeat(101));
  await continueAndExpectErrors(page, [POPULATION, 'Unit must be 100 characters or fewer']);

  await page.goto(pagePath);
  await expect(page.getByLabel(VALUE_TYPE).locator('option:checked')).toHaveText('Select');
});

test('saves a directly standardised rate and shows the task as completed', async ({ page }) => {
  const taskListPath = await openHydratedPage(page);

  await chooseValueType(page, 'Directly standardised rate');
  await standardPopulationQuestion(page).getByLabel('2013 European Standard Population').check();
  await chooseUnit(page, 'per 100,000');
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL(taskListPath);
  await expect(taskRow(page, SECTION.taskName)).toContainText('Completed');

  await taskRow(page, SECTION.taskName).getByRole('link').click();
  await expect(page.getByLabel(VALUE_TYPE).locator('option:checked')).toHaveText(
    'Directly standardised rate',
  );
  await expect(
    standardPopulationQuestion(page).getByLabel('2013 European Standard Population'),
  ).toBeChecked();
  await expect(page.getByLabel(UNITS).locator('option:checked')).toHaveText('per 100,000');
});

test('saves an other standard population and an other unit by name', async ({ page }) => {
  const taskListPath = await openHydratedPage(page);

  await chooseValueType(page, 'Directly standardised rate');
  await standardPopulationQuestion(page).getByLabel('Other').check();
  await standardPopulationOther(page).fill('  England 2021 mid-year estimates  ');
  await chooseUnit(page, 'Other');
  await page.getByLabel(UNIT_OTHER).fill('per 1,000 live births');
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL(taskListPath);
  await expect(taskRow(page, SECTION.taskName)).toContainText('Completed');

  await taskRow(page, SECTION.taskName).getByRole('link').click();
  await expect(standardPopulationOther(page)).toHaveValue('England 2021 mid-year estimates');
  await expect(page.getByLabel(UNIT_OTHER)).toHaveValue('per 1,000 live births');
});

test('saves an indirectly standardised value type with its reference population', async ({
  page,
}) => {
  const taskListPath = await openHydratedPage(page);

  await chooseValueType(page, 'Indirectly standardised ratio');
  await chooseUnit(page, 'per 100');
  await continueAndExpectErrors(page, [POPULATION]);
  await referencePopulation(page).fill('England 2019');
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL(taskListPath);
  await expect(taskRow(page, SECTION.taskName)).toContainText('Completed');

  await taskRow(page, SECTION.taskName).getByRole('link').click();
  await expect(referencePopulation(page)).toHaveValue('England 2019');
});

test('goes back to the task list', async ({ page }) => {
  const taskListPath = await openSectionPage(page, SECTION);

  await expectBackToTaskList(page, taskListPath);
});

test('answers an indicator with no draft with the not-found page', async ({ page }) => {
  await expectNotFoundWithoutDraft(page, SECTION.key);
});

// Each scan shows the standard population question, whose radio carries the FPH-446 violation.
test('has no WCAG 2.2 AA violations with a directly standardised rate chosen', async ({
  page,
}, testInfo) => {
  await openHydratedPage(page);
  await chooseValueType(page, 'Directly standardised rate');
  await standardPopulationQuestion(page).getByLabel('Other').check();
  await chooseUnit(page, 'Other');
  await expect(standardPopulationOther(page)).toBeVisible();

  await expectNoAccessibilityViolations(page, testInfo);
});

test('has no WCAG 2.2 AA violations when the submission is rejected', async ({
  page,
}, testInfo) => {
  await openHydratedPage(page);
  await chooseValueType(page, 'Directly standardised rate');
  await continueAndExpectErrors(page, ['Select the standard population used', 'Select the units']);

  await expectNoAccessibilityViolations(page, testInfo);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('shows every follow-up question, naming the choice each is for', async ({ page }) => {
    await openSectionPage(page, SECTION);

    await expect(standardPopulationQuestion(page)).toBeVisible();
    await expect(
      standardPopulationQuestion(page).getByText('Only needed for Directly standardised rate'),
    ).toBeVisible();
    await expect(standardPopulationOther(page)).toBeVisible();
    await expect(referencePopulation(page)).toBeVisible();
    await expect(
      page.getByText(
        'Only needed for Indirectly standardised proportion or Indirectly standardised ratio',
      ),
    ).toBeVisible();
    await expect(page.getByLabel(UNIT_OTHER)).toBeVisible();
    await expect(page.getByText('Only needed for Other units')).toBeVisible();
  });

  test('asks only for the answers the chosen value type and unit need', async ({ page }) => {
    const taskListPath = await openSectionPage(page, SECTION);

    await chooseValueType(page, 'Directly standardised rate');
    await chooseUnit(page, '%');
    await referencePopulation(page).fill('Ignored beside a directly standardised rate');
    await page.getByLabel(UNIT_OTHER).fill('Ignored beside a unit in the list');
    await continueAndExpectErrors(page, ['Select the standard population used']);

    await standardPopulationQuestion(page).getByLabel('2013 European Standard Population').check();
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page).toHaveURL(taskListPath);
    await expect(taskRow(page, SECTION.taskName)).toContainText('Completed');

    await taskRow(page, SECTION.taskName).getByRole('link').click();
    await expect(referencePopulation(page)).toHaveValue('');
    await expect(page.getByLabel(UNIT_OTHER)).toHaveValue('');
  });
});
