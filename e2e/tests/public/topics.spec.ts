import { expect, test } from '@playwright/test';

import { expectNoAccessibilityViolations } from '../support/accessibility.ts';

test.beforeEach(async ({ page }) => {
  await page.goto('/topics');
});

test('lists the public health topics', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1, name: 'Public health topics' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Alcohol' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Smoking and tobacco' })).toBeVisible();
});

test('opens a topic from its card', async ({ page }) => {
  await page.getByRole('link', { name: 'Smoking and tobacco' }).click();
  await expect(page).toHaveURL('/topics/smoking-and-tobacco');
  await expect(page.getByRole('heading', { level: 1, name: 'Smoking and tobacco' })).toBeVisible();
});

test('has no WCAG 2.2 AA violations', async ({ page }, testInfo) => {
  await expectNoAccessibilityViolations(page, testInfo);
});

test('hydrates topic search without errors', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.reload();

  await page.getByRole('search').getByRole('searchbox', { name: 'Search for topics' }).fill('smok');
  await expect(page.getByRole('main').getByRole('heading', { level: 2 })).toHaveText(
    'Smoking and tobacco',
  );
  await expect(page.getByRole('button', { name: 'Search', exact: true })).toHaveCount(0);
  await expectNoAccessibilityViolations(page, testInfo);
  expect(errors).toEqual([]);
});

test('preserves and filters text entered before hydration', async ({ page }, testInfo) => {
  const scripts = Promise.withResolvers<void>();
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() === 'script') await scripts.promise;
    await route.continue();
  });
  try {
    await page.reload({ waitUntil: 'commit' });
    const search = page.getByRole('searchbox', { name: 'Search for topics' });
    await search.fill('smok');
    await expect(page.getByRole('button', { name: 'Search', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Alcohol', exact: true })).toBeVisible();

    scripts.resolve();
    const headings = page.getByRole('main').getByRole('heading', { level: 2 });
    await expect(headings).toHaveCount(1);
    await expect(headings).toHaveText('Smoking and tobacco');
    await expect(search).toHaveValue('smok');
    await expect(page.getByRole('button', { name: 'Search', exact: true })).toHaveCount(0);
    await expectNoAccessibilityViolations(page, testInfo);
  } finally {
    scripts.resolve();
  }
});

test('filters topics as you type and keeps highlighted titles in the link colour', async ({
  page,
}, testInfo) => {
  const search = page.getByRole('searchbox', { name: 'Search for topics' });
  await search.fill('  SMOK  ');

  await expect(page.getByRole('main').getByRole('heading', { level: 2 })).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Smoking and tobacco' }).locator('mark')).toHaveText(
    'Smok',
  );
  const link = page.getByRole('link', { name: 'Smoking and tobacco' });
  const mark = link.locator('mark');
  const colour = (element: HTMLElement | SVGElement) => getComputedStyle(element).color;
  expect(await mark.evaluate(colour)).toBe(await link.evaluate(colour));
  await link.hover();
  expect(await mark.evaluate(colour)).toBe(await link.evaluate(colour));
  await expectNoAccessibilityViolations(page, testInfo);

  await page.getByRole('link', { name: 'Smoking and tobacco' }).click();
  await expect(page).toHaveURL('/topics/smoking-and-tobacco');
});

test('finds topics by their descriptions', async ({ page }, testInfo) => {
  const title = 'Smoking and tobacco';
  const card = page
    .locator('.fphd-card-list__item')
    .filter({ has: page.getByRole('link', { name: title }) });
  const description = await card.locator('.fphd-card-list__description').innerText();
  const term = description
    .match(/\p{L}{4,}/gu)
    ?.find((word) => !title.toLowerCase().includes(word.toLowerCase()));
  if (!term) throw new Error('Expected a description word absent from the topic title');
  await page.getByRole('searchbox', { name: 'Search for topics' }).fill(term);
  await expect(page.getByRole('link', { name: title })).toBeVisible();
  const marks = card.locator('.fphd-card-list__description mark');
  await expect(marks.first()).toBeVisible();
  expect(
    (await marks.allTextContents()).every((text) => text.toLowerCase() === term.toLowerCase()),
  ).toBe(true);
  await expectNoAccessibilityViolations(page, testInfo);
});

