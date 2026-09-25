import { expect, type Page, test } from '@playwright/test';

import { expectNoAccessibilityViolations } from '../support/accessibility.ts';
import { downloadFrom } from '../support/downloads.ts';
import { filterCard, MORTALITY_PATH, openIndicatorPage } from '../support/indicator-page.ts';

const INDICATOR = 'Under 75 mortality rate from all causes';

function trendTable(page: Page) {
  return page.getByRole('table', { name: /trends over time/ });
}

/** The data cells of one period's row, in column order. */
function cellsFor(page: Page, period: string) {
  return trendTable(page)
    .getByRole('row')
    .filter({ has: page.getByRole('rowheader', { name: period, exact: true }) })
    .getByRole('cell');
}

function tableOptions(page: Page) {
  return page.getByRole('tabpanel', { name: 'Table' });
}

test.beforeEach(async ({ page }) => {
  await openIndicatorPage(page, MORTALITY_PATH);
});

test('shows an indicator', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1, name: INDICATOR })).toBeVisible();
});

test('has no WCAG 2.2 AA violations', async ({ page }, testInfo) => {
  await expectNoAccessibilityViolations(page, testInfo);
});

test('answers an indicator that does not exist with the not-found page', async ({ page }) => {
  for (const path of [
    '/indicators/999999',
    '/indicators/no-such-indicator',
    '/indicators/facets',
  ]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(404);
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();
  }
});

test('redirects an indicator number to its slug, keeping the query string', async ({ page }) => {
  const response = await page.request.get('/indicators/108?as=E08000003', { maxRedirects: 0 });

  expect(response.status()).toBe(301);
  expect(response.headers().location).toBe(`${MORTALITY_PATH}?as=E08000003`);
});

test.describe('the summary', () => {
  test('describes the data and its recent trend', async ({ page }) => {
    await expect(page.getByRole('row', { name: /Period covered/ })).toContainText('2015 to 2024');
    await expect(page.getByRole('row', { name: /Most recent trend/ })).toContainText(
      'Decreasing and getting better',
    );
    await expect(page.getByRole('row', { name: /Definition/ })).toContainText(
      'Directly age-standardised mortality rate',
    );
  });

  test('links to the topic the indicator belongs to', async ({ page }) => {
    await page.getByRole('link', { name: 'Mortality and life expectancy' }).click();
    await expect(page).toHaveURL('/topics/mortality-and-life-expectancy');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Mortality and life expectancy' }),
    ).toBeVisible();
  });
});

