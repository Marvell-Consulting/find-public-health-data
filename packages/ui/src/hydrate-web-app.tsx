import { StrictMode, startTransition, useEffect } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { HydratedRouter } from 'react-router/dom';

import { initNotGovuk } from './init-not-govuk';

function NotGovukEnhancements() {
  useEffect(initNotGovuk, []);

  return null;
}

export function hydrateWebApp() {
  startTransition(() => {
    hydrateRoot(
      document,
      <StrictMode>
        <HydratedRouter />
        <NotGovukEnhancements />
      </StrictMode>,
    );
  });
}
