import { isRouteErrorResponse, useRouteError } from 'react-router';

import { type AppNavigationItem, AppShell } from './app-shell';
import { NotFoundPage, PageIntro } from './content-page';

interface RootErrorBoundaryProps {
  audience: 'Public' | 'Internal';
  navigation: AppNavigationItem[];
}

/**
 * Renders inside AppShell because it replaces the app's default export (which is where
 * AppShell normally comes from) whenever a route error bubbles up with nothing closer to
 * catch it — the root's `Layout` export still wraps it in the HTML document shell.
 */
export function RootErrorBoundary({ audience, navigation }: RootErrorBoundaryProps) {
  const error = useRouteError();
  const isNotFound = isRouteErrorResponse(error) && error.status === 404;

  return (
    <AppShell audience={audience} navigation={navigation}>
      {isNotFound ? (
        <NotFoundPage />
      ) : (
        <PageIntro title="Sorry, there is a problem with this service">
          <p className="govuk-body">Try again later.</p>
        </PageIntro>
      )}
    </AppShell>
  );
}
