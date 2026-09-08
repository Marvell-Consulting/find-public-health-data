import { expect, test } from '@playwright/test';

import { expectNoAccessibilityViolations } from '../support/accessibility.js';
import { downloadFrom } from '../support/downloads.js';
import { filterCard, openIndicatorPage } from '../support/indicator-page.js';

const MORTALITY = 'Under 75 mortality rate from all causes';
const SMOKING = 'Smoking Prevalence in adults (aged 18 and over) - current smokers (APS)';

test.describe('with nothing selected', () => {
  test.beforeEach(async ({ page }) => {
    await openIndicatorPage(page, '/indicators');
  });

  test('shows the indicator selection', async ({ page }) => {
    await expect(
      page.getByRole('heading', { level: 1, name: 'Selected indicators' }),
    ).toBeVisible();
    await expect(page.getByText('No indicators selected')).toBeVisible();
  });

  test('suggests indicators as the search is typed and adds the pick', async ({ page }) => {
    const card = filterCard(page, 'Selected indicators');
    const search = card.getByRole('combobox', { name: 'Search for an indicator' });

    await search.fill('diab');
    await expect(page.getByRole('option', { name: 'Diabetes: QOF prevalence' })).toBeVisible();
    await expect(
      page.getByRole('option', { name: /Mortality rate for deaths involving diabetes/ }),
    ).toBeVisible();
    await expect(card.getByRole('button', { name: 'Add indicator' })).toHaveCount(0);

    await page.getByRole('option', { name: 'Diabetes: QOF prevalence' }).click();
    await card.getByRole('button', { name: 'Add indicator' }).click();

    await expect(page).toHaveURL(/\/indicators\?is=241/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Diabetes: QOF prevalence' }),
    ).toBeVisible();
  });

  test('says when no indicator matches the search', async ({ page }) => {
    await filterCard(page, 'Selected indicators')
      .getByRole('combobox', { name: 'Search for an indicator' })
      .fill('zzzz');
    await expect(page.getByText('No indicators found')).toBeVisible();
  });

  test('has no WCAG 2.2 AA violations', async ({ page }, testInfo) => {
    await expectNoAccessibilityViolations(page, testInfo);
  });
});

test.describe('searching without scripting', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/indicators?find=mortality');
  });

  test('lists the matching indicators as links that add them', async ({ page }) => {
    const card = filterCard(page, 'Selected indicators');
    const match = (name: string) => card.getByRole('link', { name, exact: true });
    await expect(match(MORTALITY)).toBeVisible();
    await expect(match('Under 75 mortality rate from cancer')).toBeVisible();

    await match(MORTALITY).click();

    await expect(page).toHaveURL(/is=108/);
    await expect(page).toHaveURL(/find=mortality/);
    await expect(page.getByRole('heading', { level: 1, name: MORTALITY })).toBeVisible();
    // The rest of the matches stay listed for adding; the one just added does not.
    await expect(match(MORTALITY)).toHaveCount(0);
    await expect(match('Under 75 mortality rate from cancer')).toBeVisible();
  });

  test('keeps the search term in the box once scripting takes over', async ({ page }) => {
    await expect(
      filterCard(page, 'Selected indicators').getByRole('combobox', {
        name: 'Search for an indicator',
      }),
    ).toHaveValue('mortality');
  });

  test('says when nothing matches', async ({ page }) => {
    await page.goto('/indicators?find=zzzz');
    await expect(page.getByText('No indicators found')).toBeVisible();
  });

  test('has no WCAG 2.2 AA violations', async ({ page }, testInfo) => {
    await expectNoAccessibilityViolations(page, testInfo);
  });
});

test.describe('comparing indicators', () => {
  test.beforeEach(async ({ page }) => {
    await openIndicatorPage(page, '/indicators?is=108&is=92443');
  });

  test('lists the contents and compares the latest values', async ({ page }) => {
    const contents = page.getByRole('navigation').filter({ hasText: 'Contents' });
    await expect(contents.getByRole('link', { name: 'Compare selected indicators' })).toBeVisible();
    await expect(contents.getByRole('link', { name: MORTALITY })).toBeVisible();
    await expect(contents.getByRole('link', { name: SMOKING })).toBeVisible();

    const compare = page.getByRole('table', { name: 'Compare selected indicators' });
    await expect(compare.getByRole('columnheader', { name: 'England' })).toBeVisible();
    await expect(
      compare.getByRole('row').filter({ hasText: MORTALITY }).getByRole('cell'),
    ).toHaveText([
      MORTALITY,
      '2024',
      'Decreasing and getting better',
      '164,096',
      '329.4 per 100,000',
    ]);
    await expect(
      compare.getByRole('row').filter({ hasText: SMOKING }).getByRole('cell'),
    ).toContainText([SMOKING, '2024', /./, '-', '10.4%']);

    await expect(page.getByRole('heading', { level: 2, name: MORTALITY })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: SMOKING })).toBeVisible();
  });

  test('downloads the comparison as CSV', async ({ page }) => {
    const { filename, text } = await downloadFrom(page, 'Download this table');

    expect(filename).toBe('compare-indicators.csv');
    expect(text.split('\n')[0]).toBe(
      'Indicator,Most recent period,England recent trend,England count,England calculated value',
    );
    expect(text).toContain(`${MORTALITY},2024,`);
  });

  test('removes one indicator, then clears the selection', async ({ page }) => {
    const card = filterCard(page, 'Selected indicators');

    await card.getByRole('link', { name: `Remove ${SMOKING} filter` }).click();
    await expect(page).toHaveURL(/is=108/);
    await expect(page).not.toHaveURL(/92443/);
    await expect(page.getByRole('heading', { level: 1, name: MORTALITY })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Compare selected indicators' })).toHaveCount(0);

    await card.getByRole('link', { name: 'Clear all' }).click();
    await expect(page).not.toHaveURL(/is=/);
    await expect(page.getByText('No indicators selected')).toBeVisible();
  });

  test('has no WCAG 2.2 AA violations', async ({ page }, testInfo) => {
    await expectNoAccessibilityViolations(page, testInfo);
  });
});
