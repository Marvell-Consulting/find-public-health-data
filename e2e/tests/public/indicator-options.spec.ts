import { readFile } from 'node:fs/promises';
import { expect, type Locator, type Page, test } from '@playwright/test';

for (const javaScriptEnabled of [true, false]) {
  test.describe(`indicator options with JavaScript ${javaScriptEnabled ? 'enabled' : 'disabled'}`, () => {
    test.use({ javaScriptEnabled });

    async function open(page: Page, path: string) {
      await page.goto(path);
      if (javaScriptEnabled) {
        await expect(page.getByRole('combobox', { name: 'Search for an indicator' })).toBeVisible();
      }
    }

    async function apply(options: Locator) {
      if (!javaScriptEnabled) {
        await options.getByRole('button', { name: 'Apply options' }).click();
      }
    }

    test('applies sex, period and confidence choices to the actual table', async ({ page }) => {
      await open(page, '/indicators/108?tab-108=table');
      const options = page.locator('#table-108 details');
      const table = page.getByRole('table', { name: /trends over time/ });
      const cells = table
        .getByRole('row')
        .filter({ has: page.getByRole('rowheader', { name: '2015', exact: true }) })
        .getByRole('cell');
      await expect(cells).toHaveText(['153,839', '334.8']);

      await options.getByLabel('Select sex').selectOption('Male');
      await apply(options);
      await expect(cells).toHaveText(['91,248', '407.2']);
      await expect(page).toHaveURL(/sex-108=Male/);

      await options.getByLabel('Select time period type').selectOption('1 year');
      await apply(options);
      await expect(table.getByRole('rowheader', { name: '2015 to 2017', exact: true })).toHaveCount(
        0,
      );
      await expect(cells).toHaveText(['91,248', '407.2']);

      await options.getByLabel('Select confidence intervals').selectOption('99.8%');
      await apply(options);
      await expect(
        table.getByRole('columnheader', { name: '99.8% lower confidence interval' }),
      ).toBeVisible();
      await expect(cells).toHaveCount(4);
      const downloading = page.waitForEvent('download');
      await page.locator('#table-108').getByRole('button', { name: 'Download this table' }).click();
      const download = await downloading;
      const csv = await readFile(await download.path(), 'utf8');
      expect(csv.split('\n')[0]).toContain('England lower 99.8% CI');
      expect(csv.split('\n')[0]).toContain('England upper 99.8% CI');
      expect(csv).not.toContain('95% CI');
      await page.reload();
      await expect(table).toHaveAccessibleName(/<75 yrs, Male$/);
      await expect(cells).toHaveCount(4);
    });

    test('applies comparisons without losing the other selections', async ({ page }) => {
      await open(page, '/indicators?is=108&is=92443&as=E08000003&tab-108=table&sex-92443=Female');
      const options = page.locator('#table-108 details');
      const table = page.locator('#table-108').getByRole('table', { name: /trends over time/ });
      await options
        .getByLabel('Select a geography or goal to compare with')
        .selectOption('England');
      await apply(options);
      await expect(table.getByRole('columnheader', { name: 'England', exact: true })).toBeVisible();
      await options.getByRole('radio', { name: 'Yes' }).click();
      await apply(options);
      await expect(options.getByRole('radio', { name: 'Yes' })).toBeChecked();
      await expect(table.getByRole('columnheader', { name: 'Minimum' })).toBeVisible();
      await expect(table.getByRole('columnheader', { name: 'Maximum' })).toBeVisible();
      const params = new URL(page.url()).searchParams;
      expect(params.getAll('is')).toEqual(['108', '92443']);
      expect(params.getAll('as')).toEqual(['E08000003']);
      expect(params.get('sex-92443')).toBe('Female');

      const comparisonOptions = page.locator('#compare-table details');
      await comparisonOptions
        .getByLabel('Select a geography or goal to compare with')
        .selectOption('Statistical regions');
      await apply(comparisonOptions);
      await expect(
        page
          .locator('#compare-table')
          .getByRole('columnheader', { name: 'North West (Statistical region)' }),
      ).toBeVisible();
      await comparisonOptions.getByRole('radio', { name: 'Yes' }).click();
      await apply(comparisonOptions);
      await expect(
        page.locator('#compare-table').getByRole('columnheader', { name: 'Minimum' }),
      ).toBeVisible();
      const downloading = page.waitForEvent('download');
      await page
        .locator('#compare-table')
        .getByRole('button', { name: 'Download this table' })
        .click();
      const download = await downloading;
      expect(download.suggestedFilename()).toBe('compare-indicators.csv');
      const csv = await readFile(await download.path(), 'utf8');
      expect(csv).toContain('Manchester North West (Statistical region) minimum');
      expect(csv).toContain('Manchester North West (Statistical region) maximum');
      expect(csv).toContain('Under 75 mortality rate from all causes');
      expect(csv).toContain('Smoking Prevalence in adults');
      expect(csv).toContain('501.440080475667 per 100,000');
    });

    test('applies inequality category and period choices and restores them on reload', async ({
      page,
    }) => {
      await open(page, '/indicators/108?tab-108=inequalities');
      const options = page.locator('#inequalities-108 details');
      const table = page.getByRole('table', { name: /deprivation deciles/ });
      await options
        .getByLabel('Select inequality category')
        .selectOption('District and unitary authority deprivation deciles (IMD2019)');
      await apply(options);
      await expect(table).toHaveAccessibleName(
        'District and unitary authority deprivation deciles (IMD2019), 2024',
      );
      await options.getByLabel('Select time period', { exact: true }).selectOption('2023');
      await apply(options);
      await expect(table).toHaveAccessibleName(/, 2023$/);
      await options.getByLabel('Select confidence intervals').selectOption('95%');
      await apply(options);
      await expect(
        table.getByRole('columnheader', { name: '95% confidence interval' }),
      ).toBeVisible();
      await page.reload();
      await expect(table).toHaveAccessibleName(
        'District and unitary authority deprivation deciles (IMD2019), 2023',
      );
      await expect(
        table.getByRole('columnheader', { name: '95% confidence interval' }),
      ).toBeVisible();
    });

    test('can be collapsed by keyboard without losing selected options', async ({ page }) => {
      await page.goto('/indicators/108?tab-108=table');
      if (javaScriptEnabled) {
        await expect(page.getByRole('combobox', { name: 'Search for an indicator' })).toBeVisible();
      }
      const options = page.locator('details').filter({
        has: page.locator('summary').filter({ hasText: /^Table options$/ }),
      });
      const sex = options.getByLabel('Select sex');
      await sex.selectOption('Male');
      const summary = options.locator('summary');
      await summary.focus();
      await summary.press('Enter');
      await expect(sex).toBeHidden();
      await summary.press('Space');
      await expect(sex).toBeVisible();
      await expect(sex).toHaveValue('Male');
    });
  });
}
