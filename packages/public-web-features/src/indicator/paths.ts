import { isShortId, SHORT_ID_PATTERN } from '@fphd/config/short-id';
import { isReservedSlug, SLUG_MAX_LENGTH, SLUG_PATTERN } from '@fphd/config/slug';

/** The public indicator page, addressed by the canonical slug the API reports. */
export function indicatorPath(slug: string): string {
  return `/indicators/${encodeURIComponent(slug)}`;
}

/** One of the page's server-rendered downloads, under the same address as the page. */
export function indicatorCsvPath(slug: string, kind: 'table' | 'all-data'): string {
  return `${indicatorPath(slug)}/${kind}.csv`;
}

/**
 * Whether a route segment can address an indicator: a short id, or a slug in any case.
 * Case and superseded slugs are the loader's 301, not a 404. A slug is never digits only,
 * so a digit run too large for the column addresses nothing rather than falling through.
 * A reserved word names an API collection endpoint, never an indicator, so it stops here.
 */
export function isIndicatorSegment(segment: string): boolean {
  const lowered = segment.toLowerCase();

  if (SHORT_ID_PATTERN.test(lowered)) return isShortId(lowered);

  return (
    lowered.length <= SLUG_MAX_LENGTH && SLUG_PATTERN.test(lowered) && !isReservedSlug(lowered)
  );
}
