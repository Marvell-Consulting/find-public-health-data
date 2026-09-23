/** The public indicator page, addressed by the canonical slug the API reports. */
export function indicatorPath(slug: string): string {
  return `/indicators/${encodeURIComponent(slug)}`;
}
