import { describe, expect, it } from 'vitest';

import {
  canAccessAudience,
  fakeUsers,
  fakeUsersForAudience,
  findFakeUser,
  normalizeReturnTo,
  sessionAccessForAudience,
  TEAM_IDS,
} from './index.ts';

describe('fake users', () => {
  it('keeps public-only users out of the internal audience', () => {
    const publicUser = findFakeUser('public-user');
    if (publicUser === undefined) throw new Error('Missing public fake user');

    expect(canAccessAudience(publicUser, 'public')).toBe(true);
    expect(canAccessAudience(publicUser, 'internal')).toBe(false);
    expect(fakeUsersForAudience('internal').map((user) => user.id)).toEqual([
      'internal-publisher',
      'internal-admin',
    ]);
    expect(fakeUsersForAudience('public')).toEqual(fakeUsers);
  });

  it('scopes public sessions to public roles and no teams', () => {
    const admin = findFakeUser('internal-admin');
    if (admin === undefined) throw new Error('Missing admin fake user');

    expect(sessionAccessForAudience(admin, 'public')).toEqual({ roles: ['public'], teams: [] });
    expect(sessionAccessForAudience(admin, 'internal')).toEqual({
      roles: ['public', 'internal', 'publisher', 'admin'],
      teams: [TEAM_IDS.teamA],
    });
  });

  it('keeps admin off the publisher user', () => {
    expect(findFakeUser('internal-publisher')?.roles).toEqual(['public', 'internal', 'publisher']);
  });
});

describe('normalizeReturnTo', () => {
  it('retains local paths, query strings and fragments', () => {
    expect(normalizeReturnTo('/manage?view=drafts#latest')).toBe('/manage?view=drafts#latest');
  });

  it.each([
    'https://example.com',
    '//example.com/path',
    '/..//example.com/path',
    '/.//example.com/path',
    '',
    undefined,
    null,
  ])('rejects an external or invalid target', (target) => {
    expect(normalizeReturnTo(target, '/fallback')).toBe('/fallback');
  });
});
