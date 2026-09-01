import type { ReactNode } from 'react';
import { Links, Meta, Scripts, ScrollRestoration } from 'react-router';

import { useNonce } from './nonce';

interface AppDocumentProps {
  children: ReactNode;
}

export function AppDocument({ children }: AppDocumentProps) {
  const nonce = useNonce();

  return (
    <html lang="en" className="govuk-template">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links nonce={nonce} />
      </head>
      <body className="govuk-template__body" suppressHydrationWarning>
        <script
          nonce={nonce}
          // The CSP blanks the nonce attribute in the DOM, so hydration can never see it
          // match the real value both renders agree on.
          suppressHydrationWarning
          // GOV.UK Frontend uses these classes to progressively enhance interactive components.
          dangerouslySetInnerHTML={{
            __html:
              "document.body.classList.add('js-enabled');" +
              "if ('noModule' in HTMLScriptElement.prototype) document.body.classList.add('govuk-frontend-supported');",
          }}
        />
        {children}
        {/* Keyed by pathname: filter and option changes navigate within one page, and
            the position saved as the navigation starts is restored as it lands — the
            page never moves. Without this the default per-location keying finds no
            saved position and falls through to scrolling the URL hash (the open tab's
            anchor) back into view on every change. */}
        <ScrollRestoration getKey={(location) => location.pathname} />
        <Scripts />
      </body>
    </html>
  );
}
