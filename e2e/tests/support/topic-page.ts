import { expect, type Page, test } from '@playwright/test';
import { expectNoAccessibilityViolations } from './accessibility.ts';
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
    await expect(page.getByText('are getting better')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Highlighted indicators' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Diabetes: QOF prevalence' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'View all diabetes indicators' })).toBeVisible();
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

  test('keeps filters and sorting within the topic', async ({ page }) => {
    await openTopicPage(page, `${TOPIC_PATH}?tab-topic=data`);
    await page.getByRole('searchbox', { name: 'Search by keywords' }).fill('Under 75');
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
