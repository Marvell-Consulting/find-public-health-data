import { describe, expect, it } from 'vitest';

import { isPageModule } from './modules.js';

describe('isPageModule', () => {
  it.each([
    'export default function Page() {}',
    'export default class Page {}',
    'const Page = () => null;\nexport default Page;',
    'export { Page as default };',
    "export { default } from './page.js';",
    "export { default, loader } from './page.js';",
    'export default function Page() {\n  return <h1>Page</h1>;\n}',
  ])('treats a module with a default export as a page: %s', (source) => {
    expect(isPageModule(source)).toBe(true);
  });

  it.each([
    "export function loader() { return redirect('/dashboard'); }",
    'export async function loader() { return Response.json([]); }',
    'export const action = () => null;',
    "export { loader } from './data.js';",
    "export * from './data.js';",
    '// export default function Page() {}\nexport function loader() {}',
    "const note = 'export default';\nexport function loader() {}",
  ])('treats a module with no default export as a resource route: %s', (source) => {
    expect(isPageModule(source)).toBe(false);
  });
});
