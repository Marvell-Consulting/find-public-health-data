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

const SECTION: Section = { key: 'tagging', taskName: 'Tagging' };
const TITLE = 'Add tags for this indicator';
const RISK_FACTOR_QUESTION = 'Does this indicator include a risk factor?';
const FRAMEWORK_QUESTION = 'Is this indicator part of a framework or programme?';

/** A tag list's select, Add button and added tags, by the noun the page uses for it. */
const LISTS = {
  topic: { label: 'Select a topic', add: 'Add topic' },
  type: { label: 'Select an indicator type', add: 'Add indicator type' },
  riskFactor: { label: 'Select a risk factor', add: 'Add risk factor' },
  framework: { label: 'Select a framework or programme', add: 'Add framework or programme' },
} as const;

type List = keyof typeof LISTS;

function question(page: Page, name: string) {
  return page.getByRole('group', { name });
}

async function addTag(page: Page, list: List, name: string) {
  await page.getByLabel(LISTS[list].label, { exact: true }).selectOption({ label: name });
  await page.getByRole('button', { name: LISTS[list].add, exact: true }).click();
  await expect(page.getByRole('button', { name: new RegExp(` ${name}$`) })).toBeVisible();
}

/** The names of the tags added so far, read from their Remove buttons in page order. */
function removeButtons(page: Page, noun: string) {
  return page.getByRole('button', { name: new RegExp(`^Remove ${noun} `) });
}

async function answer(page: Page, name: string, choice: 'Yes' | 'No') {
  await question(page, name).getByLabel(choice, { exact: true }).check();
}

async function tagEverything(page: Page) {
  await addTag(page, 'topic', 'Alcohol');
  await addTag(page, 'topic', 'Cancer');
  await addTag(page, 'type', 'Outcome');
  await answer(page, RISK_FACTOR_QUESTION, 'Yes');
  await addTag(page, 'riskFactor', 'Gambling');
  await answer(page, FRAMEWORK_QUESTION, 'No');
}

test.beforeEach(async ({ page }) => {
  await signInAs(page, 'Riley Singh');
});

test('is reached from the task list, where it starts as not started', async ({ page }) => {
  await createIndicator(page, uniqueIndicatorName(SECTION.key));
  await expect(taskRow(page, SECTION.taskName)).toContainText('Not started');

  await taskRow(page, SECTION.taskName).getByRole('link').click();

  await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible();
  await expect(page.getByLabel(LISTS.topic.label, { exact: true })).toHaveValue('');
  await expect(question(page, RISK_FACTOR_QUESTION).getByLabel('Yes')).not.toBeChecked();
});

test('asks every question when Continue is selected with the form empty', async ({ page }) => {
  await openSectionPage(page, SECTION);
  const pagePath = new URL(page.url()).pathname;

  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL(pagePath);
  await expect(page).toHaveTitle(/^Error: /);
  const summary = page.getByRole('alert');
  await expect(summary.getByRole('link')).toHaveText([
    'Select at least one topic',
    'Select at least one indicator type',
    'Select whether this indicator includes a risk factor',
    'Select whether this indicator is part of a framework or programme',
  ]);

  await expectErrorSummaryReady(page);
  await summary.getByRole('link', { name: 'Select at least one topic' }).click();
  await expect(page.getByLabel(LISTS.topic.label, { exact: true })).toBeFocused();
});

test('reveals the risk factors and frameworks only while "Yes" is chosen', async ({ page }) => {
  await openSectionPage(page, SECTION);

  await expect(page.getByLabel(LISTS.riskFactor.label, { exact: true })).toBeHidden();
  await expect(page.getByLabel(LISTS.framework.label, { exact: true })).toBeHidden();

  await answer(page, RISK_FACTOR_QUESTION, 'Yes');
  await answer(page, FRAMEWORK_QUESTION, 'Yes');
  await expect(page.getByLabel(LISTS.riskFactor.label, { exact: true })).toBeVisible();
  await expect(page.getByLabel(LISTS.framework.label, { exact: true })).toBeVisible();

  await answer(page, RISK_FACTOR_QUESTION, 'No');
  await expect(page.getByLabel(LISTS.riskFactor.label, { exact: true })).toBeHidden();
});

test('adds tags to each list and removes them, clearing the select', async ({ page }) => {
  await openSectionPage(page, SECTION);

  await addTag(page, 'topic', 'Cancer');
  await addTag(page, 'topic', 'Alcohol');
  await addTag(page, 'type', 'Outcome');

  await expect(removeButtons(page, 'topic')).toHaveText([
    'Remove topic Cancer',
    'Remove topic Alcohol',
  ]);
  await expect(page.getByLabel(LISTS.topic.label, { exact: true })).toHaveValue('');

  await page.getByRole('button', { name: 'Remove topic Cancer' }).click();

  await expect(removeButtons(page, 'topic')).toHaveText(['Remove topic Alcohol']);
  await expect(removeButtons(page, 'indicator type')).toHaveText(['Remove indicator type Outcome']);
});

