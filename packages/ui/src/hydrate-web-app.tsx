import { StrictMode, startTransition, useEffect } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { HydratedRouter } from 'react-router/dom';

import { initNotGovuk } from './init-not-govuk';
import { NonceProvider } from './nonce';

function NotGovukEnhancements() {
  useEffect(initNotGovuk, []);

  return null;
}

export function hydrateWebApp() {
  startTransition(() => {
    hydrateRoot(
      document,
      <StrictMode>
        {/* Browsers blank the nonce attribute once parsed, so an empty value is what the
            client has to render for the server's markup to hydrate without a mismatch. */}
        <NonceProvider value="">
          <HydratedRouter />
          <NotGovukEnhancements />
        </NonceProvider>
      </StrictMode>,
    );
  });
}
