import { expect, test } from '@playwright/test';

import { expectNoAccessibilityViolations } from '../support/accessibility.js';

test('loads the search page with h1', async ({ page }) => {
  await page.goto('/search');

  await expect(page.getByRole('heading', { level: 1, name: 'Search for data' })).toBeVisible();
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

test('ticking a result and clicking View selected indicators lands on /indicators?is=...', async ({
  page,
}) => {
  await page.goto('/search');

  await page.getByRole('heading', { name: /Select from/ }).waitFor();

  const firstCheckbox = page.getByRole('checkbox').first();
  const indicatorValue = await firstCheckbox.getAttribute('value');
  await firstCheckbox.check();

  const viewBtn = page.getByRole('button', { name: 'View selected indicators' });
  await viewBtn.click();

  await expect(page).toHaveURL(new RegExp(`/indicators.*is=${indicatorValue}`));
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
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
