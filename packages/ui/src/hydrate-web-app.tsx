import { type ReactNode, StrictMode, startTransition, useEffect } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { HydratedRouter } from 'react-router/dom';

import { initNotGovuk } from './init-not-govuk';
import { NonceProvider } from './nonce';

/**
 * A wrapper rather than a sibling of the router: an extra child at the root gives every
 * component a different useId path than the server's single-child chain, which breaks
 * hydration of every id on the page.
 */
function NotGovukEnhancements({ children }: { children: ReactNode }) {
  useEffect(initNotGovuk, []);

  return children;
}

export function hydrateWebApp() {
  startTransition(() => {
    hydrateRoot(
      document,
      <StrictMode>
        {/* Browsers blank the nonce attribute once parsed, so an empty value is what the
            client has to render for the server's markup to hydrate without a mismatch. */}
        <NonceProvider value="">
          <NotGovukEnhancements>
            <HydratedRouter />
          </NotGovukEnhancements>
        </NonceProvider>
      </StrictMode>,
    );
  });
}