test('keeps the edited search when returning from a topic without adding typing history', async ({
  page,
}, testInfo) => {
  await page.goto('/topics?other=kept&q=alco');
  const search = page.getByRole('searchbox', { name: 'Search for topics' });
  await search.fill('smok');
  await search.pressSequentially('ing');
  await expect(search).toHaveValue('smoking');
  await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe('smoking');
  expect(new URL(page.url()).searchParams.get('other')).toBe('kept');
  await expect(search).toBeFocused();
  await page.getByRole('link', { name: 'Smoking and tobacco' }).click();
  await expect(page).toHaveURL('/topics/smoking-and-tobacco');
  await page.goBack();
  await expect(search).toHaveValue('smoking');
  await expect(page.getByRole('main').getByRole('heading', { level: 2 })).toHaveText(
    'Smoking and tobacco',
  );
  await expectNoAccessibilityViolations(page, testInfo);
  await page.goBack();
  await expect(page).toHaveURL('/topics');
  await expect(search).toHaveValue('');
});

test('keeps a working Search button when client scripts fail to load', async ({
  page,
}, testInfo) => {
  await page.route('**/*', (route) =>
    route.request().resourceType() === 'script' ? route.abort() : route.continue(),
  );
  await page.reload();
  const button = page.getByRole('button', { name: 'Search', exact: true });
  await expect(button).toBeVisible();
  await page.getByRole('searchbox', { name: 'Search for topics' }).fill('smok');
  await button.click();
  await expect(page).toHaveURL('/topics?q=smok');
  await expect(page.getByRole('main').getByRole('heading', { level: 2 })).toHaveText(
    'Smoking and tobacco',
  );
  await expect(button).toBeVisible();
  await expectNoAccessibilityViolations(page, testInfo);
});

test('limits typed topic searches to 200 characters', async ({ page }, testInfo) => {
  const search = page.getByRole('searchbox', { name: 'Search for topics' });
  await search.pressSequentially('x'.repeat(205));
  await expect(search).toHaveValue('x'.repeat(200));
  await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe('x'.repeat(200));
  await expectNoAccessibilityViolations(page, testInfo);
});

test('shows no matching topics and restores all topics when the search is cleared', async ({
  page,
}, testInfo) => {
  const search = page.getByRole('searchbox', { name: 'Search for topics' });
  const headings = page.getByRole('main').getByRole('heading', { level: 2 });
  const topicCount = await headings.count();
  await search.fill('unlikely topic');

  await expect(page.getByText('No topics match your search.')).toBeVisible();
  await expect(headings).toHaveCount(0);
  await expectNoAccessibilityViolations(page, testInfo);

  await search.fill('');
  await expect(headings).toHaveCount(topicCount);
  await expect(page.locator('mark')).toHaveCount(0);
  await expect(page.getByText('No topics match your search.')).not.toBeVisible();
  await expectNoAccessibilityViolations(page, testInfo);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('searches and opens topics without JavaScript', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Alcohol' })).toBeVisible();
    await page.getByRole('searchbox', { name: 'Search for topics' }).fill('smok');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page).toHaveURL('/topics?q=smok');
    await expect(page.getByRole('main').getByRole('heading', { level: 2 })).toHaveText(
      'Smoking and tobacco',
    );
    await expect(
      page.getByRole('link', { name: 'Smoking and tobacco' }).locator('mark'),
    ).toHaveText('Smok');
    await page.getByRole('link', { name: 'Smoking and tobacco' }).click();
    await expect(page).toHaveURL('/topics/smoking-and-tobacco');
  });
});
