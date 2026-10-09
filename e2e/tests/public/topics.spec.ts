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

test('filters topics as you type and highlights matches in titles and descriptions', async ({
  page,
}, testInfo) => {
  const search = page.getByRole('searchbox', { name: 'Search for topics' });
  await search.fill('  SMOK  ');

  await expect(page.getByRole('main').getByRole('heading', { level: 2 })).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Smoking and tobacco' }).locator('mark')).toHaveText(
    'Smok',
  );
  await expect(page.locator('.fphd-card-list__description mark')).toHaveText([
    'Smok',
    'smok',
    'smok',
  ]);
  await expectNoAccessibilityViolations(page, testInfo);

  await page.getByRole('link', { name: 'Smoking and tobacco' }).click();
  await expect(page).toHaveURL('/topics/smoking-and-tobacco');
});

test('finds topics by their descriptions', async ({ page }, testInfo) => {
  await page.getByRole('searchbox', { name: 'Search for topics' }).fill('quitting');

  await expect(page.getByRole('main').getByRole('heading', { level: 2 })).toHaveText(
    'Smoking and tobacco',
  );
  await expect(page.locator('.fphd-card-list__description mark')).toHaveText('quitting');
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
    await page.getByRole('searchbox', { name: 'Search for topics' }).fill('quitting');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(page).toHaveURL('/topics?q=quitting');
    await expect(page.getByRole('main').getByRole('heading', { level: 2 })).toHaveText(
      'Smoking and tobacco',
    );
    await expect(page.locator('.fphd-card-list__description mark')).toHaveText('quitting');
    await page.getByRole('link', { name: 'Smoking and tobacco' }).click();
    await expect(page).toHaveURL('/topics/smoking-and-tobacco');
  });
});
