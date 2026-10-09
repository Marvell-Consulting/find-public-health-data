/** JavaScript's `\s`, written out so the seed export and the migration can match it exactly. */
const WHITESPACE = /[\t\n\v\f\r \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+/g;

/** A name as uploaded data is matched to reference data: trimmed, each run of whitespace one space. */
export function tidyName(name: string): string {
  return name.replace(WHITESPACE, ' ').replace(/^ | $/g, '');
}
