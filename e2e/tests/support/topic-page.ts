import { expect, type Page, test } from '@playwright/test';
import { expectNoAccessibilityViolations } from './accessibility.ts';
import { MORTALITY_NAME, MORTALITY_PATH } from './indicator-page.ts';

const TOPIC_PATH = '/topics/mortality-and-life-expectancy';

async function openTopicPage(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator('.govuk-tabs')).not.toHaveClass(/fphd-tabs--ssr/);
}

export function topicPageTests() {
  test('shows topic indicators with the comparison table and links to their detail', async ({
    page,
  }, testInfo) => {
    await openTopicPage(page, `${TOPIC_PATH}?tab-topic=data`);
    const panel = page.getByRole('tabpanel', { name: 'Data', exact: true });
    await expect(page.getByRole('tab', { name: 'Data', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(
      panel.getByRole('table', { name: 'Mortality and life expectancy indicators' }),
    ).toBeVisible();
    await expect(panel.getByRole('columnheader', { name: 'England' })).toBeVisible();
    await expect(panel.locator('.fphd-trend-tag').first()).toHaveCSS('font-size', '16px');
    await expect(
      panel.getByRole('link', { name: MORTALITY_NAME, exact: true }).first(),
    ).toHaveAttribute('href', MORTALITY_PATH);
    await expect(panel.getByText('Subtopic to be added').first()).toBeVisible();
    await page.getByRole('button', { name: 'Status Expand', exact: true }).click();
    await expect(page.getByText('Indicator status information will be added here.')).toBeVisible();
    await expectNoAccessibilityViolations(page, testInfo);
  });

  test('keeps GOV.UK filters collapsed and usable after navigating between topic tabs', async ({
    page,
  }, testInfo) => {
    await openTopicPage(page, TOPIC_PATH);
    await page.getByRole('tab', { name: 'Data', exact: true }).click();
    await expect(
      page.getByRole('tabpanel', { name: 'Data', exact: true }).getByRole('table'),
    ).toBeVisible();
    await page.getByRole('tab', { name: 'Area summaries', exact: true }).click();
    await expect(page.getByRole('table', { name: 'Topic indicators by area' })).toBeVisible();
    await page.getByRole('tab', { name: 'Data', exact: true }).click();
    await expect(page.locator('body')).toHaveClass(/govuk-frontend-supported/);
    await expect(
      page.getByRole('button', { name: 'Topics and types Expand', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('combobox', { name: 'Search for an indicator type', exact: true }),
    ).toBeHidden();
    await page.getByRole('button', { name: 'Topics and types Expand', exact: true }).click();
    await expect(
      page.getByRole('combobox', { name: 'Search for an indicator type', exact: true }),
    ).toBeVisible();
    await expectNoAccessibilityViolations(page, testInfo);
  });

  test('keeps keyword searches within the topic and can clear the search', async ({
    page,
  }, testInfo) => {
    await openTopicPage(page, `${TOPIC_PATH}?tab-topic=data`);
    await page
      .getByRole('searchbox', { name: 'Search by keywords' })
      .fill('no-such-topic-indicator');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(
      page.getByText('No indicators match your selected filters or search terms.', { exact: true }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/topics\/mortality-and-life-expectancy\?/);
    await expectNoAccessibilityViolations(page, testInfo);
    await page.getByRole('link', { name: 'Clear search', exact: true }).click();
    await expect(
      page.getByRole('tabpanel', { name: 'Data', exact: true }).getByRole('table'),
    ).toBeVisible();
  });

  test('shows area summaries as a tartan rug with text comparisons and England values', async ({
    page,
  }, testInfo) => {
    await openTopicPage(page, `${TOPIC_PATH}?tab-topic=data`);
    await page.getByRole('tab', { name: 'Area summaries', exact: true }).click();
    const panel = page.getByRole('tabpanel', { name: 'Area summaries', exact: true });
    const table = panel.getByRole('table', { name: 'Topic indicators by area' });
    await expect(table).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'England', exact: true })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Adur', exact: true })).toBeVisible();
    await expect(
      table
        .getByRole('cell', { name: /Better than England|Worse than England|Similar to England/ })
        .first(),
    ).toBeVisible();
    await expectNoAccessibilityViolations(page, testInfo);
  });

  test('reveals area summaries only after their data has loaded', async ({ page }, testInfo) => {
    await openTopicPage(page, `${TOPIC_PATH}?tab-topic=data`);
    let release: () => void = () => {};
    const ready = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/topics/mortality-and-life-expectancy.data?*', async (route) => {
      await ready;
      await route.continue();
    });
    try {
      await page.getByRole('tab', { name: 'Area summaries', exact: true }).click();
      await expect(page.getByRole('status').filter({ hasText: 'Loading topic data…' })).toHaveText(
        'Loading topic data…',
      );
      await expect(page.getByRole('tabpanel', { name: 'Data', exact: true })).toBeVisible();
      await expect(
        page.getByRole('tabpanel', { name: 'Area summaries', exact: true }),
      ).toBeHidden();
      await expect(
        page.getByRole('link', { name: 'View area summaries for local authorities' }),
      ).toBeHidden();
    } finally {
      release();
    }
    await expect(
      page.getByRole('tabpanel', { name: 'Area summaries', exact: true }).getByRole('table'),
    ).toBeVisible();
    await expectNoAccessibilityViolations(page, testInfo);
  });

  for (const width of [1280, 375]) {
    test(`keeps topic tables inside the page and uses compact typography at ${width}px`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await openTopicPage(page, `${TOPIC_PATH}?tab-topic=areas`);
      await expect(page.getByRole('tabpanel', { name: 'Data', exact: true })).toBeHidden();
      await expect(page.getByRole('tabpanel', { name: 'Overview', exact: true })).toBeHidden();
      const table = page.getByRole('table', { name: 'Topic indicators by area' });
      await expect(table.locator('tbody td').first()).toHaveCSS('font-size', '16px');
      const dimensions = await page.evaluate(() => ({
        page: document.documentElement.scrollWidth,
        viewport: document.documentElement.clientWidth,
      }));
      expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport);
      const region = page.getByRole('region', { name: 'Topic indicators by area', exact: true });
      await expect(region).toHaveCSS('overflow-x', 'auto');
      await expect(region).toHaveCSS('position', 'relative');
      const columnWidth = await table
        .locator('tbody td')
        .first()
        .evaluate((cell) => cell.getBoundingClientRect().width);
      expect(columnWidth).toBeLessThan(300);
      await page
        .getByRole('tabpanel', { name: 'Area summaries', exact: true })
        .getByText('Download or share data', { exact: true })
        .click();
      await expect(
        page.getByRole('link', { name: 'Download this table', exact: true }),
      ).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
      await expectNoAccessibilityViolations(page, testInfo);
    });
  }

  test('keeps chosen geographies across topic tabs and clears them within the topic', async ({
    page,
  }, testInfo) => {
    await openTopicPage(page, `${TOPIC_PATH}?tab-topic=data&ga=E07000223`);
    await expect(
      page
        .getByRole('tabpanel', { name: 'Data', exact: true })
        .getByRole('columnheader', { name: 'Adur', exact: true }),
    ).toBeVisible();
    await page.getByRole('tab', { name: 'Area summaries', exact: true }).click();
    const summaries = page.getByRole('tabpanel', { name: 'Area summaries', exact: true });
    await expect(summaries.getByRole('columnheader', { name: 'Adur', exact: true })).toBeVisible();
    await expect(
      summaries.getByRole('columnheader', { name: 'England', exact: true }),
    ).toBeVisible();
    await summaries.getByText('Download or share data', { exact: true }).click();
    const download = await summaries
      .getByRole('link', { name: 'Download this table' })
      .getAttribute('href');
    const response = await page.request.get(download as string);
    expect(response.headers()['content-disposition']).toContain('area-summaries.csv');
    expect(await response.text()).toContain('Adur comparison');
    await expectNoAccessibilityViolations(page, testInfo);
    await page.getByRole('tab', { name: 'Data', exact: true }).click();
    await page.getByRole('link', { name: 'Clear all filters', exact: true }).click();
    await expect(page).toHaveURL(/\/topics\/mortality-and-life-expectancy\?/);
    await expect(
      page
        .getByRole('tabpanel', { name: 'Data', exact: true })
        .getByRole('columnheader', { name: 'England', exact: true }),
    ).toBeVisible();
    await expectNoAccessibilityViolations(page, testInfo);
  });

  test('downloads the topic table currently shown', async ({ page }) => {
    await openTopicPage(page, `${TOPIC_PATH}?tab-topic=data`);
    await page
      .getByRole('tabpanel', { name: 'Data', exact: true })
      .getByText('Download or share data', { exact: true })
      .click();
    const link = page.getByRole('link', { name: 'Download this table', exact: true });
    const href = await link.getAttribute('href');
    expect(href).toBeTruthy();
    const response = await page.request.get(href as string);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/csv');
    const csv = await response.text();
    expect(csv).toContain(MORTALITY_NAME);
    expect(csv).toContain('England');
    const [download] = await Promise.all([page.waitForEvent('download'), link.click()]);
    expect(download.suggestedFilename()).toBe('mortality-and-life-expectancy-data.csv');
    await expect(
      page.getByRole('tabpanel', { name: 'Data', exact: true }).getByRole('table'),
    ).toBeVisible();
  });

  test('applies year coverage and refresh filters and clears them within the topic', async ({
    page,
  }, testInfo) => {
    await openTopicPage(page, `${TOPIC_PATH}?tab-topic=data`);
    await page.getByRole('button', { name: 'Data period Expand', exact: true }).click();
    await page.getByLabel('Data up until year', { exact: true }).fill('2999');
    await page.getByRole('button', { name: 'Apply data period', exact: true }).click();
    await expect(
      page.getByText('No indicators match your selected filters or search terms.', { exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel('Data up until year', { exact: true })).toHaveValue('2999');
    await expectNoAccessibilityViolations(page, testInfo);
    await page.getByRole('link', { name: 'Clear all filters', exact: true }).click();
    await expect(
      page.getByRole('tabpanel', { name: 'Data', exact: true }).getByRole('table'),
    ).toBeVisible();
    await page.getByRole('combobox', { name: 'Sort by', exact: true }).selectOption('period-desc');
    await expect(page).toHaveURL(/sort=period-desc/);
    await page.reload();
    await expect(page.getByRole('combobox', { name: 'Sort by', exact: true })).toHaveValue(
      'period-desc',
    );
  });

  test('copies a shareable URL with the selected topic tab and sort order', async ({
    page,
    context,
  }, testInfo) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openTopicPage(page, `${TOPIC_PATH}?tab-topic=data&sort=name-desc`);
    await page
      .getByRole('tabpanel', { name: 'Data', exact: true })
      .getByText('Download or share data', { exact: true })
      .click();
    await page.getByRole('button', { name: 'Copy link to this view', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Link copied' })).toHaveText(
      'Link copied',
    );
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toBe(page.url());
    await expectNoAccessibilityViolations(page, testInfo);
  });

  test('retains the selected tab after reloading and shows the publications placeholder', async ({
    page,
  }, testInfo) => {
    await openTopicPage(page, TOPIC_PATH);
    await page.getByRole('tab', { name: 'Publications', exact: true }).click();
    await expect(page).toHaveURL(/tab-topic=publications/);
    await page.reload();
    await expect(page.getByText('Publications for this topic will be added here.')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Publications', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expectNoAccessibilityViolations(page, testInfo);
  });

  test('supports topic search, sorting and area summaries without JavaScript', async ({
    browser,
    baseURL,
    context: sessionContext,
  }) => {
    const context = await browser.newContext({
      ...(baseURL ? { baseURL } : {}),
      javaScriptEnabled: false,
      storageState: await sessionContext.storageState(),
    });
    const page = await context.newPage();
    try {
      await page.goto(TOPIC_PATH);
      await page.getByRole('tab', { name: 'Data', exact: true }).click();
      await page.getByRole('searchbox', { name: 'Search by keywords' }).fill('Under 75');
      await page.getByRole('button', { name: 'Search', exact: true }).click();
      await expect(
        page.getByRole('link', { name: MORTALITY_NAME, exact: true }).first(),
      ).toBeVisible();
      await page.getByRole('button', { name: 'Sort indicators', exact: true }).first().click();
      await page.getByRole('tab', { name: 'Area summaries', exact: true }).click();
      await expect(page.getByRole('table', { name: 'Topic indicators by area' })).toBeVisible();
    } finally {
      await context.close();
    }
  });
}
