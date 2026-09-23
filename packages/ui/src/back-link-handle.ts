import type { UIMatch } from 'react-router';

/**
 * A route's `handle` export, read by the app shell to place a back link above the main content
 * where GOV.UK puts it. The function form takes the route's loader data.
 */
export interface BackLinkHandle<Data = unknown> {
  backHref: string | ((data: Data) => string);
}

export function backLinkHandle<Data>(
  backHref: BackLinkHandle<Data>['backHref'],
): BackLinkHandle<Data> {
  return { backHref };
}

function isBackLinkHandle(handle: unknown): handle is BackLinkHandle {
  return typeof handle === 'object' && handle !== null && 'backHref' in handle;
}

/** The back link of the deepest matched route that declares one; a loader-derived link needs the loader to have run. */
export function backHrefFrom(matches: readonly UIMatch[]): string | undefined {
  for (const match of matches.toReversed()) {
    if (!isBackLinkHandle(match.handle)) continue;

    const { backHref } = match.handle;

    if (typeof backHref !== 'function') return backHref;
    if (match.loaderData !== undefined) return backHref(match.loaderData);
  }

  return undefined;
}
