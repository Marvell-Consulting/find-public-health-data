import { expect, type Page } from '@playwright/test';

/** One of the page's two sidebar cards, by its title. */
export function filterCard(page: Page, title: string) {
  return page.locator('.fphd-filter-card', { hasText: title });
}

/**
 * Opens an indicator page and waits until it is interactive. The search box is a plain
 * input until React has hydrated and the autocomplete loaded; driving the tabs or the
 * geography tree before then reaches the no-script fallbacks instead.
 */
export async function openIndicatorPage(page: Page, path: string) {
  await page.goto(path);
  await expect(
    filterCard(page, 'Selected indicators').getByRole('combobox', {
      name: 'Search for an indicator',
    }),
  ).toBeVisible();
}
