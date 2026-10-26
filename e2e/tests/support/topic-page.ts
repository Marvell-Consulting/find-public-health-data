import { expect, type Page, test } from '@playwright/test';
import { expectNoAccessibilityViolations } from './accessibility.ts';
import { downloadFrom } from './downloads.ts';
import { MORTALITY_NAME, MORTALITY_PATH } from './indicator-page.ts';

const TOPIC_PATH = '/topics/mortality-and-life-expectancy';

async function openTopicPage(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator('.govuk-tabs')).not.toHaveClass(/fphd-tabs--ssr/);
}

export function topicPageTests() {
  test('shows topic overview counts and highlighted indicator links', async ({
    page,
  }, testInfo) => {
    await openTopicPage(page, '/topics/diabetes');
    await expect(
      page.getByRole('heading', { name: /Diabetes has \d+ indicators in total/ }),
    ).toBeVisible();
    await expect(page.getByText(/(?:are|is) getting better/)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Highlighted indicators' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Diabetes: QOF prevalence' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'View all diabetes indicators' })).toBeVisible();
    await expectNoAccessibilityViolations(page, testInfo);
  });

  test('chooses one overview geography from the prototype authority tiers', async ({
    page,
  }, testInfo) => {
    await openTopicPage(page, '/topics/diabetes');
    const panel = page.getByRole('tabpanel', { name: 'Overview', exact: true });
    await panel.getByRole('button', { name: 'Upper-tier local authorities', exact: true }).click();
    const choices = panel.getByRole('group', {
      name: 'Areas in Upper-tier local authorities',
      exact: true,
    });
    await choices.getByRole('radio', { name: 'Manchester', exact: true }).check();
    await expect(page).toHaveURL(/ga=E08000003/);
    await expect(panel.getByText('Manchester', { exact: true })).toHaveCount(2);
    await expectNoAccessibilityViolations(page, testInfo);
  });

  test('lists indicators with the prototype data columns and detail links', async ({
    page,
  }, testInfo) => {
    await openTopicPage(page, `${TOPIC_PATH}?tab-topic=data`);
    const panel = page.getByRole('tabpanel', { name: 'Data' });
    const table = panel.getByRole('table', { name: /Mortality and life expectancy indicators/ });
    await expect(table).toBeVisible();
    for (const column of [
      'Indicator',
      'Most recent period',
      'Last updated',
      'Trend (last 5 periods)',
      'Calculated value',
    ]) {
      await expect(table.getByRole('columnheader', { name: column })).toBeVisible();
    }
    await expect(
      panel.getByRole('link', { name: MORTALITY_NAME, exact: true }).first(),
    ).toHaveAttribute('href', MORTALITY_PATH);
    await expectNoAccessibilityViolations(page, testInfo);
  });

  test('changes topic table columns and downloads the same view', async ({ page }, testInfo) => {
    await openTopicPage(page, '/topics/diabetes?tab-topic=data');
    const panel = page.getByRole('tabpanel', { name: 'Data', exact: true });
    const table = panel.getByRole('table');
    await panel.getByRole('button', { name: 'Table columns', exact: true }).click();
    await panel.getByRole('checkbox', { name: 'Count', exact: true }).check();
    await panel.getByRole('checkbox', { name: 'Last updated', exact: true }).uncheck();
    await expect(table.getByRole('columnheader', { name: 'Count', exact: true })).toBeVisible();
    await expect(
      table.getByRole('columnheader', { name: 'Last updated', exact: true }),
    ).toHaveCount(0);
    await page.reload();
    await expect(table.getByRole('columnheader', { name: 'Count', exact: true })).toBeVisible();
    await panel.getByRole('button', { name: 'Subtopics and types', exact: true }).click();
    await panel.getByRole('checkbox', { name: 'Prevalence and risk', exact: true }).check();
    await expect(page).toHaveURL(/subtopic=prevalence-and-risk/);
    await expect(table.getByRole('columnheader', { name: 'Count', exact: true })).toBeVisible();
    await panel.getByText('Download or share data', { exact: true }).click();
    const csv = await downloadFrom(page, 'Download filtered data (CSV)', 'link');
    expect(csv.text.split('\n')[0]).toContain('England count');
    expect(csv.text.split('\n')[0]).not.toContain('Last updated');
    await expectNoAccessibilityViolations(page, testInfo);
  });

  test('switches area summary geography and filters the areas without leaving the topic', async ({
    page,
  }, testInfo) => {
    await openTopicPage(page, `${TOPIC_PATH}?tab-topic=areas`);
    await page.getByRole('radio', { name: 'Statistical regions', exact: true }).check();
    await expect(page).toHaveURL(/geo=Statistical/);
    const table = page.getByRole('table', { name: 'Topic indicators by area' });
    await expect(
      table.getByRole('columnheader', { name: 'South West', exact: true }),
    ).toBeVisible();
    await page.getByRole('searchbox', { name: 'Search for a geography (optional)' }).fill('London');
    await page.getByRole('checkbox', { name: 'London', exact: true }).check();
    await expect(page).toHaveURL(/ga=E12000007/);
    await expect(table.getByRole('columnheader', { name: 'London', exact: true })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'South West', exact: true })).toHaveCount(
      0,
    );
    await expectNoAccessibilityViolations(page, testInfo);
  });

  test('uses the prototype widths for each topic tab', async ({ page }) => {
    await page.setViewportSize({ width: 2048, height: 1200 });
    await openTopicPage(page, '/topics/diabetes');
    for (const [tab, width] of [
      ['Overview', 960],
      ['Data', 1988],
      ['Area summaries', 1442],
      ['More information', 960],
    ] as const) {
      await page.getByRole('tab', { name: tab, exact: true }).click();
      const panel = page.getByRole('tabpanel', { name: tab, exact: true });
      await expect(panel).not.toHaveAttribute('aria-busy', 'true');
      await expect
        .poll(async () => Math.round((await panel.boundingBox())?.width ?? 0))
        .toBe(width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(2048);
    }
  });

  test('filters by subtopic and keeps the filter when sorting', async ({ page }, testInfo) => {
    await openTopicPage(page, '/topics/diabetes?tab-topic=data');
    await page.getByRole('button', { name: 'Subtopics and types', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Prevalence and risk', exact: true }).check();
    await expect(page).toHaveURL(/subtopic=prevalence-and-risk/);
    const table = page.getByRole('table', { name: /Diabetes indicators/ });
    await expect(table.getByRole('link', { name: 'Diabetes: QOF prevalence' })).toBeVisible();
    await expect(table.getByRole('link', { name: /Mortality/ })).toHaveCount(0);
    await page.getByRole('combobox', { name: 'Sort by' }).selectOption('name-desc');
    await expect(page).toHaveURL(/subtopic=prevalence-and-risk/);
    await expectNoAccessibilityViolations(page, testInfo);
  });

  test('keeps filters and sorting within the topic', async ({ page }) => {
    await openTopicPage(page, `${TOPIC_PATH}?tab-topic=data`);
    await page
      .getByRole('searchbox', { name: 'Search mortality and life expectancy indicators' })
      .fill('Under 75');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(
      page.getByRole('link', { name: MORTALITY_NAME, exact: true }).first(),
    ).toBeVisible();
    await page.getByRole('combobox', { name: 'Sort by' }).selectOption('name-desc');
    await expect(page).toHaveURL(/sort=name-desc/);
    await expect(page).toHaveURL(/\/topics\/mortality-and-life-expectancy/);
  });

  test('opens area summaries on NHS regions with geography controls', async ({
    page,
  }, testInfo) => {
    await openTopicPage(page, `${TOPIC_PATH}?tab-topic=areas`);
    const panel = page.getByRole('tabpanel', { name: 'Area summaries' });
    await expect(panel.getByRole('heading', { name: 'Geographies' })).toBeVisible();
    const table = panel.getByRole('table', { name: 'Topic indicators by area' });
    await expect(table).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'England', exact: true })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'London', exact: true })).toBeVisible();
    await expectNoAccessibilityViolations(page, testInfo);
  });

  test('shows API backed publication links on the more information tab', async ({
    page,
  }, testInfo) => {
    await openTopicPage(page, '/topics/diabetes?tab-topic=publications');
    const panel = page.getByRole('tabpanel', { name: 'More information' });
    await expect(
      panel.getByRole('heading', { name: 'Official statistics releases on GOV.UK' }),
    ).toBeVisible();
    await expect(
      panel.getByRole('link', { name: 'Diabetes official statistical release, April 2026' }),
    ).toHaveAttribute(
      'href',
      'https://www.gov.uk/government/statistics/diabetes-profile-update-april-2026',
    );
    await expect(panel.getByRole('link', { name: 'Diabetes on GOV.UK' })).toBeVisible();
    await expectNoAccessibilityViolations(page, testInfo);
  });

  test('keeps the active tab after reload', async ({ page }) => {
    await openTopicPage(page, TOPIC_PATH);
    await page.getByRole('tab', { name: 'Data' }).click();
    await expect(page).toHaveURL(/tab-topic=data/);
    await page.reload();
    await expect(page.getByRole('tab', { name: 'Data' })).toHaveAttribute('aria-selected', 'true');
  });
}
