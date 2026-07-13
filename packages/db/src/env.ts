/**
 * Parse a port from an environment variable value.
 *
 * Returns the fallback when the variable is unset or blank (an unset var and `DB_PORT=` should
 * behave the same). Anything else must be a valid port: `Number('')` is 0 and `Number('abc')` is
 * NaN, and letting either through surfaces later as a confusing connection error instead of a
 * clear config one.
 */
export function parsePort(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`Port must be an integer between 1 and 65535; received '${value}'`);
  }

  return port;
}
