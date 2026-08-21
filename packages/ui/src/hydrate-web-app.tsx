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
  // The CSP hides the nonce attribute from the DOM, but the IDL property still returns
  // it, so the client tree can render the same nonce the server did.
  const nonce = document.querySelector<HTMLScriptElement>('script[nonce]')?.nonce || undefined;
  startTransition(() => {
    hydrateRoot(
      document,
      <StrictMode>
        <NonceProvider value={nonce}>
          <NotGovukEnhancements>
            <HydratedRouter />
          </NotGovukEnhancements>
        </NonceProvider>
      </StrictMode>,
    );
  });
}
