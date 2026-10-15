export function normalizeReturnTo(value: unknown, fallback = '/'): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return fallback;
  }

  const base = new URL('https://local.invalid');
  const target = new URL(value, base);

  // Dot segments can collapse a local path into a protocol-relative URL: '/..//evil.com'.
  if (target.origin !== base.origin || target.pathname.startsWith('//')) return fallback;

  return `${target.pathname}${target.search}${target.hash}`;
}
