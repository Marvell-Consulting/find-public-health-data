import { expect, type Page, test } from '@playwright/test';

import { expectNoAccessibilityViolations } from '../support/accessibility.ts';

const card = (page: Page, title: string) =>
  page
    .locator('.fphd-filter-card')
    .filter({ has: page.getByRole('heading', { name: title, exact: true }) });
const results = (page: Page) => page.locator('.fphd-search-results');

async function ready(page: Page, path = '/search') {
  await page.goto(path);
  await page.locator('.autocomplete__wrapper').first().waitFor({ state: 'attached' });
}

test('loads the search page with h1', async ({ page }) => {
  await page.goto('/search');

  await expect(page.getByRole('heading', { level: 1, name: 'Search for data' })).toBeVisible();
});

test('uses the compact NotGovUK search box', async ({ page }) => {
  await page.goto('/search');

  const input = page.getByRole('searchbox', { name: 'Search by keywords' });
  const button = page.getByRole('button', { name: 'Search', exact: true });

  await expect(input.locator('..')).toHaveClass(/not-govuk-search-box/);
  await expect(button).toHaveCSS('background-color', 'rgb(29, 112, 184)');
  await expect(button).toHaveCSS('height', '40px');
  await expect(button).toHaveCSS('width', '40px');
});

test('keeps filter card geometry stable through hydration', async ({ page }) => {
  const geometry = async () =>
    page.locator('.govuk-grid-column-one-third').evaluate((column) => {
      const box = (element: Element) => {
        const { x, y, width, height } = element.getBoundingClientRect();
        return { x, y, width, height };
      };
      const searchBox = column.querySelector('.fphd-search-bar');
      if (!searchBox) throw new Error('Search box is missing');
      return {
        column: box(column),
        searchBox: box(searchBox),
        cards: [...column.querySelectorAll('.fphd-filter-card')].map(box),
      };
    });

  await page.route('**/*', async (route) => {
    if (route.request().resourceType() === 'script') await route.abort();
    else await route.continue();
  });
  await page.goto('/search');

  const serverGeometry = await geometry();

  await page.unroute('**/*');
  await page.reload();
  await ready(page);

  expect(await geometry()).toEqual(serverGeometry);
});

test('styles filter card toggles as links', async ({ page }) => {
  await ready(page);

  const toggle = page.getByRole('button', { name: 'Topics and types Expand' });
  await expect(toggle).toHaveCSS('color', 'rgb(26, 101, 166)');
  await expect(toggle).toHaveCSS('text-decoration-line', 'underline');
});

test('has no WCAG 2.2 AA violations', async ({ page }, testInfo) => {
  await page.goto('/search');

  await page.getByRole('heading', { level: 1, name: 'Search for data' }).waitFor();
  await expectNoAccessibilityViolations(page, testInfo);
});

test('a keyword narrows the result count', async ({ page }) => {
  await page.goto('/search');

  await page.getByRole('heading', { name: /Select from/ }).waitFor();
  const initial = await page.getByRole('heading', { name: /Select from/ }).textContent();

  await page.goto('/search?q=mortality');

  await page.getByRole('heading', { name: /Select from/ }).waitFor();
  const narrowed = await page.getByRole('heading', { name: /Select from/ }).textContent();

  expect(narrowed).not.toEqual(initial);
  expect(narrowed).toMatch(/Select from \d+ indicators?/);
});

test('search matches an indicator number and taxonomy slugs', async ({ page }) => {
  await page.goto('/search?q=108');
  await expect(page.getByRole('heading', { name: 'Select from 1 indicator' })).toBeVisible();
  await expect(results(page).getByRole('link')).toHaveAttribute('href', '/indicators/108');

  await page.goto('/search?q=mortality-and-life-expectancy');
  await expect(results(page).locator('.fphd-search-result').first()).toContainText(
    'Mortality and life expectancy',
  );

  await page.goto('/search?q=indicator-type-outcome');
  await expect(results(page).locator('.fphd-search-result').first()).toContainText('Outcome');
});

