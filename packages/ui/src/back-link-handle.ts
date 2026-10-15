import type { UIMatch } from 'react-router';

/**
 * A route's `handle` export, read by the app shell to place a back link above the main content
 * where GOV.UK puts it. The function form takes the route's loader data.
 */
export interface BackLinkHandle<Data = unknown> {
  backHref: string | ((data: Data) => string);
  /** Names the destination, as GOV.UK asks of a back link; without it the link reads "Back". */
  backText?: string;
}

export interface BackLink {
  href: string;
  text?: string | undefined;
}

export function backLinkHandle<Data>(
  backHref: BackLinkHandle<Data>['backHref'],
  backText?: string,
): BackLinkHandle<Data> {
  return backText === undefined ? { backHref } : { backHref, backText };
}

function isBackLinkHandle(handle: unknown): handle is BackLinkHandle {
  return typeof handle === 'object' && handle !== null && 'backHref' in handle;
}

/** The back link of the deepest matched route that declares one; a loader-derived link needs the loader to have run. */
export function backLinkFrom(matches: readonly UIMatch[]): BackLink | undefined {
  for (const match of matches.toReversed()) {
    if (!isBackLinkHandle(match.handle)) continue;

    const { backHref, backText } = match.handle;

    if (typeof backHref !== 'function') return { href: backHref, text: backText };
    if (match.loaderData !== undefined) {
      return { href: backHref(match.loaderData), text: backText };
    }
  }

  return undefined;
}
