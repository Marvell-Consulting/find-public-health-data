import { matchRoutes, type RouteObject, type ServerBuild } from 'react-router';

type RouteManifest = Pick<ServerBuild, 'routes'>['routes'];
type ManifestRoute = NonNullable<RouteManifest[string]>;

function toRouteTree(manifest: RouteManifest, parentId?: string): RouteObject[] {
  return Object.values(manifest)
    .filter((route): route is ManifestRoute => route !== undefined && route.parentId === parentId)
    .map((route): RouteObject => {
      const shared = {
        id: route.id,
        handle: { page: route.module.default !== undefined },
        ...(route.caseSensitive === undefined ? {} : { caseSensitive: route.caseSensitive }),
      };

      return route.index
        ? { ...shared, index: true }
        : {
            ...shared,
            children: toRouteTree(manifest, route.id),
            ...(route.path === undefined ? {} : { path: route.path }),
          };
    });
}

/**
 * Whether a path is one of the build's pages: it matches a route other than the catch-all,
 * and that route renders a component rather than serving a resource such as a CSV. A data
 * request, an auth endpoint or a made-up path is none of those.
 */
export function createPagePathCheck({
  routes,
}: Pick<ServerBuild, 'routes'>): (path: string) => boolean {
  const tree = toRouteTree(routes);

  return (path) => {
    const { pathname } = new URL(path, 'https://local.invalid');
    const leaf = matchRoutes(tree, pathname)?.at(-1);

    return leaf !== undefined && leaf.route.path !== '*' && leaf.route.handle?.page === true;
  };
}
