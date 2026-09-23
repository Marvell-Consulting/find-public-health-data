// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { handle } from './route.tsx';

describe('the indicator overview route', () => {
  it('links back to the dashboard from above the page', () => {
    expect(handle.backHref).toBe('/dashboard');
  });
});
