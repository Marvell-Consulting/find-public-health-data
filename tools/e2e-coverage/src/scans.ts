import ts from 'typescript';

const SCAN = 'expectNoAccessibilityViolations';

/** Whether the spec source holds a real call to the axe scan, not merely its name in a comment or string. */
export function callsScan(source: string): boolean {
  return hasCall(ts.createSourceFile('spec.ts', source, ts.ScriptTarget.Latest, true));
}

function hasCall(node: ts.Node): boolean {
  if (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === SCAN
  ) {
    return true;
  }
  return ts.forEachChild(node, (child) => hasCall(child) || undefined) === true;
}
