import { TEAM_IDS } from './teams.ts';

export { JOB_ROLES, type JobRole, ROLES, type Role } from './roles.ts';
export { TEAM_IDS, TEAMS, type Team } from './teams.ts';

export type AppAudience = 'internal' | 'public';

/** The web app sets this cookie, and its server forwards it to the API under the same name. */
export function sessionCookieName(audience: AppAudience): string {
  return `fphd-${audience}-session`;
}

export interface FakeUser {
  readonly description: string;
  readonly id: string;
  readonly name: string;
  readonly roles: readonly string[];
  readonly teamIds: readonly string[];
}

export const fakeUsers: readonly FakeUser[] = Object.freeze([
  Object.freeze({
    description: 'Can use the public service only',
    id: 'public-user',
    name: 'Alex Morgan',
    roles: Object.freeze(['public']),
    teamIds: Object.freeze([]),
  }),
  Object.freeze({
    description: 'Can manage indicators in the internal service',
    id: 'internal-publisher',
    name: 'Sam Taylor',
    roles: Object.freeze(['public', 'internal', 'publisher']),
    teamIds: Object.freeze([TEAM_IDS.teamA]),
  }),
  Object.freeze({
    description: 'Can manage indicators and administer the internal service',
    id: 'internal-admin',
    name: 'Riley Singh',
    roles: Object.freeze(['public', 'internal', 'publisher', 'admin']),
    teamIds: Object.freeze([TEAM_IDS.teamA]),
  }),
]);

export function canAccessAudience(user: FakeUser, audience: AppAudience): boolean {
  return audience === 'public' || user.roles.includes('internal');
}

export function fakeUsersForAudience(audience: AppAudience): readonly FakeUser[] {
  return fakeUsers.filter((user) => canAccessAudience(user, audience));
}

export interface SessionAccess {
  readonly roles: readonly string[];
  readonly teams: readonly string[];
}

/** What a session for the audience grants: a public session holds no internal role or team. */
export function sessionAccessForAudience(user: FakeUser, audience: AppAudience): SessionAccess {
  return audience === 'public'
    ? Object.freeze({
        roles: Object.freeze(user.roles.filter((role) => role === 'public')),
        teams: Object.freeze([]),
      })
    : Object.freeze({ roles: user.roles, teams: user.teamIds });
}

export function findFakeUser(id: string): FakeUser | undefined {
  return fakeUsers.find((user) => user.id === id);
}

export function normalizeReturnTo(value: unknown, fallback = '/'): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return fallback;
  }

  const base = new URL('https://local.invalid');
  const target = new URL(value, base);

  // Dot segments can collapse a local path into a protocol-relative URL: '/..//evil.com'.
  if (target.origin !== base.origin || target.pathname.startsWith('//')) return fallback;

  return `${target.pathname}${target.search}${target.hash}`;
}