test.describe('the tabs', () => {
  test('open on the chart and switch, keeping the choice in the address', async ({ page }) => {
    await expect(page.getByRole('tab', { name: 'Chart' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel', { name: 'Chart' })).toBeVisible();
    await expect(page.getByRole('tabpanel', { name: 'Table' })).toBeHidden();

    await page.getByRole('tab', { name: 'Table' }).click();

    await expect(page).toHaveURL(/tab-108=table/);
    await expect(page.getByRole('tabpanel', { name: 'Table' })).toBeVisible();
    await expect(page.getByRole('tabpanel', { name: 'Chart' })).toBeHidden();
  });

  test('open the tab the address names', async ({ page }) => {
    await openIndicatorPage(page, `${MORTALITY_PATH}?tab-108=about`);
    await expect(page.getByRole('tab', { name: 'About this indicator' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  });

  test('move with the arrow keys', async ({ page }) => {
    await page.getByRole('tab', { name: 'Chart' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Table' })).toBeFocused();
    await expect(page.getByRole('tabpanel', { name: 'Table' })).toBeVisible();
  });
});

test.describe('the table', () => {
  test.beforeEach(async ({ page }) => {
    await page.getByRole('tab', { name: 'Table' }).click();
  });

  test('shows the headline series for England', async ({ page }) => {
    await expect(trendTable(page)).toHaveAccessibleName(/<75 yrs$/);
    await expect(trendTable(page).getByRole('columnheader', { name: 'England' })).toBeVisible();
    await expect(cellsFor(page, '2015')).toHaveText(['153,839', '334.8']);
    await expect(cellsFor(page, '2015 to 2017')).toHaveText(['468,302', '332.6']);
  });

  test('filters by sex and keeps the choice in the address', async ({ page }) => {
    await tableOptions(page).getByLabel('Select sex').selectOption('Male');

    await expect(page).toHaveURL(/sex-108=Male/);
    await expect(trendTable(page)).toHaveAccessibleName(/<75 yrs, Male$/);
    await expect(cellsFor(page, '2015')).toHaveText(['91,248', '407.2']);
  });

  test('narrows to single-year periods', async ({ page }) => {
    await tableOptions(page).getByLabel('Select time period type').selectOption('1 year');

    await expect(page).toHaveURL(/pt-108=1-year/);
    await expect(cellsFor(page, '2015')).toHaveText(['153,839', '334.8']);
    await expect(cellsFor(page, '2015 to 2017')).toHaveCount(0);
  });

  test('adds confidence interval columns', async ({ page }) => {
    await tableOptions(page).getByLabel('Select confidence intervals').selectOption('95%');

    await expect(page).toHaveURL(/ci-108=95/);
    await expect(
      trendTable(page).getByRole('columnheader', { name: '95% lower confidence interval' }),
    ).toBeVisible();
    await expect(cellsFor(page, '2015')).toHaveText(['153,839', '334.8', '333.1', '336.5']);
  });

  test('downloads the table as CSV', async ({ page }) => {
    const { filename, text } = await downloadFrom(page, 'Download this table');

    expect(filename).toBe('108-table.csv');
    const [header, first] = text.split('\n');
    expect(header).toBe('Period,England count,"England calculated value (per 100,000)"');
    expect(first).toBe('2015,153839,334.7766');
  });

  test('downloads every observation as CSV', async ({ page }) => {
    const { filename, text } = await downloadFrom(page, 'Download all data for this indicator');

    expect(filename).toBe('108-all-data.csv');
    expect(text.split('\n')[0]).toContain('Indicator,Area,Period,Segment,Count,Denominator');
    expect(text).toContain('<75 yrs, Male');
  });
});

test.describe('the inequalities', () => {
  test.beforeEach(async ({ page }) => {
    await page.getByRole('tab', { name: 'Inequalities' }).click();
  });

  test('break the latest period down by the chosen category', async ({ page }) => {
    const table = page.getByRole('table', { name: /deprivation deciles/ });
    await expect(table).toHaveAccessibleName(
      'County and unitary authority deprivation deciles (IMD2019), 2024',
    );
    await expect(
      table.getByRole('row', { name: /^Most deprived decile \(IMD2019\)/ }),
    ).toContainText('448.4');

    const options = page.getByRole('tabpanel', { name: 'Inequalities' });
    await options
      .getByLabel('Select inequality category')
      .selectOption('District and unitary authority deprivation deciles (IMD2019)');
    await expect(table).toHaveAccessibleName(
      'District and unitary authority deprivation deciles (IMD2019), 2024',
    );

    await options.getByLabel('Select time period', { exact: true }).selectOption('2023');
    await expect(table).toHaveAccessibleName(/, 2023$/);
  });

  test('have no WCAG 2.2 AA violations', async ({ page }, testInfo) => {
    await expectNoAccessibilityViolations(page, testInfo);
  });
});

test.describe('about this indicator', () => {
  test.beforeEach(async ({ page }) => {
    await page.getByRole('tab', { name: 'About this indicator' }).click();
  });

  test('describes how the indicator is made', async ({ page }) => {
    const panel = page.getByRole('tabpanel', { name: 'About this indicator' });
    await expect(panel.getByRole('heading', { name: 'Overview' })).toBeVisible();
    await expect(panel.getByText('Indicator ID')).toBeVisible();
    await expect(panel.getByText('108', { exact: true })).toBeVisible();
    await expect(panel.getByRole('heading', { name: 'Data attributes' })).toBeVisible();
    await expect(panel.getByText('Directly standardised rate', { exact: true })).toBeVisible();
    await expect(panel.getByText('per 100,000', { exact: true })).toBeVisible();
    await expect(panel.getByText('Annually', { exact: true })).toBeVisible();
    await expect(panel.getByText('Lower is better', { exact: true })).toBeVisible();
    await expect(panel.getByRole('heading', { name: 'Calculation' })).toBeVisible();
    await expect(panel.getByRole('heading', { name: 'Other notes and caveats' })).toBeVisible();
    for (const note of ['Disclosure control', 'Notes', 'Caveats']) {
      await expect(panel.getByRole('heading', { name: note, exact: true })).toBeVisible();
    }
  });

  test('has no WCAG 2.2 AA violations', async ({ page }, testInfo) => {
    await expectNoAccessibilityViolations(page, testInfo);
  });
});

test.describe('the geography filter', () => {
  test('uses the shared compact geography tree', async ({ page }) => {
    const card = filterCard(page, 'Geography filters');
    const tree = card.locator('.fphd-geo-alt__tree');
    const level = card.getByRole('checkbox', { name: 'Local authorities', exact: true });

    await expect(tree).toHaveCount(1);
    await expect(level).toHaveCSS('width', '24px');
    await expect(level).toHaveCSS('height', '36px');
    await expect(card.getByText('Local authorities', { exact: true })).toHaveCSS(
      'font-size',
      '16px',
    );
  });

  test('indicator geography search shows empty and retry states inside the results box', async ({
    page,
  }, testInfo) => {
    const card = filterCard(page, 'Geography filters');
    const tree = card.locator('.fphd-geo-alt__tree');
    await page.route('**/geographies?*', (route) =>
      route.fulfill({ status: 502, body: 'Unavailable' }),
    );
    const input = card.getByRole('searchbox', { name: 'Add geographies' });
    await input.fill('Cornwall');
    await expect(tree.getByRole('status')).toContainText('Geography search is not working');
    await page.unroute('**/geographies?*');
    await tree.getByRole('button', { name: 'Try again' }).click();
    await expect(card.getByRole('checkbox', { name: 'Cornwall', exact: true })).toBeVisible();
    await input.fill('zzzzzzzzzzzz');
    await expect(tree.getByRole('status')).toContainText('No geographies found');
    await expectNoAccessibilityViolations(page, testInfo);
  });

  test('adds an area found by search and compares it against England', async ({ page }) => {
    const card = filterCard(page, 'Geography filters');
    await expect(card.getByRole('link', { name: 'Clear all' })).toHaveCount(0);

    await card.getByLabel('Add geographies').fill('Manchester');
    await card.getByRole('checkbox', { name: 'Manchester', exact: true }).check();
    await card.getByRole('button', { name: 'Add selected geographies (1)' }).click();

    await expect(page).toHaveURL(/as=E08000003/);
    await expect(card.getByRole('link', { name: 'Remove Manchester filter' })).toBeVisible();
    await expect(card.getByRole('link', { name: 'Clear all' })).toBeVisible();

    await page.getByRole('tab', { name: 'Table' }).click();
    await expect(trendTable(page).getByRole('columnheader', { name: 'Manchester' })).toBeVisible();
    await expect(trendTable(page).getByRole('columnheader', { name: 'England' })).toHaveCount(0);
    await expect(cellsFor(page, '2015')).toHaveText(['1,510', '518.1']);

    await tableOptions(page)
      .getByLabel('Select a geography or goal to compare with')
      .selectOption('England');
    await expect(page).toHaveURL(/cmp-108=england/);
    await expect(trendTable(page).getByRole('columnheader', { name: 'England' })).toBeVisible();
    await expect(cellsFor(page, '2015')).toHaveText(['1,510', '518.1', '334.8']);

    await tableOptions(page).getByRole('radio', { name: 'Yes' }).click();
    await expect(page).toHaveURL(/cr-108=yes/);
    await expect(tableOptions(page).getByRole('radio', { name: 'Yes' })).toBeChecked();
    await expect(trendTable(page).getByRole('columnheader', { name: 'Minimum' })).toBeVisible();
    await expect(cellsFor(page, '2015')).toHaveText([
      '1,510',
      '518.1',
      '334.8',
      '223.3',
      '595.5',
      '',
    ]);
    await expect(
      cellsFor(page, '2015').getByRole('img', {
        name: 'Manchester 518.1 against England 334.8, range 223.3 to 595.5',
      }),
    ).toBeVisible();

    const { text } = await downloadFrom(page, 'Download this table');
    const header = text.split('\n')[0];
    expect(header).toContain('Manchester England calculated value (per 100,000)');
    expect(header).toContain('Manchester England minimum');
    expect(header).toContain('Manchester England maximum');
    expect(text).toContain('2015,1510,518.08261,334.7766,223.28385,595.46714');
  });

  test('offers the statistical region as a comparison', async ({ page }) => {
    await openIndicatorPage(page, `${MORTALITY_PATH}?as=E08000003&tab-108=table`);
    await tableOptions(page)
      .getByLabel('Select a geography or goal to compare with')
      .selectOption('Statistical regions');

    await expect(page).toHaveURL(/cmp-108=region/);
    await expect(
      trendTable(page).getByRole('columnheader', { name: 'North West (Statistical region)' }),
    ).toBeVisible();
  });

  test('adds an area from an expanded level', async ({ page }) => {
    const card = filterCard(page, 'Geography filters');
    await card.getByRole('button', { name: 'Expand Local authorities' }).click();
    await card.getByRole('checkbox', { name: 'Adur' }).check();
    await card.getByRole('button', { name: 'Add selected geographies (1)' }).click();

    await expect(page).toHaveURL(/as=E07000223/);
    await expect(card.getByRole('link', { name: 'Remove Adur filter' })).toBeVisible();
  });

  test('selects a whole level as one chip', async ({ page }) => {
    const card = filterCard(page, 'Geography filters');
    await card.getByRole('checkbox', { name: 'Statistical regions' }).check();
    await card.getByRole('button', { name: 'Add selected geographies' }).click();

    await expect(page).toHaveURL(/als=Statistical\+regions/);
    await expect(
      card.getByRole('link', { name: 'Remove Statistical regions filter' }),
    ).toBeVisible();
    await page.getByRole('tab', { name: 'Table' }).click();
    await expect(trendTable(page).getByRole('columnheader', { name: 'North East' })).toBeVisible();
    await expect(trendTable(page).getByRole('columnheader', { name: 'London' })).toBeVisible();
  });

  test('removes one area, then clears the rest', async ({ page }) => {
    await openIndicatorPage(page, `${MORTALITY_PATH}?as=E08000003&as=E07000223`);
    const card = filterCard(page, 'Geography filters');

    await card.getByRole('link', { name: 'Remove Manchester filter' }).click();
    await expect(page).toHaveURL(/as=E07000223/);
    await expect(page).not.toHaveURL(/E08000003/);
    await expect(card.getByRole('link', { name: 'Remove Adur filter' })).toBeVisible();

    await card.getByRole('link', { name: 'Clear all' }).click();
    await expect(page).not.toHaveURL(/as=/);
    await expect(card.getByRole('link', { name: /^Remove/ })).toHaveCount(0);
    await expect(card.getByText('England', { exact: true })).toBeVisible();
  });

  test('has no WCAG 2.2 AA violations with a comparison shown', async ({ page }, testInfo) => {
    await openIndicatorPage(
      page,
      `${MORTALITY_PATH}?as=E08000003&tab-108=table&cmp-108=england&cr-108=yes`,
    );
    await expect(trendTable(page).getByRole('columnheader', { name: 'Comparison' })).toBeVisible();
    await expectNoAccessibilityViolations(page, testInfo);
  });
});

test.describe('the indicator filter', () => {
  test('adds a second indicator picked from the search suggestions', async ({ page }) => {
    const card = filterCard(page, 'Selected indicators');
    await card.getByRole('combobox', { name: 'Search for an indicator' }).fill('smoking');
    await page.getByRole('option', { name: /Smoking Prevalence in adults/ }).click();
    await card.getByRole('button', { name: 'Add indicator' }).click();

    await expect(page).toHaveURL(/is=108&is=92443/);
    await expect(page.getByRole('heading', { level: 1, name: 'Contents' })).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: 'Compare selected indicators' }),
    ).toBeVisible();
    await expect(
      card.getByRole('link', { name: /Remove Smoking Prevalence in adults .* filter/ }),
    ).toBeVisible();
  });

  test('removes the indicator the page arrived on', async ({ page }) => {
    const card = filterCard(page, 'Selected indicators');
    await card.getByRole('link', { name: `Remove ${INDICATOR} filter` }).click();

    await expect(page.getByText('No indicators selected')).toBeVisible();
    await expect(card.getByText('None selected')).toBeVisible();
  });
});
