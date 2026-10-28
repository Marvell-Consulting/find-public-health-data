import { expect, test } from '@playwright/test';

import { expectNoAccessibilityViolations } from '../support/accessibility.ts';
import { completeDraft, submitDraft } from '../support/complete-draft.ts';
import { createDraft, uniqueIndicatorName } from '../support/create-indicator.ts';
import { ADMIN, IMRG_MANAGER, PUBLISHER, TEAM_B_PUBLISHER } from '../support/sign-in.ts';

test.use({ storageState: PUBLISHER.storageState });

test.beforeEach(async ({ page }) => {
  await page.goto('/dashboard');
});

test('tags a new indicator as new with an incomplete draft', async ({ page }) => {
  const name = uniqueIndicatorName('dashboard');
  await createDraft(page, name);
  await page.goto('/dashboard');

  const row = page.getByRole('table').getByRole('row').filter({ hasText: name });

  // The column headers name the two statuses, so the tags carry no hidden prefix here.
  await expect(row.locator('.govuk-tag')).toHaveText(['New', 'Incomplete']);
});

test('names the team, the creator and the last editor of a new indicator', async ({ page }) => {
  const name = uniqueIndicatorName('dashboard');
  await createDraft(page, name);
  await page.goto('/dashboard');

  const row = page.getByRole('table').getByRole('row').filter({ hasText: name });

  await expect(row.getByRole('cell').nth(0)).toHaveText('Team A');
  await expect(row.getByRole('cell').nth(1)).toHaveText(PUBLISHER.name);
  await expect(row.getByRole('cell').nth(3)).toHaveText(PUBLISHER.name);
});

test('has no WCAG 2.2 AA violations', async ({ page }, testInfo) => {
  await expectNoAccessibilityViolations(page, testInfo);
});

test.describe('as a publisher whose team holds no indicators', () => {
  test.use({ storageState: TEAM_B_PUBLISHER.storageState });

  test("shows a publisher only their own teams' indicators", async ({ page }) => {
    await expect(page.getByText('There are no indicators for you to see yet.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create new indicator' })).toBeVisible();
  });
});

test.describe('as an admin, who sees every team', () => {
  test.use({ storageState: ADMIN.storageState });

  // The seed holds more indicators than one page, all in Fingertips, and specs only add to it.
  test('lists a page of indicators', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1, name: 'Indicators' })).toBeVisible();

    const rows = page.getByRole('table').getByRole('row');

    await expect(rows).toHaveCount(11);
    await expect(rows.first().getByRole('columnheader')).toHaveText([
      'Indicator name',
      'Team',
      'Created by',
      'Last edited',
      'Last edited by',
      'Indicator status',
      'Publishing status',
    ]);
  });

  test('moves between pages', async ({ page }) => {
    await page.getByRole('link', { name: 'Next page' }).click();

    await expect(page).toHaveURL('/dashboard?page=2');
    await expect(page.getByRole('table').getByRole('row').nth(1)).toBeVisible();

    await page.getByRole('link', { name: 'Previous page' }).click();

    await expect(page).toHaveURL('/dashboard');
  });

  test('offers an admin no create action', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Create new indicator' })).toHaveCount(0);
  });
});

test.describe('as an IMRG manager', () => {
  test.use({ storageState: IMRG_MANAGER.storageState });

  test('shows the indicators under review, unassigned and assigned', async ({ page }) => {
    await expect(
      page.getByRole('heading', { level: 1, name: 'Indicators under review' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: 'Unassigned indicators' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: 'Assigned indicators', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create new indicator' })).toHaveCount(0);
  });

  test('lists a submitted indicator as unassigned, linked to its overview', async ({
    browser,
    page,
  }, testInfo) => {
    const name = uniqueIndicatorName('under review');
    const publisher = await (
      await browser.newContext({ storageState: PUBLISHER.storageState })
    ).newPage();
    const id = await createDraft(publisher, name);
    await completeDraft(publisher, id);
    await submitDraft(publisher, id);
    await publisher.context().close();

    await page.goto('/dashboard');
    const row = page
      .getByRole('table', { name: 'Unassigned indicators, oldest submission first' })
      .getByRole('row')
      .filter({ hasText: name });

    await expect(row.locator('.govuk-tag')).toHaveText(['New', 'Pending approval']);
    await expectNoAccessibilityViolations(page, testInfo);

    await row.getByRole('link', { name }).click();

    await expect(page).toHaveURL(`/dashboard/indicators/${id}`);
  });
});
