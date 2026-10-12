/** A query string as Express parses it: a repeated key becomes an array, so a schema refuses it. */
export function queryObject(searchParams: URLSearchParams): Record<string, string | string[]> {
  return Object.fromEntries(
    [...new Set(searchParams.keys())].map((key) => {
      const values = searchParams.getAll(key);
      return [key, values.length === 1 ? (values[0] ?? '') : values];
    }),
  );
}