test('ticking a result and clicking View selected indicators lands on /indicators?is=...', async ({
  page,
}) => {
  await ready(page);

  await page.getByRole('heading', { name: /Select from/ }).waitFor();

  const firstCheckbox = page.getByRole('checkbox').first();
  const indicatorValue = await firstCheckbox.getAttribute('value');
  await firstCheckbox.check();

  const viewBtn = page.getByRole('button', { name: 'View selected indicators' });
  await viewBtn.click();

  await expect(page).toHaveURL(new RegExp(`/indicators.*is=${indicatorValue}`));
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test.describe('indicator selection without scripting', () => {
  test.use({ javaScriptEnabled: false });

  test('reports when the submitted selection exceeds the display limit', async ({ page }) => {
    await page.goto('/search');
    const checkboxes = page.locator('input[name="is"]');
    await expect(checkboxes).toHaveCount(13);
    for (let index = 0; index < 11; index++) await checkboxes.nth(index).check();

    await page.getByRole('button', { name: 'View selected indicators' }).click();

    expect(new URL(page.url()).searchParams.getAll('is')).toHaveLength(11);
    await expect(page.locator('.fphd-indicator-section')).toHaveCount(10);
    await expect(
      page.getByText(
        'Showing the first 10 selected indicators. Select fewer indicators to change which ones are shown.',
      ),
    ).toBeVisible();
  });
});

test('search nav link appears between Home and Topics', async ({ page }) => {
  await page.goto('/');

  const navLinks = page.getByRole('navigation').getByRole('link');
  const texts = await navLinks.allTextContents();

  const homeIdx = texts.indexOf('Home');
  const searchIdx = texts.indexOf('Search');
  const topicsIdx = texts.indexOf('Topics');

  expect(homeIdx).toBeGreaterThanOrEqual(0);
  expect(searchIdx).toBeGreaterThanOrEqual(0);
  expect(topicsIdx).toBeGreaterThanOrEqual(0);
  expect(searchIdx).toBeGreaterThan(homeIdx);
  expect(topicsIdx).toBeGreaterThan(searchIdx);
});

test('home page search form navigates to /search with q param', async ({ page }) => {
  await page.goto('/');

  await page.getByLabel('Search for data').fill('mortality');
  await page.getByRole('button', { name: 'Search' }).click();

  await expect(page).toHaveURL('/search?q=mortality');
  await expect(page.getByRole('heading', { level: 1, name: 'Search for data' })).toBeVisible();
});

test('clearing keywords clears both submitted and unsubmitted text', async ({ page }) => {
  await ready(page);
  const input = page.getByRole('searchbox', { name: 'Search by keywords' });
  await input.fill('diabetes');
  await page.getByRole('link', { name: 'Clear search', exact: true }).click();
  await expect(input).toHaveValue('');
  await input.fill('diabetes');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page).toHaveURL(/q=diabetes/);
  await page.getByRole('link', { name: 'Clear search', exact: true }).click();
  await expect(input).toHaveValue('');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page).not.toHaveURL(/diabetes/);
});

test('filtering a capped selection resets ticks, count and disabled results', async ({ page }) => {
  await ready(page);
  for (let i = 0; i < 10; i++) await results(page).getByRole('checkbox').nth(i).check();
  await expect(results(page).getByRole('checkbox').nth(10)).toBeDisabled();
  await page.getByRole('searchbox', { name: 'Search by keywords' }).fill('cancer');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page).toHaveURL(/q=cancer/);
  await expect(
    page.getByRole('heading', { name: 'Select from 1 indicator', exact: true }),
  ).toBeVisible();
  await expect(results(page).locator('input:checked')).toHaveCount(0);
  await expect(results(page).getByRole('checkbox')).toBeEnabled();
  await page.getByRole('button', { name: 'View selected indicators' }).click();
  await expect(page.getByRole('alert')).toHaveText('Error: Select at least one indicator to view.');
  await expect(page).toHaveURL(/\/search\?q=cancer/);
  await results(page).getByRole('checkbox').check();
  await page.getByRole('button', { name: 'View selected indicators' }).click();
  await expect(page).toHaveURL(/\/indicators\?.*is=/);
});

