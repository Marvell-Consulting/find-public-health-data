type RouteNode = {
  path: string | undefined;
  index: boolean;
  children: RouteNode[];
};

/**
 * Every URL pattern in `react-router routes --json` output that a request can match: pathful
 * routes and index routes, at any depth, with their parents' paths prefixed. A pathless layout
 * contributes nothing of its own but its children are still walked.
 */
export function collectRoutePaths(json: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (cause) {
    throw new Error(`Could not parse the route table as JSON:\n${json}`, { cause });
  }
  return collectPaths(asRouteNodes(parsed, json), '');
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
    if (typeof entry !== 'object' || entry === null) {
      throw new Error(`The route table holds a route that is not an object:\n${json}`);
    }

    const { path, index, children } = entry as {
      path?: unknown;
      index?: unknown;
      children?: unknown;
    };
    if (path !== undefined && typeof path !== 'string') {
      throw new Error(`The route table holds a route whose path is not a string:\n${json}`);
    }
    if (index !== undefined && typeof index !== 'boolean') {
      throw new Error(`The route table holds a route whose index flag is not a boolean:\n${json}`);
    }

    return {
      path,
      index: index === true,
      children: children === undefined ? [] : asRouteNodes(children, json),
    };
  });
}

// A root `path: ""` is a layout in all but name: it matches nothing by itself.
function collectPaths(nodes: RouteNode[], parent: string): string[] {
  return nodes.flatMap((node) => {
    const segment = (node.path ?? '').replace(/^\/+|\/+$/g, '');
    const own = segment === '' ? parent : `${parent}/${segment}`;
    const matches = node.index || segment !== '';
    return [...(matches ? [own || '/'] : []), ...collectPaths(node.children, own)];
  });
}
