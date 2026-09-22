import type { UIMatch } from 'react-router';

export interface BackLinkTarget {
  href: string;
  text: string;
}

/**
 * A route's `handle` export, read by the app shell to place a back link above the main content
 * where GOV.UK puts it. The function form takes the route's loader data.
 */
export interface BackLinkHandle<Data = unknown> {
  backLink: BackLinkTarget | ((data: Data) => BackLinkTarget);
}

export function backLinkHandle<Data>(
  backLink: BackLinkHandle<Data>['backLink'],
): BackLinkHandle<Data> {
  return { backLink };
}

function isBackLinkHandle(handle: unknown): handle is BackLinkHandle {
  return typeof handle === 'object' && handle !== null && 'backLink' in handle;
}

/** The back link of the deepest matched route that declares one; a loader-derived link needs the loader to have run. */
export function backLinkFrom(matches: readonly UIMatch[]): BackLinkTarget | undefined {
  for (const match of matches.toReversed()) {
    if (!isBackLinkHandle(match.handle)) continue;

    const { backLink } = match.handle;

    if (typeof backLink !== 'function') return backLink;
    if (match.loaderData !== undefined) return backLink(match.loaderData);
  }

  return undefined;
}
