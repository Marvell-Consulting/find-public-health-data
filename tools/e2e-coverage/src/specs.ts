import { callsScan } from './scans.js';

/**
 * Page routes, as `react-router routes` reports them, to the spec covering them. The mapping is
 * spelt out rather than derived from the path so a new route is a deliberate entry here and a
 * spec to match, and so a group of routes making one journey can share a spec. Both apps use
 * the one table: a route is looked up under the spec directory of whichever app declares it.
 * Resource routes need no entry; one that has an entry, such as a redirect worth a journey
 * test, exempts its spec from scanning.
 */
export const PAGE_SPECS: Readonly<Record<string, string>> = {
  '/': 'home.spec.ts',
  '/sign-in': 'sign-in.spec.ts',
  '/access-denied': 'access-denied.spec.ts',
  '/search': 'search.spec.ts',
  '/topics': 'topics.spec.ts',
  '/topics/:slug': 'topic.spec.ts',
  '/indicators': 'indicators.spec.ts',
  '/indicators/:fingertipsId': 'indicator.spec.ts',
  '/dashboard': 'dashboard.spec.ts',
  '/dashboard/indicators/:id': 'indicator-overview.spec.ts',
  '/manage': 'manage.spec.ts',
  '/manage/topics': 'manage-topics.spec.ts',
  '/manage/topics/new': 'manage-topics.spec.ts',
  '/manage/topics/:id': 'manage-topics.spec.ts',
  '/manage/topics/:id/delete': 'manage-topics.spec.ts',
  '/*': 'not-found.spec.ts',
};

/** One app's route, classified by whether its module renders a page. */
export type ClassifiedRoute = {
  path: string;
  page: boolean;
};

export type Finding = {
  route: string;
  problem: string;
};

/**
 * Each of one app's page routes must map to a spec that exists among `specs`, the spec paths
 * relative to the app's spec directory.
 */
export function findUncoveredRoutes(
  routes: readonly ClassifiedRoute[],
  specs: readonly string[],
  mapping: Readonly<Record<string, string>> = PAGE_SPECS,
): Finding[] {
  const present = new Set(specs);
  return routes.flatMap(({ path, page }) => {
    if (!page) return [];
    const spec = mapping[path];
    if (spec === undefined) {
      return [{ route: path, problem: 'is mapped to no spec' }];
    }
    if (!present.has(spec)) {
      return [{ route: path, problem: `is mapped to ${spec}, which does not exist` }];
    }
    return [];
  });
}

/**
 * Mapping entries no app declares any more. A stale entry is harmless today but stops the table
 * being the record of which route each spec covers.
 */
export function findStaleEntries(
  routes: readonly string[],
  mapping: Readonly<Record<string, string>> = PAGE_SPECS,
): string[] {
  const declared = new Set(routes);
  return Object.keys(mapping).filter((route) => !declared.has(route));
}

/**
 * Specs that never scan for accessibility violations, by name. A spec only resource routes map
 * to has no page to scan and is exempt; every other spec, mapped or not, drives some page state.
 */
export function findSpecsWithoutScan(
  specs: ReadonlyArray<{ name: string; source: string }>,
  routes: readonly ClassifiedRoute[],
  mapping: Readonly<Record<string, string>> = PAGE_SPECS,
): string[] {
  const pageSpecs = new Set<string>();
  const resourceSpecs = new Set<string>();
  for (const { path, page } of routes) {
    const spec = mapping[path];
    if (spec !== undefined) (page ? pageSpecs : resourceSpecs).add(spec);
  }
  return specs
    .filter(({ name }) => pageSpecs.has(name) || !resourceSpecs.has(name))
    .filter(({ source }) => !callsScan(source))
    .map(({ name }) => name);
}
