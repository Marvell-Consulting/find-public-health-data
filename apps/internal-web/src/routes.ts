import { index, layout, type RouteConfig, route } from '@react-router/dev/routes';

export default [
  route('sign-in', './sign-in.tsx'),
  route('access-denied', './access-denied.tsx'),
  layout('./authenticated.tsx', [
    index('../../../packages/public-web-features/src/routes/home.tsx'),
    route('releases', '../../../packages/public-web-features/src/routes/releases.tsx'),
    route('manage', './manage.tsx'),
  ]),
  route('*', '../../../packages/ui/src/not-found-route.tsx'),
] satisfies RouteConfig;
