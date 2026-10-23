import { expect, type Page, test } from '@playwright/test';

import { expectNoAccessibilityViolations } from '../support/accessibility.ts';
import { expectErrorSummaryReady } from '../support/govuk-frontend.ts';
import {
  describeSectionPage,
  openSectionPage,
  type Section,
  taskRow,
} from '../support/section-page.ts';
import { chooseOption } from '../support/select-autocomplete.ts';
import { PUBLISHER } from '../support/sign-in.ts';
import { expectQuestionStyles, QUESTION, SUB_QUESTION } from '../support/typography.ts';

const SECTION: Section = { key: 'tagging', taskName: 'Tagging' };
const TITLE = 'Add tags for this indicator';
const LIFE_STAGE_QUESTION = 'Does this indicator need a life stage tag?';
const FRAMEWORK_QUESTION = 'Is this indicator part of a framework or programme?';

/** A tag list's select, Add button and added tags, by the noun the page uses for it. */
const LISTS = {
  topic: { label: 'Select a topic', add: 'Add topic' },
  subtopic: { label: 'Select a subtopic', add: 'Add subtopic' },
  type: { label: 'Select a measure type', add: 'Add measure type' },
  lifeStage: { label: 'Select a life stage', add: 'Add life stage' },
  framework: { label: 'Select a framework or programme', add: 'Add framework or programme' },
} as const;

type List = keyof typeof LISTS;

function question(page: Page, name: string) {
  return page.getByRole('group', { name });
}

/** Adds a tag; `navigates` is for pages without JavaScript, where Add posts the form. */
async function addTag(page: Page, list: List, name: string, navigates = false) {
  if (navigates) {
    await page.getByLabel(LISTS[list].label, { exact: true }).selectOption({ label: name });
  } else {
    await chooseOption(page, LISTS[list].label, name);
  }
  const navigation = navigates
    ? page.waitForEvent('framenavigated', { predicate: (frame) => frame === page.mainFrame() })
    : undefined;
  await page.getByRole('button', { name: LISTS[list].add, exact: true }).click();
  if (navigation) {
    await navigation;
    await page.waitForLoadState();
  }
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
  await addTag(page, 'topic', 'Diabetes');
  await addTag(page, 'topic', 'Cancer');
  await chooseOption(page, 'Select a primary topic', 'Diabetes');
  await addTag(page, 'type', 'Outcome');
  await answer(page, LIFE_STAGE_QUESTION, 'Yes');
  await addTag(page, 'lifeStage', 'Children');
  await answer(page, FRAMEWORK_QUESTION, 'No');
}

test.use({ storageState: PUBLISHER.storageState });

describeSectionPage(SECTION, {
  expectUnanswered: async (page) => {
    await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible();
    await expect(page.getByLabel(LISTS.topic.label, { exact: true })).toHaveValue('');
    await expect(question(page, LIFE_STAGE_QUESTION).getByLabel('Yes')).not.toBeChecked();
  },
  refusal: {
    messages: [
      'Select at least one topic',
      'Select a primary topic',
      'Select a measure type',
      'Select whether this indicator needs a life stage tag',
      'Select whether this indicator is part of a framework or programme',
    ],
    focuses: (page) => page.getByLabel(LISTS.topic.label, { exact: true }),
  },
});

// Yes reveals a question of its own rather than the details of an answer, so it is a heading
// like the pickers the page asks for outright, a level below them.
test('asks the questions under Yes at the same size and weight', async ({ page }) => {
  await openSectionPage(page, SECTION);
  await answer(page, LIFE_STAGE_QUESTION, 'Yes');
  await answer(page, FRAMEWORK_QUESTION, 'Yes');

  await expectQuestionStyles(page, [LISTS.lifeStage.label, LISTS.framework.label], SUB_QUESTION);
  await expectQuestionStyles(
    page,
    [LISTS.topic.label, LISTS.type.label, LIFE_STAGE_QUESTION, FRAMEWORK_QUESTION],
    QUESTION,
  );
});

