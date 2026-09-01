import { publicRoutes } from '@fphd/public-web-features/route-config';
import { layout, type RouteConfig, route } from '@react-router/dev/routes';

export default [
  route('sign-in', './sign-in.tsx'),
  route('access-denied', './access-denied.tsx'),
  layout('./authenticated.tsx', [...publicRoutes(), route('manage', './manage.tsx')]),
  route('*', '../../../packages/ui/src/not-found-route.tsx'),
] satisfies RouteConfig;
