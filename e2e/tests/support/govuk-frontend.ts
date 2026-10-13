import { expect, type Page } from '@playwright/test';

/**
 * Waits for GOV.UK Frontend to take over the error summary, which it marks once initialised.
 * Its script runs after hydration, and until then a summary link does not move focus.
 */
export async function expectErrorSummaryReady(page: Page) {
  await expect(page.locator('[data-govuk-error-summary-init]')).toBeAttached();
}

/**
 * Waits for the page to hydrate, which GOV.UK Frontend's service navigation marks once set up:
 * its script runs only after React has hydrated, so the page's own handlers are attached.
 */
export async function expectHydrated(page: Page) {
  await expect(page.locator('[data-govuk-service-navigation-init]')).toBeAttached();
}
