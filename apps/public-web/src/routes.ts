import { index, type RouteConfig, route } from '@react-router/dev/routes';

export default [
  index('../../../packages/public-web-features/src/routes/home.tsx'),
  route('sign-in', './sign-in.tsx'),
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
  route('*', '../../../packages/ui/src/not-found-route.tsx'),
] satisfies RouteConfig;
