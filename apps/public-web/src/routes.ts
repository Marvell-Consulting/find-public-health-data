import { index, type RouteConfig, route } from '@react-router/dev/routes';

export default [
  index('../../../packages/public-web-features/src/home/route.tsx'),
  route('search', '../../../packages/public-web-features/src/search/route.tsx'),
  route('topics', '../../../packages/public-web-features/src/topic/list-route.tsx'),
  route('topics/:slug', '../../../packages/public-web-features/src/topic/route.tsx'),
  route('indicators', '../../../packages/public-web-features/src/indicator/route.tsx'),
  route('indicators/search', '../../../packages/public-web-features/src/indicator/search-route.ts'),
  route('geographies', '../../../packages/public-web-features/src/indicator/geography-route.ts'),
  route(
    'indicators/compare.csv',
    '../../../packages/public-web-features/src/indicator/comparison-csv-route.ts',
  ),
  route(
    'indicators/:shortId/table.csv',
    '../../../packages/public-web-features/src/indicator/table-csv-route.ts',
  ),
  route(
    'indicators/:shortId/all-data.csv',
    '../../../packages/public-web-features/src/indicator/all-data-csv-route.ts',
  ),
  route('indicators/:shortId', '../../../packages/public-web-features/src/indicator/route.tsx', {
    id: 'indicator-detail',
  }),
  route('*', '../../../packages/ui/src/not-found-route.tsx'),
] satisfies RouteConfig;
