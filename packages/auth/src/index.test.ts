import { describe, expect, it } from 'vitest';

import {
  canAccessAudience,
  fakeUsers,
  fakeUsersForAudience,
  findFakeUser,
  normalizeReturnTo,
  sessionRolesForAudience,
} from './index.js';

describe('fake users', () => {
  it('keeps public-only users out of the internal audience', () => {
    const publicUser = findFakeUser('public-user');
    if (publicUser === undefined) throw new Error('Missing public fake user');

    expect(canAccessAudience(publicUser, 'public')).toBe(true);
    expect(canAccessAudience(publicUser, 'internal')).toBe(false);
    expect(fakeUsersForAudience('internal').map((user) => user.id)).toEqual([
      'internal-viewer',
      'internal-publisher',
    ]);
    expect(fakeUsersForAudience('public')).toEqual(fakeUsers);
  });

  it('scopes public sessions to public roles', () => {
    const publisher = findFakeUser('internal-publisher');
    if (publisher === undefined) throw new Error('Missing publisher fake user');

    expect(sessionRolesForAudience(publisher, 'public')).toEqual(['public']);
    expect(sessionRolesForAudience(publisher, 'internal')).toEqual([
      'public',
      'internal',
      'publisher',
    ]);
  });
});

describe('normalizeReturnTo', () => {
  it('retains local paths, query strings and fragments', () => {
    expect(normalizeReturnTo('/manage?view=drafts#latest')).toBe('/manage?view=drafts#latest');
  });

  it.each([
    'https://example.com',
    '//example.com/path',
    '',
    undefined,
    null,
  ])('rejects an external or invalid target', (target) => {
    expect(normalizeReturnTo(target, '/fallback')).toBe('/fallback');
  });
});