test('reveals the life stages and frameworks only while "Yes" is chosen', async ({ page }) => {
  await openSectionPage(page, SECTION);

  await expect(page.getByLabel(LISTS.lifeStage.label, { exact: true })).toBeHidden();
  await expect(page.getByLabel(LISTS.framework.label, { exact: true })).toBeHidden();

  await answer(page, LIFE_STAGE_QUESTION, 'Yes');
  await answer(page, FRAMEWORK_QUESTION, 'Yes');
  await expect(page.getByLabel(LISTS.lifeStage.label, { exact: true })).toBeVisible();
  await expect(page.getByLabel(LISTS.framework.label, { exact: true })).toBeVisible();

  await answer(page, LIFE_STAGE_QUESTION, 'No');
  await expect(page.getByLabel(LISTS.lifeStage.label, { exact: true })).toBeHidden();
});

test('adds tags to each list and removes them, clearing the select', async ({ page }) => {
  await openSectionPage(page, SECTION);

  await addTag(page, 'topic', 'Cancer');
  await addTag(page, 'topic', 'Diabetes');
  await addTag(page, 'type', 'Outcome');

  await expect(removeButtons(page, 'topic')).toHaveText([
    'Remove topic Cancer',
    'Remove topic Diabetes',
  ]);
  await expect(page.getByLabel(LISTS.topic.label, { exact: true })).toHaveValue('');

  await page.getByRole('button', { name: 'Remove topic Cancer' }).click();

  await expect(removeButtons(page, 'topic')).toHaveText(['Remove topic Diabetes']);
  await expect(removeButtons(page, 'measure type')).toHaveText(['Remove measure type Outcome']);
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

test('asks for a life stage and a framework beside "Yes"', async ({ page }) => {
  await openSectionPage(page, SECTION);
  await addTag(page, 'topic', 'Diabetes');
  await addTag(page, 'type', 'Outcome');
  await chooseOption(page, 'Select a primary topic', 'Diabetes');
  await answer(page, LIFE_STAGE_QUESTION, 'Yes');
  await answer(page, FRAMEWORK_QUESTION, 'Yes');

  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByRole('alert').getByRole('link')).toHaveText([
    'Select at least one life stage',
    'Select at least one framework or programme',
  ]);
  await expect(removeButtons(page, 'topic')).toHaveText(['Remove topic Diabetes']);
});

test('saves nothing until Continue is selected', async ({ page }) => {
  await openSectionPage(page, SECTION);
  const pagePath = new URL(page.url()).pathname;
  await addTag(page, 'topic', 'Diabetes');

  await page.goto(pagePath);

  await expect(removeButtons(page, 'topic')).toHaveCount(0);
});

test('saves the tags on Continue and shows the task as completed', async ({ page }) => {
  const taskListPath = await openSectionPage(page, SECTION);
  await tagEverything(page);
  await page.getByRole('button', { name: 'Remove measure type Outcome' }).click();
  // Chosen but not added, which Continue takes in.
  await chooseOption(page, LISTS.type.label, 'Intervention or service');

  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL(taskListPath);
  await expect(taskRow(page, SECTION.taskName)).toContainText('Completed');

  await taskRow(page, SECTION.taskName).getByRole('link').click();
  await expect(removeButtons(page, 'topic')).toHaveText([
    'Remove topic Cancer',
    'Remove topic Diabetes',
  ]);
  await expect(removeButtons(page, 'measure type')).toHaveText([
    'Remove measure type Intervention or service',
  ]);
  await expect(question(page, LIFE_STAGE_QUESTION).getByLabel('Yes')).toBeChecked();
  await expect(removeButtons(page, 'life stage')).toHaveText(['Remove life stage Children']);
  await expect(question(page, FRAMEWORK_QUESTION).getByLabel('No')).toBeChecked();
});

test('edits primary topics and subtopics without leaving stale placements', async ({
  page,
}, testInfo) => {
  const taskListPath = await openSectionPage(page, SECTION);
  const pagePath = new URL(page.url()).pathname;
  await tagEverything(page);
  await addTag(page, 'subtopic', 'Cancer: All cancers');
  await addTag(page, 'subtopic', 'Diabetes: Care and treatment');
  await chooseOption(page, 'Select a primary subtopic', 'Diabetes: Care and treatment');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(taskListPath);
  await page.goto(pagePath);
  await expect(page.getByLabel('Select a primary topic', { exact: true })).toHaveValue(/.+/);
  await chooseOption(page, 'Select a primary topic', 'Cancer');
  await chooseOption(page, 'Select a primary subtopic', 'Cancer: All cancers');
  await page.getByRole('button', { name: 'Remove topic Diabetes', exact: true }).click();
  await expect(removeButtons(page, 'subtopic')).toHaveText(['Remove subtopic Cancer: All cancers']);
  await expectNoAccessibilityViolations(page, testInfo);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(taskListPath);
  await page.goto(pagePath);
  await expect(removeButtons(page, 'topic')).toHaveText(['Remove topic Cancer']);
  await expect(removeButtons(page, 'subtopic')).toHaveText(['Remove subtopic Cancer: All cancers']);
  await expect(page.locator('select[name="primaryTopicId"] option:checked')).toHaveText('Cancer');
  await expect(page.locator('select[name="primarySubtopicId"] option:checked')).toHaveText(
    'Cancer: All cancers',
  );
});

test('saves "No" and forgets any life stages saved before', async ({ page }) => {
  const taskListPath = await openSectionPage(page, SECTION);
  const pagePath = new URL(page.url()).pathname;
  await tagEverything(page);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(taskListPath);

  await page.goto(pagePath);
  await answer(page, LIFE_STAGE_QUESTION, 'No');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(taskRow(page, SECTION.taskName)).toContainText('Completed');

  await page.goto(pagePath);
  await expect(question(page, LIFE_STAGE_QUESTION).getByLabel('No')).toBeChecked();
  await expect(removeButtons(page, 'life stage')).toHaveCount(0);
});

test('has no WCAG 2.2 AA violations', async ({ page }, testInfo) => {
  await openSectionPage(page, SECTION);

  await expectNoAccessibilityViolations(page, testInfo);
});

test('keeps area context without topic or tag assignments', async ({ page }, testInfo) => {
  const taskListPath = await openSectionPage(page, SECTION);
  const areaContextYes = page.locator('input[name="isAreaContext"][value="yes"]');
  await areaContextYes.check();
  await expect(page.getByLabel(LISTS.topic.label, { exact: true })).toBeHidden();
  await expectNoAccessibilityViolations(page, testInfo);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(taskListPath);
  await expect(taskRow(page, SECTION.taskName)).toContainText('Completed');
  await taskRow(page, SECTION.taskName).getByRole('link').click();
  await expect(areaContextYes).toBeChecked();
  await expect(removeButtons(page, 'topic')).toHaveCount(0);
  await expectNoAccessibilityViolations(page, testInfo);
});

test('has no WCAG 2.2 AA violations with tags added and the form refused', async ({
  page,
}, testInfo) => {
  await openSectionPage(page, SECTION);
  await addTag(page, 'topic', 'Diabetes');
  await answer(page, LIFE_STAGE_QUESTION, 'Yes');
  await addTag(page, 'lifeStage', 'Children');
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

    await addTag(page, 'topic', 'Diabetes', true);
    await page
      .getByLabel('Select a primary topic', { exact: true })
      .selectOption({ label: 'Diabetes' });
    await addTag(page, 'type', 'Outcome', true);
    await addTag(page, 'lifeStage', 'Children', true);
    await expect(question(page, LIFE_STAGE_QUESTION).getByLabel('Yes')).toBeChecked();
    await addTag(page, 'framework', 'Healthy Child Programme', true);
    await page
      .getByRole('button', { name: 'Remove framework or programme Healthy Child Programme' })
      .click();
    await answer(page, FRAMEWORK_QUESTION, 'No');
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page).toHaveURL(taskListPath);
    await expect(taskRow(page, SECTION.taskName)).toContainText('Completed');
  });
});
