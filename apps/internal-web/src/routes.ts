import { index, layout, type RouteConfig, route } from '@react-router/dev/routes';

export default [
  route('sign-in', './sign-in.tsx'),
  route('access-denied', './access-denied.tsx'),
  layout('./authenticated.tsx', [
    index('../../../packages/public-web-features/src/home/route.tsx'),
    route('topics', '../../../packages/public-web-features/src/topic/list-route.tsx'),
    route('topics/:slug', '../../../packages/public-web-features/src/topic/route.tsx'),
    route('indicators', '../../../packages/public-web-features/src/indicator/route.tsx'),
    route(
      'indicators/search',
      '../../../packages/public-web-features/src/indicator/search-route.ts',
    ),
    route('geographies', '../../../packages/public-web-features/src/indicator/geography-route.ts'),
    route(
      'indicators/:fingertipsId/table.csv',
      '../../../packages/public-web-features/src/indicator/table-csv-route.ts',
    ),
    route(
      'indicators/:fingertipsId/all-data.csv',
      '../../../packages/public-web-features/src/indicator/all-data-csv-route.ts',
    ),
    route(
      'indicators/:fingertipsId',
      '../../../packages/public-web-features/src/indicator/route.tsx',
      { id: 'indicator-detail' },
    ),
    layout('./publisher.tsx', [
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
