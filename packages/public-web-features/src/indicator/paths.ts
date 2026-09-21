import { SLUG_MAX_LENGTH, SLUG_PATTERN } from '@fphd/config/slug';

/** The public indicator page, addressed by the canonical slug the API reports. */
export function indicatorPath(slug: string): string {
  return `/indicators/${encodeURIComponent(slug)}`;
}

/** One of the page's server-rendered downloads, under the same address as the page. */
export function indicatorCsvPath(slug: string, kind: 'table' | 'all-data'): string {
  return `${indicatorPath(slug)}/${kind}.csv`;
}

// A short id is a Postgres integer, so it never has more than ten digits.
const SHORT_ID_SEGMENT = /^\d{1,10}$/;
// A slug is never digits only, so a longer run of digits addresses nothing.
const DIGITS_ONLY = /^\d+$/;

/**
 * Whether a route segment can address an indicator: a short id, or a slug in any case.
 * Case and superseded slugs are the loader's 301, not a 404.
 */
export function isIndicatorSegment(segment: string): boolean {
  const lowered = segment.toLowerCase();

  if (DIGITS_ONLY.test(lowered)) return SHORT_ID_SEGMENT.test(lowered);

  return lowered.length <= SLUG_MAX_LENGTH && SLUG_PATTERN.test(lowered);
}
