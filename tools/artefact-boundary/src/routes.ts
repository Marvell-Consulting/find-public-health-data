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
  return collectFiles(parsed);
}

function collectFiles(node: unknown): string[] {
  if (Array.isArray(node)) return node.flatMap(collectFiles);
  if (typeof node !== 'object' || node === null) return [];

  const { file, children } = node as { file?: unknown; children?: unknown };
  return [...(typeof file === 'string' ? [file] : []), ...collectFiles(children)];
}
