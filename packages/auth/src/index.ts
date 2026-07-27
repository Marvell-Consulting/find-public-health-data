export type AppAudience = 'internal' | 'public';

export interface FakeUser {
  readonly description: string;
  readonly id: string;
  readonly name: string;
  readonly roles: readonly string[];
}

export const fakeUsers: readonly FakeUser[] = Object.freeze([
  Object.freeze({
    description: 'Can use the public service only',
    id: 'public-user',
    name: 'Alex Morgan',
    roles: Object.freeze(['public']),
  }),
  Object.freeze({
    description: 'Can view the internal service',
    id: 'internal-viewer',
    name: 'Sam Taylor',
    roles: Object.freeze(['public', 'internal']),
  }),
  Object.freeze({
    description: 'Can manage data in the internal service',
    id: 'internal-publisher',
    name: 'Riley Singh',
    roles: Object.freeze(['public', 'internal', 'publisher']),
  }),
]);

export function canAccessAudience(user: FakeUser, audience: AppAudience): boolean {
  return audience === 'public' || user.roles.includes('internal');
}

export function fakeUsersForAudience(audience: AppAudience): readonly FakeUser[] {
  return fakeUsers.filter((user) => canAccessAudience(user, audience));
}

export function sessionRolesForAudience(user: FakeUser, audience: AppAudience): readonly string[] {
  return audience === 'public'
    ? Object.freeze(user.roles.filter((role) => role === 'public'))
    : user.roles;
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

  if (target.origin !== base.origin) return fallback;

  return `${target.pathname}${target.search}${target.hash}`;
}