test('keeps the results live region while searches update its count', async ({ page }) => {
  await ready(page);
  const heading = page.getByRole('heading', { name: 'Select from 13 indicators', exact: true });
  await expect(heading).toHaveAttribute('aria-live', 'polite');
  await expect(heading).toHaveAttribute('aria-atomic', 'true');
  const liveRegion = await heading.elementHandle();
  if (!liveRegion) throw new Error('The results live region must exist before searching');

  await results(page).getByRole('checkbox').first().check();
  const input = page.getByRole('searchbox', { name: 'Search by keywords' });
  await input.fill('cancer');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page).toHaveURL(/q=cancer/);
  expect(await liveRegion.evaluate((element) => element.isConnected)).toBe(true);
  await expect.poll(() => liveRegion.textContent()).toBe('Select from 1 indicator');
  await expect(results(page).getByRole('checkbox')).not.toBeChecked();

  await input.fill('zzzzzzzzzzzz');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page).toHaveURL(/q=zzzzzzzzzzzz/);
  expect(await liveRegion.evaluate((element) => element.isConnected)).toBe(true);
  await expect.poll(() => liveRegion.textContent()).toBe('Select from 0 indicators');
  await expect(
    page.getByText('No indicators match your selected filters or search terms.'),
  ).toBeVisible();
});

