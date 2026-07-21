import type { ReactNode } from 'react';
import { Links, Meta, Scripts, ScrollRestoration } from 'react-router';

interface AppDocumentProps {
  children: ReactNode;
}

export function AppDocument({ children }: AppDocumentProps) {
  return (
    <html lang="en" className="govuk-template">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="govuk-template__body" suppressHydrationWarning>
        <script
          // GOV.UK Frontend uses these classes to progressively enhance interactive components.
          dangerouslySetInnerHTML={{
            __html:
              "document.body.classList.add('js-enabled');" +
              "if ('noModule' in HTMLScriptElement.prototype) document.body.classList.add('govuk-frontend-supported');",
          }}
        />
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
