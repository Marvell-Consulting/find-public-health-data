/** Kept free of Node imports so reading a cookie does not pull `jwt-session` into the graph. */
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
