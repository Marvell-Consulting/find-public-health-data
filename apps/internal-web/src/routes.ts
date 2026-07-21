import { index, type RouteConfig, route } from '@react-router/dev/routes';

export default [
  index('../../../packages/public-web-features/src/routes/home.tsx'),
  route('releases', '../../../packages/public-web-features/src/routes/releases.tsx'),
  route('sign-in', '../../../packages/public-web-features/src/routes/sign-in.tsx'),
  route('manage', '../../../packages/internal-web-features/src/manage-route.tsx'),
  route('*', '../../../packages/ui/src/not-found-route.tsx'),
] satisfies RouteConfig;
