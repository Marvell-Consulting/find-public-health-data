import { ErrorSummary, ServiceNavigation } from 'govuk-frontend';

let isInitialised = false;

export function initNotGovuk() {
  if (isInitialised) {
    return;
  }

  for (const navigation of document.querySelectorAll('.govuk-service-navigation')) {
    new ServiceNavigation(navigation);
  }

  for (const summary of document.querySelectorAll('[data-module="govuk-error-summary"]')) {
    new ErrorSummary(summary);
  }

  isInitialised = true;
}
