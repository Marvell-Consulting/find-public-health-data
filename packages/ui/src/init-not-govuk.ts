/// <reference path="./govuk-frontend.d.ts" />

import { ServiceNavigation } from 'govuk-frontend';

let isInitialised = false;

export function initNotGovuk() {
  if (isInitialised) {
    return;
  }

  document.body.classList.add('js-enabled', 'govuk-frontend-supported');

  for (const navigation of document.querySelectorAll('.govuk-service-navigation')) {
    new ServiceNavigation(navigation);
  }

  isInitialised = true;
}
