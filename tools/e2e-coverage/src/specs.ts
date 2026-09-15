/**
 * Page routes, as `react-router routes` reports them, to the spec covering them. The mapping is
 * spelt out rather than derived from the path so a new route is a deliberate entry here and a
 * spec to match, and so a group of routes making one journey can share a spec. Both apps use
 * the one table: a route is looked up under the spec directory of whichever app declares it.
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
  '/manage': 'manage.spec.ts',
  '/manage/topics': 'manage-topics.spec.ts',
  '/manage/topics/new': 'manage-topics.spec.ts',
  '/manage/topics/:id': 'manage-topics.spec.ts',
  '/manage/topics/:id/delete': 'manage-topics.spec.ts',
  '/*': 'not-found.spec.ts',
};

/** Routes that serve no page of their own; each is exercised through the pages that call it. */
export const RESOURCE_ROUTES: readonly string[] = [
  '/indicators/search',
  '/geographies',
  '/indicators/compare.csv',
  '/indicators/:fingertipsId/table.csv',
  '/indicators/:fingertipsId/all-data.csv',
];

export type Finding = {
  route: string;
  problem: string;
};

/**
 * Each of one app's routes must be a resource route or map to a spec that exists among `specs`,
 * the spec paths relative to the app's spec directory.
 */
export function findUncoveredRoutes(
  routes: readonly string[],
  specs: readonly string[],
  mapping: Readonly<Record<string, string>> = PAGE_SPECS,
  resources: readonly string[] = RESOURCE_ROUTES,
): Finding[] {
  const present = new Set(specs);
  return routes.flatMap((route) => {
    if (resources.includes(route)) return [];
    const spec = mapping[route];
    if (spec === undefined) {
      return [{ route, problem: 'is mapped to no spec and is not a resource route' }];
    }
    if (!present.has(spec)) {
      return [{ route, problem: `is mapped to ${spec}, which does not exist` }];
    }
    return [];
  });
}

/**
 * Mapping and allowlist entries no app declares any more. A stale entry is harmless today but
 * stops the table being the record of which route each spec covers.
 */
export function findStaleEntries(
  routes: readonly string[],
  mapping: Readonly<Record<string, string>> = PAGE_SPECS,
  resources: readonly string[] = RESOURCE_ROUTES,
): string[] {
  const declared = new Set(routes);
  return [...Object.keys(mapping), ...resources].filter((route) => !declared.has(route));
}

const SCAN_CALL = /\bexpectNoAccessibilityViolations\s*\(/;

/** Spec sources that never scan for accessibility violations, by name. */
export function findSpecsWithoutScan(
  specs: ReadonlyArray<{ name: string; source: string }>,
): string[] {
  return specs.filter(({ source }) => !SCAN_CALL.test(source)).map(({ name }) => name);
}