test('editing an autocomplete choice cancels it and adding resets the field', async ({ page }) => {
  await ready(page);
  const topics = card(page, 'Topics and types');
  await topics.getByRole('button', { name: /Expand$/ }).click();
  const input = topics.getByRole('combobox', { name: 'Search for a topic' });
  await input.fill('Diabetes');
  await page.getByRole('option', { name: 'Diabetes', exact: true }).click();
  await expect(topics.getByRole('button', { name: 'Add topic', exact: true })).toBeVisible();
  await input.fill('nonsense');
  await input.press('Escape');
  await expect(topics.getByRole('button', { name: 'Add topic', exact: true })).toBeHidden();
  await input.fill('Diabetes');
  await expect(page.getByRole('option', { name: 'Diabetes', exact: true })).toBeVisible();
  await input.press('ArrowDown');
  await expect(page.getByRole('option', { name: 'Diabetes', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.keyboard.press('Enter');
  await topics.getByRole('button', { name: 'Add topic', exact: true }).click();
  await expect(page).toHaveURL(/t=diabetes/);
  await expect(input).toHaveValue('');
  await expect(topics.getByRole('link', { name: 'Remove Diabetes filter' })).toBeVisible();
});

test('keeps long autocomplete values clear of the dropdown arrow', async ({ page }) => {
  await ready(page, '/search?pg=population-infants-and-early-years-aged-4-years-and-under');

  const input = page.getByRole('combobox', { name: 'Search for a population group' });
  await expect(input).toBeVisible();
  await expect(input).toHaveCSS('padding-right', '35px');
});

test('a complete long data source remains selected and narrows results', async ({ page }) => {
  await ready(page);
  const attributes = card(page, 'Data attributes');
  await attributes.getByRole('button', { name: /Expand$/ }).click();
  await attributes.getByRole('combobox', { name: 'Search for a data source' }).fill('Medicines');
  const option = page.getByRole('option').first();
  const source = (await option.innerText()).trim();
  expect(source.length).toBeGreaterThan(100);
  await option.click();
  await attributes.getByRole('button', { name: 'Add data source', exact: true }).click();
  await expect(page).toHaveURL(/src=/);
  expect(new URL(page.url()).searchParams.get('src')).toBe(source);
  await expect(
    attributes.getByRole('link', { name: `Remove ${source} filter`, exact: true }),
  ).toBeVisible();
  await expect(results(page).getByRole('checkbox')).toHaveCount(2);
  await page.reload();
  await expect(
    attributes.getByRole('link', { name: `Remove ${source} filter`, exact: true }),
  ).toBeVisible();
});

test('geography levels and areas match the compact prototype tree', async ({ page }) => {
  await ready(page);
  const geography = card(page, 'Geography');
  await geography.getByRole('button', { name: /Expand$/ }).click();
  const levelRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/geographies?level=')) levelRequests.push(request.url());
  });
  await geography.getByRole('button', { name: 'Expand Local authorities' }).click();

  const level = geography.getByText('Local authorities', { exact: true });
  const longLevel = geography.getByText('Middle-layer super output areas', { exact: true });
  const area = geography.getByText('County Durham', { exact: true });
  const levelInput = geography.getByRole('checkbox', { name: 'Local authorities', exact: true });
  const toggle = geography.getByRole('button', { name: 'Collapse Local authorities' });
  await expect(area).toBeVisible();
  await expect(geography.getByText('Loading…')).toHaveCount(0);
  await expect(
    geography.getByText('Showing the first 100 — search to find the rest'),
  ).toBeVisible();
  await expect(geography.locator('.fphd-geo-alt__children').getByRole('checkbox')).toHaveCount(100);
  expect(levelRequests).toEqual([]);
  await expect(level).toHaveCSS('font-size', '16px');
  await expect(levelInput).toHaveCSS('width', '24px');
  await expect(levelInput).toHaveCSS('height', '36px');
  await expect(toggle).toHaveCSS('height', '36px');

  const levelBox = await level.boundingBox();
  const longLevelBox = await longLevel.boundingBox();
  const areaBox = await area.boundingBox();
  expect(levelBox).not.toBeNull();
  expect(longLevelBox?.height).toBe(levelBox?.height);
  expect((areaBox?.x ?? 0) - (levelBox?.x ?? 0)).toBe(26);
});

test('geography can be unchecked or cleared without leaving pending ticks', async ({ page }) => {
  await ready(page, '/search?geo=Statistical+regions');
  const geography = card(page, 'Geography');
  const level = geography.getByRole('checkbox', { name: 'Statistical regions', exact: true });
  await level.uncheck();
  await geography.getByRole('button', { name: 'Update selected geographies (1)' }).click();
  await expect(page).toHaveURL('/search');
  await level.check();
  await geography.getByRole('button', { name: 'Add selected geographies (1)' }).click();
  await expect(page).toHaveURL(/geo=/);
  await geography.getByRole('link', { name: 'Clear filter' }).click();
  await expect(page).toHaveURL('/search');
  await expect(level).not.toBeChecked();
  await expect(geography.getByRole('button', { name: /Add selected geographies/ })).toBeHidden();
});

test('selected areas return only indicators with data for every area', async ({ page }) => {
  await ready(page, '/search?ga=E07000223&ga=E07000032');

  await expect(
    results(page).getByRole('checkbox', {
      name: /Smoking Prevalence in adults .* current smokers \(APS\)/,
    }),
  ).toBeVisible();
  await expect(
    results(page).getByRole('checkbox', {
      name: /Attended contacts with community and outpatient mental health services/,
    }),
  ).toHaveCount(0);
});

test('clear and remove links replace the current filter history entry', async ({ page }) => {
  await ready(page, '/search?t=diabetes&geo=Statistical+regions');
  const before = await page.evaluate(() => history.length);
  await page.getByRole('link', { name: 'Remove Diabetes filter', exact: true }).click();
  await expect(page).not.toHaveURL(/t=diabetes/);
  await page.getByRole('link', { name: 'Clear all filters', exact: true }).click();
  await expect(page).toHaveURL('/search');
  expect(await page.evaluate(() => history.length)).toBe(before);
});

for (const direct of [true, false]) {
  test(`selected areas and whole levels reach the indicator view via ${direct ? 'title' : 'selection'}`, async ({
    page,
  }) => {
    await ready(page, '/search?geo=Statistical+regions&ga=E06000052');
    if (direct) await results(page).getByRole('link').first().click();
    else {
      await results(page).getByRole('checkbox').first().check();
      await page.getByRole('button', { name: 'View selected indicators' }).click();
    }
    await expect(page).toHaveURL(/\/indicators/);
    const params = new URL(page.url()).searchParams;
    expect(params.getAll('as')).toEqual(['E06000052']);
    expect(params.getAll('als')).toEqual(['Statistical regions']);
    await expect(
      page.getByRole('link', { name: 'Remove Cornwall filter', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Remove Statistical regions filter', exact: true }),
    ).toBeVisible();
  });
}

test('geography search reports failures, retries and empty results', async ({ page }) => {
  await ready(page);
  const geography = card(page, 'Geography');
  await geography.getByRole('button', { name: /Expand$/ }).click();
  await page.route('**/geographies?*', (route) =>
    route.fulfill({ status: 502, body: 'Unavailable' }),
  );
  const input = geography.getByRole('searchbox', { name: 'Add geographies' });
  await input.fill('Cornwall');
  await expect(geography.locator('.fphd-geo-alt__tree').getByRole('status')).toContainText(
    'Geography search is not working',
  );
  await page.unroute('**/geographies?*');
  await geography.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(geography.getByRole('checkbox', { name: 'Cornwall', exact: true })).toBeVisible();
  await input.fill('zzzzzzzzzzzz');
  await expect(geography.locator('.fphd-geo-alt__tree').getByRole('status')).toContainText(
    'No geographies found',
  );
});

test('geography failure stays visible after scrolling previous results', async ({ page }) => {
  await ready(page);
  const geography = card(page, 'Geography');
  await geography.getByRole('button', { name: /Expand$/ }).click();
  const tree = geography.locator('.fphd-geo-alt__tree');
  const input = geography.getByRole('searchbox', { name: 'Add geographies' });
  await input.fill('E');
  await expect(tree.getByRole('checkbox').first()).toBeVisible();
  await tree.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect.poll(() => tree.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await page.route('**/geographies?*', (route) =>
    route.fulfill({ status: 502, body: 'Unavailable' }),
  );
  await input.fill('Cornwall');
  await expect(tree.getByRole('status').first()).toContainText('Geography search is not working');
  await expect.poll(() => tree.evaluate((element) => element.scrollTop)).toBe(0);
  const retry = tree.getByRole('button', { name: 'Try again' });
  expect(
    await retry.evaluate((button) => {
      const tree = button.closest('.fphd-geo-alt__tree');
      if (!tree) return false;
      return button.getBoundingClientRect().bottom <= tree.getBoundingClientRect().bottom;
    }),
  ).toBe(true);
});

test('filter navigation preserves unsubmitted search text', async ({ page }) => {
  await ready(page);
  const keyword = page.getByRole('searchbox', { name: 'Search by keywords' });
  await keyword.fill('unfinished keyword');
  const frameworks = card(page, 'Frameworks');
  await frameworks.getByRole('button', { name: /Expand$/ }).click();
  const framework = frameworks.getByRole('combobox', { name: 'Search for a framework' });
  await framework.fill('unfinished framework');
  const geography = card(page, 'Geography');
  await geography.getByRole('button', { name: /Expand$/ }).click();
  await geography.getByRole('button', { name: 'Expand Local authorities' }).click();
  await geography.getByRole('checkbox', { name: 'County Durham' }).check();
  await geography.getByRole('button', { name: 'Add selected geographies (1)' }).click();
  await expect(page).toHaveURL(/ga=E06000047/);
  await expect(keyword).toHaveValue('unfinished keyword');
  await expect(framework).toHaveValue('unfinished framework');
});

test('geography searches keep existing areas visible while loading', async ({ page }, testInfo) => {
  await ready(page);
  const geography = card(page, 'Geography');
  await geography.getByRole('button', { name: /Expand$/ }).click();
  await geography.getByRole('button', { name: 'Expand Local authorities' }).click();
  await expect(geography.getByRole('checkbox', { name: 'County Durham' })).toBeVisible();
  let finishSearch: (() => Promise<void>) | undefined;
  await page.route('**/geographies?*', (route) => {
    finishSearch = () => route.fulfill({ json: { groups: [] } });
  });
  const requested = page.waitForRequest('**/geographies?*');
  await geography.getByRole('searchbox', { name: 'Add geographies' }).fill('missing-place');
  await requested;

  await expect(geography.getByRole('checkbox', { name: 'County Durham' })).toBeVisible();
  await expect(geography.locator('.fphd-geo-alt__tree').getByRole('status')).toContainText(
    'Finding geographies',
  );
  await expect(
    geography.locator('.fphd-geo-alt__tree').getByRole('status').locator('p'),
  ).toHaveClass(/govuk-visually-hidden/);
  await expect(geography.getByText('No geographies found')).toHaveCount(0);
  await finishSearch?.();
  await expect(geography.locator('.fphd-geo-alt__tree').getByRole('status')).toContainText(
    'No geographies found',
  );
  await expectNoAccessibilityViolations(page, testInfo);
});

test('geography searches keep previous results visible while loading', async ({ page }) => {
  await ready(page);
  const geography = card(page, 'Geography');
  await geography.getByRole('button', { name: /Expand$/ }).click();
  const input = geography.getByRole('searchbox', { name: 'Add geographies' });
  await input.fill('Cornwall');
  await expect(geography.getByRole('checkbox', { name: 'Cornwall', exact: true })).toBeVisible();

  let finishSearch: (() => Promise<void>) | undefined;
  await page.route('**/geographies?*', (route) => {
    finishSearch = () => route.fulfill({ json: { groups: [] } });
  });
  const requested = page.waitForRequest('**/geographies?*');
  await input.fill('missing-place');
  await requested;

  await expect(geography.getByRole('checkbox', { name: 'Cornwall', exact: true })).toBeVisible();
  await finishSearch?.();
  await expect(geography.locator('.fphd-geo-alt__tree').getByRole('status')).toContainText(
    'No geographies found',
  );

  const nextRequest = page.waitForRequest('**/geographies?*');
  await input.fill('another-place');
  await nextRequest;
  await expect(geography.getByRole('button', { name: 'Expand Local authorities' })).toBeVisible();
  await finishSearch?.();
});

test('a whole level exceeding the area limit shows a notice on the indicator view', async ({
  page,
}) => {
  await ready(page, '/search?geo=Local+authorities');
  await results(page).getByRole('link').first().click();
  await expect(page.getByText(/Showing the first 19 selected areas/)).toBeVisible();
});

test('expanded filters have no WCAG 2.2 AA violations', async ({ page }, testInfo) => {
  await ready(page);
  for (const title of [
    'Topics and types',
    'Geography',
    'Frameworks',
    'Populations and inequalities',
    'Data attributes',
  ]) {
    await card(page, title)
      .getByRole('button', { name: /Expand$/ })
      .click();
  }
  await expectNoAccessibilityViolations(page, testInfo);
});

for (const width of [390, 768, 1024, 1440]) {
  test(`search fits a ${width}px viewport with aligned titles`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await ready(page);
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    const row = results(page).locator('.fphd-search-result').first();
    const checkbox = await row.getByRole('checkbox').boundingBox();
    const title = await row.getByRole('link').first().boundingBox();
    if (!checkbox || !title) throw new Error('The result checkbox and title must be visible');
    expect(title.x - checkbox.x).toBeCloseTo(59, 0);
    expect(
      await row
        .getByRole('link')
        .first()
        .evaluate((el) => getComputedStyle(el).fontSize),
    ).toBe('19px');
  });
}

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('search and individual geography selections work through to the indicator view', async ({
    page,
  }) => {
    await page.goto('/search');
    await page.getByRole('searchbox', { name: 'Search by keywords' }).fill('mortality');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page).toHaveURL(/q=mortality/);
    const geography = card(page, 'Geography');
    await geography.getByRole('searchbox', { name: 'Add geographies' }).fill('Cornwall');
    await geography.getByRole('button', { name: 'Find geographies', exact: true }).click();
    await expect(page).toHaveURL(/geo-q=Cornwall/);
    await geography.getByRole('checkbox', { name: 'Cornwall', exact: true }).check();
    await geography.getByRole('button', { name: /Add selected geographies/ }).click();
    await expect(page).toHaveURL(/ga=E06000052/);
    await results(page).getByRole('checkbox').first().check();
    await page.getByRole('button', { name: 'View selected indicators' }).click();
    await expect(page).toHaveURL(/\/indicators\?.*as=E06000052/);
    await expect(
      page.getByRole('link', { name: 'Remove Cornwall filter', exact: true }),
    ).toBeVisible();
    await page.getByRole('searchbox', { name: 'Add geographies' }).fill('Devon');
    await page.getByRole('button', { name: 'Find geographies', exact: true }).click();
    await expect(
      page
        .getByRole('group', { name: 'Areas in Local authorities', exact: true })
        .getByRole('checkbox', { name: 'Devon', exact: true }),
    ).toBeVisible();
  });

  test('browsing a geography level reveals areas without losing existing levels', async ({
    page,
  }) => {
    await page.goto('/search?geo=NHS+regions');
    const geography = card(page, 'Geography');
    await geography
      .getByRole('button', { name: 'Show areas in Statistical regions', exact: true })
      .click();
    await expect(
      geography.getByRole('checkbox', { name: 'North East', exact: true }),
    ).toBeVisible();
    await geography.getByRole('searchbox', { name: 'Add geographies' }).fill('Cornwall');
    await geography.getByRole('button', { name: 'Find geographies', exact: true }).click();
    await geography.getByRole('checkbox', { name: 'Cornwall', exact: true }).check();
    await geography.getByRole('button', { name: /Add selected geographies/ }).click();
    await expect(page).toHaveURL(/geo=NHS\+regions/);
    await expect(page).toHaveURL(/ga=E06000052/);
  });
});
