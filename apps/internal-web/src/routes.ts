import { index, layout, type RouteConfig, route } from '@react-router/dev/routes';

export default [
  route('sign-in', './sign-in.tsx'),
  route('access-denied', './access-denied.tsx'),
  layout('./authenticated.tsx', [
    index('../../../packages/public-web-features/src/routes/home.tsx'),
    route('topics', '../../../packages/public-web-features/src/routes/topics.tsx'),
    route('topics/:slug', '../../../packages/public-web-features/src/routes/topic.tsx'),
    route('indicators', '../../../packages/public-web-features/src/routes/indicator.tsx'),
    route(
      'indicators/search',
      '../../../packages/public-web-features/src/routes/indicator-search.ts',
    ),
    route('geographies', '../../../packages/public-web-features/src/routes/geography.ts'),
    route(
      'indicators/:fingertipsId',
      '../../../packages/public-web-features/src/routes/indicator.tsx',
      { id: 'indicator-detail' },
    ),
    layout('./publisher.tsx', [
      route('manage', './manage.tsx'),
      route('manage/topics', '../../../packages/internal-web-features/src/routes/admin-topics.tsx'),
      route(
        'manage/topics/:id',
        '../../../packages/internal-web-features/src/routes/edit-topic.tsx',
      ),
    ]),
  ]),
  route('*', '../../../packages/ui/src/not-found-route.tsx'),
] satisfies RouteConfig;
