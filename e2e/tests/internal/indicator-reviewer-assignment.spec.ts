import { expect, type Page, test } from '@playwright/test';

import { expectNoAccessibilityViolations } from '../support/accessibility.ts';
import { submitNewIndicator } from '../support/complete-draft.ts';
import { uniqueIndicatorName } from '../support/create-indicator.ts';
import { IMRG_MANAGER, PUBLISHER } from '../support/sign-in.ts';

const ASSIGNED = 'Reviewers successfully assigned to indicator.';
const NOT_WITHDRAWN = 'This submission can no longer be withdrawn.';

function overviewPath(id: string) {
  return `/dashboard/indicators/${id}`;
}

function assignPath(id: string) {
  return `${overviewPath(id)}/assign-reviewers`;
}

/** Chooses a reviewer by name: the count beside it moves as other specs assign reviewers. */
async function chooseReviewer(page: Page, name: string) {
  const select = page.getByLabel('Reviewer', { exact: true });
  const value = await select
    .getByRole('option', { name: `${name} (`, includeHidden: true })
    .getAttribute('value');
  await select.selectOption(value ?? '');
}

async function addReviewer(page: Page, name: string) {
  await chooseReviewer(page, name);
  await page.getByRole('button', { name: /^Add (another )?reviewer$/ }).click();
  await expect(page.getByRole('button', { name: `Remove reviewer ${name}` })).toBeVisible();
}

/** The reviewers listed so far, read from their Remove buttons in page order. */
function removeButtons(page: Page) {
  return page.getByRole('button', { name: /^Remove reviewer / });
}

test.use({ storageState: IMRG_MANAGER.storageState });

test('asks for a reviewer when none is chosen', async ({ browser, page }, testInfo) => {
  const id = await submitNewIndicator(browser, uniqueIndicatorName('no reviewer'));
  await page.goto(assignPath(id));
  await expect(page.getByRole('heading', { level: 1, name: 'Assign reviewers' })).toBeVisible();
  await expectNoAccessibilityViolations(page, testInfo);

  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveTitle(/^Error: Assign reviewers/);
  await expect(page.getByRole('alert')).toContainText('Select a reviewer');
  await expectNoAccessibilityViolations(page, testInfo);
});

test('once reviewers are assigned, the publisher can no longer withdraw the submission', async ({
  browser,
  page,
}) => {
  const id = await submitNewIndicator(browser, uniqueIndicatorName('no withdrawal'));
  await page.goto(assignPath(id));
  await chooseReviewer(page, 'Jamie Evans');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText(ASSIGNED)).toBeVisible();

  const publisher = await (
    await browser.newContext({ storageState: PUBLISHER.storageState })
  ).newPage();
  await publisher.goto(overviewPath(id));
  await expect(publisher.getByRole('heading', { level: 2, name: 'Actions' })).toBeVisible();
  await expect(publisher.getByRole('link', { name: 'Withdraw submission' })).toHaveCount(0);

  await publisher.goto(`/publish/indicators/${id}/withdraw-submission`);
  await expect(publisher).toHaveURL(overviewPath(id));
  await expect(publisher.getByRole('region', { name: 'Important' })).toContainText(NOT_WITHDRAWN);
  await publisher.context().close();
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('adds and removes reviewers, then assigns them', async ({ browser, page }) => {
    const id = await submitNewIndicator(browser, uniqueIndicatorName('no script'));
    await page.goto(assignPath(id));

    await addReviewer(page, 'Morgan Hughes');
    await addReviewer(page, 'Jamie Evans');
    await expect(removeButtons(page)).toHaveText([
      'Remove reviewer Morgan Hughes',
      'Remove reviewer Jamie Evans',
    ]);
    await page.getByRole('button', { name: 'Remove reviewer Morgan Hughes' }).click();
    await expect(removeButtons(page)).toHaveText(['Remove reviewer Jamie Evans']);
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page).toHaveURL(overviewPath(id));
    await expect(page.getByText(ASSIGNED)).toBeVisible();
  });
});
