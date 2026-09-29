export type App = 'public-web' | 'internal-web' | 'public-api' | 'internal-api';

export type Route = {
  app: App;
  /** Path and query, against the seeded data. */
  path: string;
  /** A median slower than this fails the route: 5–10 times CI's usual median (see the README). */
  limitMs: number;
};

export const ORIGINS: Record<App, string> = {
  'public-web': process.env.PUBLIC_WEB_URL ?? 'http://localhost:3000',
  'internal-web': process.env.INTERNAL_WEB_URL ?? 'http://localhost:3001',
  'public-api': process.env.PUBLIC_API_URL ?? 'http://localhost:4000',
  'internal-api': process.env.INTERNAL_API_URL ?? 'http://localhost:4001',
};

/** The key a route's work is recorded under in the baseline. */
export function routeKey(route: Route): string {
  return `${route.app} ${route.path}`;
}

const GP_PRACTICES = 'displayGroup=GP%20practices';
// Diabetes QOF prevalence: GP-level data, the largest indicator in the seed.
const DIABETES = { shortId: 241, id: '01a00ab4-ce0a-70c1-b22b-f8192c94a59d' };
const DIABETES_SLUG = 'diabetes-qof-prevalence';
const MORTALITY_SLUG = 'under-75-mortality-rate-from-all-causes';
const AREAS = ['E92000001', 'E08000003', 'E07000223', 'E07000032', 'E06000047'];

/** Read-only GETs over the seeded data: the common pages and the heaviest queries behind them. */
export const ROUTES: Route[] = [
  { app: 'public-web', path: '/', limitMs: 500 },
  { app: 'public-web', path: '/search?q=mortality', limitMs: 500 },
  { app: 'public-web', path: '/topics', limitMs: 500 },
  { app: 'public-web', path: '/topics/diabetes', limitMs: 500 },
  { app: 'public-web', path: '/indicators?find=mortality', limitMs: 500 },
  { app: 'public-web', path: `/indicators/${DIABETES_SLUG}`, limitMs: 500 },
  {
    app: 'public-web',
    path: '/indicators?as=E07000223&as=E07000032&is=92443&is=241&cmp-compare=england&cr-compare=no',
    limitMs: 1000,
  },
  { app: 'public-web', path: `/indicators/${DIABETES_SLUG}/table.csv`, limitMs: 1000 },
  { app: 'public-web', path: `/indicators/${MORTALITY_SLUG}/all-data.csv`, limitMs: 1000 },

  { app: 'internal-web', path: '/dashboard', limitMs: 500 },
  { app: 'internal-web', path: `/dashboard/indicators/${DIABETES.id}`, limitMs: 500 },
  { app: 'internal-web', path: '/manage/topics', limitMs: 500 },

  { app: 'public-api', path: '/api/topics', limitMs: 250 },
  { app: 'public-api', path: '/api/indicators?q=mortality', limitMs: 250 },
  { app: 'public-api', path: '/api/indicators/search?q=diabetes', limitMs: 250 },
  { app: 'public-api', path: `/api/indicators/${DIABETES.shortId}`, limitMs: 250 },
  {
    app: 'public-api',
    path: `/api/indicators/${DIABETES.shortId}/data?${AREAS.map((code) => `areaCode=${code}`).join('&')}`,
    limitMs: 250,
  },
  {
    app: 'public-api',
    path: `/api/indicators/${DIABETES.shortId}/range?${GP_PRACTICES}`,
    limitMs: 250,
  },
  { app: 'public-api', path: `/api/areas?${GP_PRACTICES}`, limitMs: 250 },
  { app: 'public-api', path: '/api/areas/search?q=leeds', limitMs: 250 },

  { app: 'internal-api', path: '/api/internal/indicators', limitMs: 250 },
  { app: 'internal-api', path: `/api/internal/indicators/${DIABETES.id}`, limitMs: 250 },
  { app: 'internal-api', path: '/api/internal/topics', limitMs: 250 },
];
