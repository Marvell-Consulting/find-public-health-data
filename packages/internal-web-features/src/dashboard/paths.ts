export const DASHBOARD_PATH = '/dashboard';

/** The first page is the bare path, so the canonical address has no query string. */
export function dashboardPath(page: number): string {
  return page === 1 ? DASHBOARD_PATH : `${DASHBOARD_PATH}?page=${page}`;
}
