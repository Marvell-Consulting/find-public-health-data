import { expect, test } from '@playwright/test';

import { expectNoAccessibilityViolations } from '../support/accessibility.ts';
import {
  describeSectionPage,
  openSectionPage,
  type Section,
  taskRow,
} from '../support/section-page.ts';
import { PUBLISHER } from '../support/sign-in.ts';

const SECTION: Section = { key: 'data-quality', taskName: 'Data quality' };
const QUESTION = 'Are there any data quality issues with this indicator?';
const REFUSAL = 'Select whether there are any data quality issues with this indicator';

test.use({ storageState: PUBLISHER.storageState });

describeSectionPage(SECTION, {
  expectUnanswered: async (page) => {
    await expect(page.getByRole('heading', { level: 1, name: QUESTION })).toBeVisible();
    const group = page.getByRole('group', { name: QUESTION });
    await expect(group).toHaveAccessibleDescription(/clearly explained in the 'Caveats' section/);
    const options = group.getByRole('radio');
    await expect(options).toHaveCount(2);
    for (const option of await options.all()) {
      await expect(option).not.toBeChecked();
    }
  },
  refusal: {
    messages: [REFUSAL],
    focuses: (page) => page.getByLabel('Yes'),
  },
});

test('saves the answer on Continue and shows the task as completed', async ({ page }) => {
  const taskListPath = await openSectionPage(page, SECTION);

  await page.getByLabel('Yes').check();
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL(taskListPath);
  await expect(taskRow(page, SECTION.taskName)).toContainText('Completed');

  await taskRow(page, SECTION.taskName).getByRole('link').click();
  await expect(page.getByLabel('Yes')).toBeChecked();

  await page.getByLabel('No').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(taskRow(page, SECTION.taskName)).toContainText('Completed');

  await taskRow(page, SECTION.taskName).getByRole('link').click();
  await expect(page.getByLabel('No')).toBeChecked();
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
  await expect(page.getByRole('alert')).toContainText(REFUSAL);

  await expectNoAccessibilityViolations(page, testInfo);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('refuses an unanswered form and then saves the answer', async ({ page }) => {
    const taskListPath = await openSectionPage(page, SECTION);

    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('alert')).toContainText(REFUSAL);

    await page.getByLabel('No').check();
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page).toHaveURL(taskListPath);
    await expect(taskRow(page, SECTION.taskName)).toContainText('Completed');
  });
});
