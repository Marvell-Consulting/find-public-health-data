/**
 * React Router's own distinction: a route module with a default export renders a page; one
 * without is a resource route, answering with data or a redirect and never a page to scan.
 */
export function isPageModule(source: string): boolean {
  return /\bexport\s+default\b|\bas\s+default\b/.test(source);
}
