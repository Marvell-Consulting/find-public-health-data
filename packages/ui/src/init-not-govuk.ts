import { ServiceNavigation } from 'govuk-frontend';

let isInitialised = false;

export function initNotGovuk() {
  if (isInitialised) {
    return;
  }

  for (const navigation of document.querySelectorAll('.govuk-service-navigation')) {
    new ServiceNavigation(navigation);
  }

  isInitialised = true;
}
