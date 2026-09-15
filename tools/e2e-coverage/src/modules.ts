import ts from 'typescript';

/**
 * React Router's own distinction: a route module with a default export renders a page; one
 * without is a resource route, answering with data or a redirect and never a page to scan.
 */
export function isPageModule(source: string): boolean {
  const file = ts.createSourceFile(
    'route.tsx',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  return file.statements.some(exportsDefault);
}

// `export default X`, `export default function/class`, `export { X as default }` and
// `export { default } from '…'` are all a default export.
function exportsDefault(statement: ts.Statement): boolean {
  if (ts.isExportAssignment(statement)) return !statement.isExportEquals;
  if (ts.isExportDeclaration(statement)) {
    const clause = statement.exportClause;
    return (
      clause !== undefined &&
      ts.isNamedExports(clause) &&
      clause.elements.some((element) => element.name.text === 'default')
    );
  }
  return (
    (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) &&
    (ts.getCombinedModifierFlags(statement) & ts.ModifierFlags.Default) !== 0
  );
}
