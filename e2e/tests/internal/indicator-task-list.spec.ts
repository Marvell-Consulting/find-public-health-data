import { expect, type Page, test } from '@playwright/test';

import { expectNoAccessibilityViolations } from '../support/accessibility.ts';
import { createIndicator, uniqueIndicatorName } from '../support/create-indicator.ts';
import { MORTALITY_ID } from '../support/indicator-page.ts';
import { signInAs } from '../support/sign-in.ts';

function uniqueName() {
  return uniqueIndicatorName('task list');
}

// The header and footer have lists of their own, so the task rows are read inside the page.
function taskRow(page: Page, title: string) {
  return page.getByRole('main').getByRole('listitem').filter({ hasText: title }).first();
}

test.beforeEach(async ({ page }) => {
  await signInAs(page, 'Riley Singh');
});

test('lists the fields a publisher completes, grouped', async ({ page }) => {
  await createIndicator(page, uniqueName());

  await expect(page.getByRole('main').getByRole('heading', { level: 2 })).toHaveText([
    'Data',
    'Metadata',
    'Publishing',
    'Notes for reviewers (for internal use only)',
  ]);
  await expect(page.getByRole('main').getByRole('listitem')).toHaveCount(22);
});

test('shows the indicator name and number on its task list', async ({ page }) => {
  const name = uniqueName();

  await createIndicator(page, name);

  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  await expect(page.getByText(/^ID: \d+$/)).toBeVisible();
});

test('shows the indicator as new with an incomplete draft', async ({ page }) => {
  await createIndicator(page, uniqueName());

  // The tags follow the public number, under the heading.
  await expect(page.getByRole('main').locator('h1 ~ p .govuk-tag')).toHaveText([
    'Indicator status: New indicator',
    'Publishing status: Incomplete',
  ]);
});

test('marks the name as complete and everything else as not started', async ({ page }) => {
  await createIndicator(page, uniqueName());

  await expect(taskRow(page, 'Name')).toContainText('Completed');
  await expect(taskRow(page, 'Name').getByRole('link')).toBeVisible();
  await expect(taskRow(page, 'Definition and rationale')).toContainText('Not started');
  await expect(taskRow(page, 'Definition and rationale').getByRole('link')).toBeVisible();
  await expect(taskRow(page, 'How the indicator was calculated')).toContainText('Not started');
  await expect(taskRow(page, 'How the indicator was calculated').getByRole('link')).toBeVisible();
  await expect(taskRow(page, 'Confidence intervals')).toContainText('Not started');
  await expect(taskRow(page, 'Confidence intervals').getByRole('link')).toBeVisible();
  await expect(taskRow(page, 'Polarity')).toContainText('Not started');
  await expect(taskRow(page, 'Polarity').getByRole('link')).toBeVisible();
  await expect(taskRow(page, 'Data quality')).toContainText('Not started');
  await expect(taskRow(page, 'Data quality').getByRole('link')).toHaveCount(0);
  await expect(taskRow(page, 'Publishing date')).toContainText('Not started');
});

test('opens the name from the task list and comes back to it renamed', async ({ page }) => {
  const name = uniqueName();
  await createIndicator(page, name);
  const taskListPath = new URL(page.url()).pathname;

  await taskRow(page, 'Name').getByRole('link').click();

  await expect(page).toHaveURL(/\/publish\/indicators\/[0-9a-f-]{36}\/name$/);
  const field = page.getByLabel('What is the name of the indicator?');
  await expect(field).toHaveValue(name);

  await field.fill(`${name} revised`);
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL(taskListPath);
  await expect(page.getByRole('heading', { level: 1, name: `${name} revised` })).toBeVisible();
});

test('is reached from the indicator overview', async ({ page }) => {
  await createIndicator(page, uniqueName());
  const taskListPath = new URL(page.url()).pathname;

  await page.getByRole('link', { name: 'Back', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/indicators\/[0-9a-f-]{36}$/);

  await page.getByRole('link', { name: 'Continue creating indicator' }).click();

  await expect(page).toHaveURL(taskListPath);
});

test('answers an indicator with nothing to edit with the not-found page', async ({ page }) => {
  for (const path of [
    '/publish/indicators/108/task-list',
    '/publish/indicators/00000000-0000-7000-8000-000000000000/task-list',
    // The seeded indicator is published, so no draft of it is being worked on.
    `/publish/indicators/${MORTALITY_ID}/task-list`,
  ]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(404);
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
  }
});

test('has no WCAG 2.2 AA violations', async ({ page }, testInfo) => {
  await createIndicator(page, uniqueName());

  await expectNoAccessibilityViolations(page, testInfo);
});
