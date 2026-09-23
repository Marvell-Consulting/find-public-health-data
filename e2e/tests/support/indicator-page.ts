import { expect, type Page } from '@playwright/test';

/** The seeded indicator the specs drive, at the slug its published page is addressed by. */
export const MORTALITY_SLUG = 'under-75-mortality-rate-from-all-causes';
export const MORTALITY_PATH = `/indicators/${MORTALITY_SLUG}`;
export const MORTALITY_NAME = 'Under 75 mortality rate from all causes';
/** The seed fixes indicator ids, so the publisher's pages for it have a stable address. */
export const MORTALITY_ID = '019fa38f-1346-7094-b773-79dcd43ae4b4';

/** One of the page's two sidebar cards, by its title. */
export function filterCard(page: Page, title: string) {
  return page.locator('.fphd-filter-card', {
    has: page.getByRole('heading', { name: title, exact: true }),
  });
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
