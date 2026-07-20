const SPECIFIER =
  /(?:\bfrom\s*|\brequire\s*\(\s*|\bimport\s*\(\s*|^\s*import\s+)(['"])([^'"]+)\1/gm;

/** Every module specifier a compiled JavaScript file imports, static or dynamic. */
export function extractImportSpecifiers(source: string): string[] {
  return [...source.matchAll(SPECIFIER)].map((match) => match[2] ?? '');
}
