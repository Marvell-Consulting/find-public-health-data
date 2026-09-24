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

const SECTION: Section = { key: 'confidence-intervals', taskName: 'Confidence intervals' };
const METHOD = 'Select the confidence interval method used';
const MODIFIED = 'Were any modifications to the described method used for this indicator?';
const MODIFICATIONS = 'Enter description of the modifications used';
const OTHER_DETAIL = 'Provide detail of the other confidence interval method used';

/** The page once hydrated, which hides the follow-ups while no method is chosen. */
async function openHydratedPage(page: Page): Promise<string> {
  const taskListPath = await openSectionPage(page, SECTION);
  await expect(page.getByLabel(OTHER_DETAIL)).toBeHidden();

  return taskListPath;
}

async function chooseMethod(page: Page, name: string) {
  await page.getByLabel(METHOD).selectOption({ label: name });
}

function modifiedQuestion(page: Page) {
  return page.getByRole('group', { name: MODIFIED });
}

function standardDescription(page: Page) {
  return page.getByRole('heading', { level: 2, name: 'Standard description' });
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

  await expect(page.getByRole('heading', { level: 1, name: 'Confidence intervals' })).toBeVisible();
  await expect(page.getByLabel(METHOD).locator('option:checked')).toHaveText('Select');
});

test('shows only the questions the chosen method asks', async ({ page }) => {
  await openHydratedPage(page);

  await expect(modifiedQuestion(page)).toBeHidden();
  await expect(page.getByLabel(OTHER_DETAIL)).toBeHidden();

  await chooseMethod(page, "Byar's method");
  await expect(standardDescription(page)).toBeVisible();
  await expect(modifiedQuestion(page)).toBeVisible();
  await expect(page.getByLabel(OTHER_DETAIL)).toBeHidden();

  await chooseMethod(page, 'Other method');
  await expect(standardDescription(page)).toBeHidden();
  await expect(modifiedQuestion(page)).toBeHidden();
  await expect(page.getByLabel(OTHER_DETAIL)).toBeVisible();

  await chooseMethod(page, 'Unknown');
  await expect(modifiedQuestion(page)).toBeHidden();
  await expect(page.getByLabel(OTHER_DETAIL)).toBeHidden();
});

test('lists the methods in the order the prototype does', async ({ page }) => {
  await openSectionPage(page, SECTION);

  await expect(page.getByLabel(METHOD).locator('option')).toHaveText([
    'Select',
    "Byar's method",
    "Byar's method (adjusted for repeat hospital admissions)",
    "Byar's method (no small number correction)",
    'Chiang-Silcocks method',
    "Dobson & Byar's methods",
    'Exact Poisson method',
    'Newcombe-Wilson method',
    'No confidence intervals available',
    'Other method',
    'T-distribution method',
    'Unknown',
    'Wald normal approximation',
    'Wilson Score method',
  ]);
});

test('asks for a method when Continue is selected with none chosen', async ({ page }) => {
  await openSectionPage(page, SECTION);

  await continueAndExpectErrors(page, [METHOD]);

  await expectErrorSummaryReady(page);
  await page.getByRole('alert').getByRole('link', { name: METHOD }).click();
  await expect(page.getByLabel(METHOD)).toBeFocused();
});

test('saves nothing until the chosen method is fully answered', async ({ page }) => {
  await openHydratedPage(page);
  const pagePath = new URL(page.url()).pathname;

  await chooseMethod(page, "Byar's method");
  await continueAndExpectErrors(page, ['Select whether any modifications were used']);

  await modifiedQuestion(page).getByLabel('Yes').check();
  await continueAndExpectErrors(page, ['Enter a description of the modifications used']);

  await page.goto(pagePath);
  await expect(page.getByLabel(METHOD).locator('option:checked')).toHaveText('Select');
});

test('saves a modified standard method and shows the task as completed', async ({ page }) => {
  const taskListPath = await openHydratedPage(page);

  await chooseMethod(page, "Byar's method");
  await modifiedQuestion(page).getByLabel('Yes').check();
  await page.getByLabel(MODIFICATIONS).fill('  Adjusted for repeat admissions  ');
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL(taskListPath);
  await expect(taskRow(page, SECTION.taskName)).toContainText('Completed');

  await taskRow(page, SECTION.taskName).getByRole('link').click();
  await expect(page.getByLabel(METHOD).locator('option:checked')).toHaveText("Byar's method");
  await expect(standardDescription(page)).toBeVisible();
  await expect(modifiedQuestion(page).getByLabel('Yes')).toBeChecked();
  await expect(page.getByLabel(MODIFICATIONS)).toHaveValue('Adjusted for repeat admissions');
});

test('saves an other method with its detail and shows the task as completed', async ({ page }) => {
  const taskListPath = await openHydratedPage(page);

  await chooseMethod(page, 'Other method');
  await continueAndExpectErrors(page, [
    'Enter details of the other confidence interval method used',
  ]);
  await page.getByLabel(OTHER_DETAIL).fill('Bootstrap intervals');
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL(taskListPath);
  await expect(taskRow(page, SECTION.taskName)).toContainText('Completed');
});

test('saves a method with nothing to describe on its own', async ({ page }) => {
  const taskListPath = await openHydratedPage(page);

  await chooseMethod(page, 'No confidence intervals available');
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL(taskListPath);
  await expect(taskRow(page, SECTION.taskName)).toContainText('Completed');
});

test('goes back to the task list', async ({ page }) => {
  const taskListPath = await openSectionPage(page, SECTION);

  await expectBackToTaskList(page, taskListPath);
});

test('answers an indicator with no draft with the not-found page', async ({ page }) => {
  await expectNotFoundWithoutDraft(page, SECTION.key);
});

// Each scan shows the modifications question, whose radio carries the FPH-446 known violation.
test('has no WCAG 2.2 AA violations with a standard method chosen', async ({ page }, testInfo) => {
  await openHydratedPage(page);
  await chooseMethod(page, "Byar's method");
  await modifiedQuestion(page).getByLabel('Yes').check();
  await expect(page.getByLabel(MODIFICATIONS)).toBeVisible();

  await expectNoAccessibilityViolations(page, testInfo);
});

test('has no WCAG 2.2 AA violations when the submission is rejected', async ({
  page,
}, testInfo) => {
  await openHydratedPage(page);
  await chooseMethod(page, "Byar's method");
  await continueAndExpectErrors(page, ['Select whether any modifications were used']);

  await expectNoAccessibilityViolations(page, testInfo);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('shows every follow-up question, naming the methods each is for', async ({ page }) => {
    await openSectionPage(page, SECTION);

    await expect(modifiedQuestion(page)).toBeVisible();
    await expect(
      modifiedQuestion(page).getByText(
        'Not needed for No confidence intervals available, Other method or Unknown',
      ),
    ).toBeVisible();
    await expect(page.getByLabel(MODIFICATIONS)).toBeVisible();
    await expect(page.getByLabel(OTHER_DETAIL)).toBeVisible();
    await expect(page.getByText('Only needed for Other method')).toBeVisible();
  });

  test('asks only for the answers the chosen method needs', async ({ page }) => {
    const taskListPath = await openSectionPage(page, SECTION);

    await chooseMethod(page, "Byar's method");
    await continueAndExpectErrors(page, ['Select whether any modifications were used']);
    await expect(standardDescription(page)).toBeVisible();

    await chooseMethod(page, 'Other method');
    await page.getByLabel(OTHER_DETAIL).fill('Bootstrap intervals');
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page).toHaveURL(taskListPath);
    await expect(taskRow(page, SECTION.taskName)).toContainText('Completed');
  });
});
