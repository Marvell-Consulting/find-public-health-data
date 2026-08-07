import { describe, expect, it } from 'vitest';

import { rolesToBootstrap } from './db-commands.js';

describe('rolesToBootstrap', () => {
  it('pairs each fixed role name with its injected password', () => {
    expect(
      rolesToBootstrap({ publicApiPassword: 'public-pw', internalApiPassword: 'internal-pw' }),
    ).toEqual([
      { name: 'public_api', password: 'public-pw' },
      { name: 'internal_api', password: 'internal-pw' },
    ]);
  });

  it('names every missing password in one error', () => {
    expect(() =>
      rolesToBootstrap({ publicApiPassword: undefined, internalApiPassword: undefined }),
    ).toThrow(/PUBLIC_API_PASSWORD and INTERNAL_API_PASSWORD/);
  });

  it('refuses a half-configured pair rather than bootstrapping one role', () => {
    expect(() =>
      rolesToBootstrap({ publicApiPassword: 'public-pw', internalApiPassword: undefined }),
    ).toThrow(/INTERNAL_API_PASSWORD/);
  });
});
