import { index, type RouteConfig, route } from '@react-router/dev/routes';

export default [
  index('../../../packages/public-web-features/src/routes/home.tsx'),
  route('releases', '../../../packages/public-web-features/src/routes/releases.tsx'),
  route('sign-in', './sign-in.tsx'),
  route('*', '../../../packages/ui/src/not-found-route.tsx'),
] satisfies RouteConfig;
