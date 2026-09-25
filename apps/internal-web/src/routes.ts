import { index, layout, type RouteConfig, route } from '@react-router/dev/routes';

export default [
  index('./home.tsx'),
  route('sign-in', './sign-in.tsx'),
  route('access-denied', './access-denied.tsx'),
  layout('./authenticated.tsx', [
    route('search', '../../../packages/public-web-features/src/search/route.tsx'),
    route('topics', '../../../packages/public-web-features/src/topic/list-route.tsx'),
    route('topics/:slug', '../../../packages/public-web-features/src/topic/route.tsx'),
    route('indicators', '../../../packages/public-web-features/src/indicator/route.tsx'),
    route(
      'indicators/search',
      '../../../packages/public-web-features/src/indicator/search-route.ts',
    ),
    route('geographies', '../../../packages/public-web-features/src/indicator/geography-route.ts'),
    route(
      'indicators/compare.csv',
      '../../../packages/public-web-features/src/indicator/comparison-csv-route.ts',
    ),
    route(
      'indicators/:slug/table.csv',
      '../../../packages/public-web-features/src/indicator/table-csv-route.ts',
    ),
    route(
      'indicators/:slug/all-data.csv',
      '../../../packages/public-web-features/src/indicator/all-data-csv-route.ts',
    ),
    route('indicators/:slug', '../../../packages/public-web-features/src/indicator/route.tsx', {
      id: 'indicator-detail',
    }),
    layout('./publisher.tsx', [
      route('dashboard', '../../../packages/internal-web-features/src/dashboard/route.tsx'),
      route(
        'dashboard/indicators/:id',
        '../../../packages/internal-web-features/src/indicator-overview/route.tsx',
      ),
      route(
        'publish/indicators/new',
        '../../../packages/internal-web-features/src/indicator-name/new-route.tsx',
      ),
      route(
        'publish/indicators/:id/name',
        '../../../packages/internal-web-features/src/indicator-name/edit-route.tsx',
      ),
      route(
        'publish/indicators/:id/task-list',
        '../../../packages/internal-web-features/src/indicator-task-list/route.tsx',
      ),
      route(
        'publish/indicators/:id/definition-and-rationale',
        '../../../packages/internal-web-features/src/indicator-definition-and-rationale/route.tsx',
      ),
      route(
        'publish/indicators/:id/polarity',
        '../../../packages/internal-web-features/src/indicator-polarity/route.tsx',
      ),
      route(
        'publish/indicators/:id/calculation',
        '../../../packages/internal-web-features/src/indicator-calculation/route.tsx',
      ),
      route(
        'publish/indicators/:id/confidence-intervals',
        '../../../packages/internal-web-features/src/indicator-confidence-intervals/route.tsx',
      ),
      route(
        'publish/indicators/:id/update-frequency',
        '../../../packages/internal-web-features/src/indicator-update-frequency/route.tsx',
      ),
      route(
        'publish/indicators/:id/other-notes-and-caveats',
        '../../../packages/internal-web-features/src/indicator-other-notes-and-caveats/route.tsx',
      ),
      route(
        'publish/indicators/:id/publishing-date',
        '../../../packages/internal-web-features/src/indicator-publishing-date/route.tsx',
      ),
    ]),
    layout('./admin.tsx', [
      route('manage', './manage.tsx'),
      route(
        'manage/topics',
        '../../../packages/internal-web-features/src/topic-admin/list-route.tsx',
      ),
      route(
        'manage/topics/new',
        '../../../packages/internal-web-features/src/topic-admin/new-route.tsx',
      ),
      route(
        'manage/topics/:id',
        '../../../packages/internal-web-features/src/topic-admin/edit-route.tsx',
      ),
      route(
        'manage/topics/:id/delete',
        '../../../packages/internal-web-features/src/topic-admin/delete-route.tsx',
      ),
    ]),
  ]),
  route('*', '../../../packages/ui/src/not-found-route.tsx'),
] satisfies RouteConfig;
