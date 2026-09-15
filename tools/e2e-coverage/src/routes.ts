type RouteNode = {
  path: string | undefined;
  index: boolean;
  file: string | undefined;
  children: RouteNode[];
};

/** A URL pattern a request can match, with the module that answers it. */
export type Route = {
  path: string;
  file: string;
};

/**
 * Every matchable route in `react-router routes --json` output: pathful routes and index routes,
 * at any depth, with their parents' paths prefixed. A pathless layout contributes nothing of its
 * own but its children are still walked. Module paths are as written in `routes.ts`, relative to
 * the app directory.
 */
export function collectRoutes(json: string): Route[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (cause) {
    throw new Error(`Could not parse the route table as JSON:\n${json}`, { cause });
  }
  return collect(asRouteNodes(parsed, json), '', json);
}

/**
 * The route table comes from another tool, so its shape is checked here, once, rather than
 * re-narrowed at every level of the walk. A shape this does not recognise is reported rather than
 * skipped: a route quietly dropped here is a route this check never looks at.
 */
function asRouteNodes(value: unknown, json: string): RouteNode[] {
  if (!Array.isArray(value)) {
    throw new Error(`The route table is not an array of routes:\n${json}`);
  }

  return value.map((entry) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new Error(`The route table holds a route that is not an object:\n${json}`);
    }

    const { path, index, file, children } = entry as {
      path?: unknown;
      index?: unknown;
      file?: unknown;
      children?: unknown;
    };
    if (path !== undefined && typeof path !== 'string') {
      throw new Error(`The route table holds a route whose path is not a string:\n${json}`);
    }
    if (index !== undefined && typeof index !== 'boolean') {
      throw new Error(`The route table holds a route whose index flag is not a boolean:\n${json}`);
    }
    if (file !== undefined && typeof file !== 'string') {
      throw new Error(`The route table holds a route whose file is not a string:\n${json}`);
    }

    return {
      path,
      index: index === true,
      file,
      children: children === undefined ? [] : asRouteNodes(children, json),
    };
  });
}

// A root `path: ""` is a layout in all but name: it matches nothing by itself. A bare `/` does.
function collect(nodes: RouteNode[], parent: string, json: string): Route[] {
  return nodes.flatMap((node) => {
    const segment = (node.path ?? '').replace(/^\/+|\/+$/g, '');
    const own = segment === '' ? parent : `${parent}/${segment}`;
    const matches = node.index || (node.path !== undefined && node.path !== '');
    if (matches && node.file === undefined) {
      throw new Error(`The route table holds a matchable route with no module:\n${json}`);
    }
    return [
      ...(matches && node.file !== undefined ? [{ path: own || '/', file: node.file }] : []),
      ...collect(node.children, own, json),
    ];
  });
}
