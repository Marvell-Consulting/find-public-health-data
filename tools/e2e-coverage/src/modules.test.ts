import { describe, expect, it } from 'vitest';

import { isPageModule } from './modules.js';

describe('isPageModule', () => {
  it.each([
    'export default function Page() {}',
    'const Page = () => null;\nexport default Page;',
    'export { Page as default };',
  ])('treats a module with a default export as a page: %s', (source) => {
    expect(isPageModule(source)).toBe(true);
  });

  it.each([
    "export function loader() { return redirect('/dashboard'); }",
    'export async function loader() { return Response.json([]); }',
    'export const action = () => null;',
  ])('treats a module with no default export as a resource route: %s', (source) => {
    expect(isPageModule(source)).toBe(false);
  });
});
