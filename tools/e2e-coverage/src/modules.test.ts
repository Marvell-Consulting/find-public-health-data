import { describe, expect, it } from 'vitest';

import { isPageModule } from './modules.ts';

describe('isPageModule', () => {
  it.each([
    'export default function Page() {}',
    'export default class Page {}',
    'const Page = () => null;\nexport default Page;',
    'export { Page as default };',
    "export { default } from './page.tsx';",
    "export { default, loader } from './page.tsx';",
    'export default function Page() {\n  return <h1>Page</h1>;\n}',
  ])('treats a module with a default export as a page: %s', (source) => {
    expect(isPageModule(source)).toBe(true);
  });

  it.each([
    "export function loader() { return redirect('/dashboard'); }",
    'export async function loader() { return Response.json([]); }',
    'export const action = () => null;',
    "export { loader } from './data.ts';",
    "export * from './data.ts';",
    '// export default function Page() {}\nexport function loader() {}',
    "const note = 'export default';\nexport function loader() {}",
  ])('treats a module with no default export as a resource route: %s', (source) => {
    expect(isPageModule(source)).toBe(false);
  });
});
