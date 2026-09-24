import { expect, type Page } from '@playwright/test';

/**
 * Waits for GOV.UK Frontend to take over the error summary, which it marks once initialised.
 * Its script runs after hydration, and until then a summary link does not move focus.
 */
export async function expectErrorSummaryReady(page: Page) {
  await expect(page.locator('[data-govuk-error-summary-init]')).toBeAttached();
}
