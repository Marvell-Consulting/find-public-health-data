import { index, type RouteConfigEntry, route } from '@react-router/dev/routes';

// React Router resolves these paths against the consuming app's `appDirectory`, so they
// are written relative to `apps/*/src` rather than to this file.
const routeModules = '../../../packages/public-web-features/src/routes';

export function publicRoutes(): RouteConfigEntry[] {
  return [
    index(`${routeModules}/home.tsx`),
    route('topics', `${routeModules}/topics.tsx`),
    route('topics/:slug', `${routeModules}/topic.tsx`),
    route('indicators', `${routeModules}/indicator.tsx`),
    route('indicators/:fingertipsId', `${routeModules}/indicator.tsx`, {
      id: 'indicator-detail',
    }),
  ];
}
