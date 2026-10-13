/**
 * Sets up the error summaries a page has rendered since it loaded, which GOV.UK Frontend has not
 * seen: each takes focus, and its links move focus to their fields. Loaded only in the browser.
 */
export async function initNewErrorSummaries(): Promise<void> {
  const { ErrorSummary } = await import('govuk-frontend');

  for (const summary of document.querySelectorAll(
    '[data-module="govuk-error-summary"]:not([data-govuk-error-summary-init])',
  )) {
    new ErrorSummary(summary);
  }
}
