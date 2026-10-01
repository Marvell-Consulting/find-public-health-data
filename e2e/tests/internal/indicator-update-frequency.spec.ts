import { expect, test } from '@playwright/test';

import { expectNoAccessibilityViolations } from '../support/accessibility.ts';
import {
  describeSectionPage,
  openSectionPage,
  type Section,
  taskRow,
} from '../support/section-page.ts';
import { PUBLISHER } from '../support/sign-in.ts';

const SECTION: Section = { key: 'update-frequency', taskName: 'Update frequency' };
const QUESTION = 'How often will this indicator be updated?';
const NO_LONGER_UPDATED = 'This indicator will no longer be updated';

test.use({ storageState: PUBLISHER.storageState });

describeSectionPage(SECTION, {
  expectUnanswered: async (page) => {
    await expect(page.getByRole('heading', { level: 1, name: QUESTION })).toBeVisible();
    const options = page.getByRole('group', { name: QUESTION }).getByRole('radio');
    await expect(options).toHaveCount(6);
    for (const option of await options.all()) {
      await expect(option).not.toBeChecked();
    }
    await expect(page.locator('.govuk-radios__divider')).toHaveText('or');
  },
  refusal: {
    messages: ['Select how often this indicator will be updated'],
    focuses: (page) => page.getByLabel('Monthly', { exact: true }),
  },
});

test('saves the update frequency on Continue and shows the task as completed', async ({ page }) => {
  const taskListPath = await openSectionPage(page, SECTION);

  await page.getByLabel(NO_LONGER_UPDATED).check();
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL(taskListPath);
  await expect(taskRow(page, SECTION.taskName)).toContainText('Completed');

  await taskRow(page, SECTION.taskName).getByRole('link').click();
  await expect(page.getByLabel(NO_LONGER_UPDATED)).toBeChecked();
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
  await expect(page.getByRole('alert')).toContainText(
    'Select how often this indicator will be updated',
  );

  await expectNoAccessibilityViolations(page, testInfo);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('refuses an unanswered form and then saves the update frequency', async ({ page }) => {
    const taskListPath = await openSectionPage(page, SECTION);

    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('alert')).toContainText(
      'Select how often this indicator will be updated',
    );

    await page.getByLabel('Quarterly', { exact: true }).check();
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page).toHaveURL(taskListPath);
    await expect(taskRow(page, SECTION.taskName)).toContainText('Completed');
  });
});
