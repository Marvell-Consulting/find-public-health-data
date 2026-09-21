import { SLUG_MAX_LENGTH, SLUG_PATTERN } from '@fphd/config/slug';

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
 * Case and superseded slugs are the loader's 301, not a 404.
 */
export function isIndicatorSegment(segment: string): boolean {
  const lowered = segment.toLowerCase();

  return /^\d+$/.test(lowered) || (lowered.length <= SLUG_MAX_LENGTH && SLUG_PATTERN.test(lowered));
}
