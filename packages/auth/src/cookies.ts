/**
 * Its own module, with no Node imports, so a package that only needs to read a cookie does
 * not pull `jwt-session` — and `node:crypto` with it — into its module graph.
 */
export function readCookie(
  cookieHeader: string | null | undefined,
  cookieName: string,
): string | undefined {
  if (cookieHeader === null || cookieHeader === undefined) return undefined;

  for (const entry of cookieHeader.split(';')) {
    const separator = entry.indexOf('=');
    if (separator === -1) continue;

    const name = entry.slice(0, separator).trim();
    if (name === cookieName) return entry.slice(separator + 1).trim();
  }

  return undefined;
}
