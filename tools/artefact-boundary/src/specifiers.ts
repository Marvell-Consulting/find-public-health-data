/**
 * The side-effect form assumes neither whitespace after `import` nor a line of its own: compacted
 * output writes `import"a";import"b";`, and a specifier this misses is a reference that ships
 * unreported.
 */
const SPECIFIER = /(?:\bfrom\s*|\brequire\s*\(\s*|\bimport\s*\(?\s*)(['"])([^'"]+)\1/g;

/** Every module specifier a compiled JavaScript file imports, static or dynamic. */
export function extractImportSpecifiers(source: string): string[] {
  return [...source.matchAll(SPECIFIER)].map((match) => match[2] ?? '');
}
