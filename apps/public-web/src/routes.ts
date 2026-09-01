import { publicRoutes } from '@fphd/public-web-features/route-config';
import { type RouteConfig, route } from '@react-router/dev/routes';

export default [
  ...publicRoutes(),
  route('sign-in', './sign-in.tsx'),
  route('*', '../../../packages/ui/src/not-found-route.tsx'),
] satisfies RouteConfig;
