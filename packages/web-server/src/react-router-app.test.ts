import { describe, expect, it } from 'vitest';

import { createReactRouterApp } from './react-router-app.js';

describe('createReactRouterApp', () => {
  it('does not advertise Express via x-powered-by on document responses', () => {
    const app = createReactRouterApp(() => {
      throw new Error('build should not load while asserting app settings');
    });

    expect(app.disabled('x-powered-by')).toBe(true);
  });
});