test('asks for a tag when Add is selected with none chosen', async ({ page }) => {
  await openSectionPage(page, SECTION);

  await page.getByRole('button', { name: LISTS.topic.add, exact: true }).click();

  const summary = page.getByRole('alert');
  await expect(summary.getByRole('link')).toHaveText(['Select a topic']);
  await expectErrorSummaryReady(page);
  await summary.getByRole('link').click();
  await expect(page.getByLabel(LISTS.topic.label, { exact: true })).toBeFocused();
});

test('asks for a risk factor and a framework beside "Yes"', async ({ page }) => {
  await openSectionPage(page, SECTION);
  await addTag(page, 'topic', 'Alcohol');
  await addTag(page, 'type', 'Outcome');
  await answer(page, RISK_FACTOR_QUESTION, 'Yes');
  await answer(page, FRAMEWORK_QUESTION, 'Yes');

  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByRole('alert').getByRole('link')).toHaveText([
    'Select at least one risk factor',
    'Select at least one framework or programme',
  ]);
  await expect(removeButtons(page, 'topic')).toHaveText(['Remove topic Alcohol']);
});

test('saves nothing until Continue is selected', async ({ page }) => {
  await openSectionPage(page, SECTION);
  const pagePath = new URL(page.url()).pathname;
  await addTag(page, 'topic', 'Alcohol');

  await page.goto(pagePath);

  await expect(removeButtons(page, 'topic')).toHaveCount(0);
});

test('saves the tags on Continue and shows the task as completed', async ({ page }) => {
  const taskListPath = await openSectionPage(page, SECTION);
  await tagEverything(page);
  // Chosen but not added, which Continue takes in.
  await page
    .getByLabel(LISTS.type.label, { exact: true })
    .selectOption({ label: 'Treatment and care' });

  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL(taskListPath);
  await expect(taskRow(page, SECTION.taskName)).toContainText('Completed');

  await taskRow(page, SECTION.taskName).getByRole('link').click();
  await expect(removeButtons(page, 'topic')).toHaveText([
    'Remove topic Alcohol',
    'Remove topic Cancer',
  ]);
  await expect(removeButtons(page, 'indicator type')).toHaveText([
    'Remove indicator type Outcome',
    'Remove indicator type Treatment and care',
  ]);
  await expect(question(page, RISK_FACTOR_QUESTION).getByLabel('Yes')).toBeChecked();
  await expect(removeButtons(page, 'risk factor')).toHaveText(['Remove risk factor Gambling']);
  await expect(question(page, FRAMEWORK_QUESTION).getByLabel('No')).toBeChecked();
});

test('saves "No" and forgets any risk factors saved before', async ({ page }) => {
  const taskListPath = await openSectionPage(page, SECTION);
  const pagePath = new URL(page.url()).pathname;
  await tagEverything(page);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(taskListPath);

  await page.goto(pagePath);
  await answer(page, RISK_FACTOR_QUESTION, 'No');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(taskRow(page, SECTION.taskName)).toContainText('Completed');

  await page.goto(pagePath);
  await expect(question(page, RISK_FACTOR_QUESTION).getByLabel('No')).toBeChecked();
  await expect(removeButtons(page, 'risk factor')).toHaveCount(0);
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

test('has no WCAG 2.2 AA violations with tags added and the form refused', async ({
  page,
}, testInfo) => {
  await openSectionPage(page, SECTION);
  await addTag(page, 'topic', 'Alcohol');
  await answer(page, RISK_FACTOR_QUESTION, 'Yes');
  await addTag(page, 'riskFactor', 'Gambling');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('alert')).toBeVisible();

  await expectNoAccessibilityViolations(page, testInfo);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('adds and removes tags, then saves them', async ({ page }) => {
    const taskListPath = await openSectionPage(page, SECTION);

    // Conditional reveals stay open without JavaScript.
    await expect(page.getByLabel(LISTS.framework.label, { exact: true })).toBeVisible();

    await addTag(page, 'topic', 'Alcohol');
    await addTag(page, 'type', 'Outcome');
    await addTag(page, 'riskFactor', 'Gambling');
    await expect(question(page, RISK_FACTOR_QUESTION).getByLabel('Yes')).toBeChecked();
    await addTag(page, 'framework', 'Healthy Child');
    await page.getByRole('button', { name: 'Remove framework or programme Healthy Child' }).click();
    await answer(page, FRAMEWORK_QUESTION, 'No');
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page).toHaveURL(taskListPath);
    await expect(taskRow(page, SECTION.taskName)).toContainText('Completed');
  });
});
