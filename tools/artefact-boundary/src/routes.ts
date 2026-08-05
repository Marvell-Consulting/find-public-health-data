type RouteNode = {
  file: string | undefined;
  children: RouteNode[];
};

/**
 * Every route module path in `react-router routes --json` output, including nested routes. The
 * paths are as written in `routes.ts`, so they are relative to the app's `appDirectory`.
 */
export function collectRouteFiles(json: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (cause) {
    throw new Error(`Could not parse the route table as JSON:\n${json}`, { cause });
  }
  return collectFiles(asRouteNodes(parsed, json));
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

    const { file, children } = entry as { file?: unknown; children?: unknown };
    if (file !== undefined && typeof file !== 'string') {
      throw new Error(`The route table holds a route whose file is not a string:\n${json}`);
    }

    return { file, children: children === undefined ? [] : asRouteNodes(children, json) };
  });
}

function collectFiles(nodes: RouteNode[]): string[] {
  return nodes.flatMap((node) => [
    ...(node.file === undefined ? [] : [node.file]),
    ...collectFiles(node.children),
  ]);
}
