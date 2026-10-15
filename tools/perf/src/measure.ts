import postgres from 'postgres';

import type { Work } from './budget.ts';
import { createDataTableDraft } from './fixtures.ts';
import { ORIGINS, type Route } from './routes.ts';

export type Response = { status: number; bytes: number; ms: number };

// FAKE_USER_IDS in @fphd/auth: Sam Taylor, a publisher in Team A, and Riley Singh, the admin.
const FAKE_USERS = {
  publisher: '01a13c69-96ab-7598-9ce0-f84dbec3d5dd',
  admin: '01a13c69-96ac-700c-9c28-8a01ee1fdfa8',
};

/** The cookies each route is requested with: one session for the publisher, one for the admin. */
export type Sessions = Record<keyof typeof FAKE_USERS, string>;

export async function signIn(): Promise<Sessions> {
  return {
    publisher: await signInAs(FAKE_USERS.publisher),
    admin: await signInAs(FAKE_USERS.admin),
  };
}

/** Session cookies for one fake user. */
async function signInAs(userId: string): Promise<string> {
  const origin = ORIGINS['internal-web'];
  const started = await fetch(`${origin}/auth/sign-in`, {
    method: 'POST',
    body: new URLSearchParams({ userId }),
    redirect: 'manual',
  });
  const callback = started.headers.get('location');
  if (started.status !== 303 || callback === null) {
    throw new Error(`Sign-in answered ${started.status}, expected a 303 to the callback`);
  }
  const finished = await fetch(new URL(callback, origin), { redirect: 'manual' });
  const cookies = finished.headers.getSetCookie().map((cookie) => cookie.split(';')[0]);
  if (finished.status !== 303 || cookies.length === 0) {
    throw new Error(
      `The sign-in callback answered ${finished.status}, expected a 303 setting a session`,
    );
  }
  return cookies.join('; ');
}

/** One request, body read in full; redirects are not followed, so each is measured as itself. */
export async function request(route: Route, sessions: Sessions): Promise<Response> {
  const internal = route.app === 'internal-web' || route.app === 'internal-api';
  const session = sessions[route.as ?? 'publisher'];
  const started = performance.now();
  const response = await fetch(`${ORIGINS[route.app]}${route.path}`, {
    headers: internal ? { cookie: session } : {},
    redirect: 'manual',
  });
  const body = await response.arrayBuffer();
  return { status: response.status, bytes: body.byteLength, ms: performance.now() - started };
}

/** Reads pg_stat_statements as the database owner; the APIs' own roles are what it counts. */
export function connect(): postgres.Sql {
  const password = process.env.POSTGRES_PASSWORD;
  if (!password) throw new Error('POSTGRES_PASSWORD is not set');
  return postgres({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    database: process.env.POSTGRES_DB ?? 'fphd',
    username: process.env.POSTGRES_USER ?? 'fphd',
    password,
    max: 1,
    onnotice: () => {},
  });
}

/**
 * Fresh planner statistics and a vacuumed seed, so plans do not shift under an autovacuum mid-run
 * (CI turns it off); then the data the seed lacks, analysed but not vacuumed, as a batch stands
 * just after its upload; and the statistics extension, which needs `shared_preload_libraries`
 * (compose.perf.yaml).
 */
export async function prepare(sql: postgres.Sql): Promise<void> {
  await sql`vacuum analyze`.simple();
  await createDataTableDraft(sql);
  await sql`analyze indicator, indicator_version, upload_batch, observation, observation_dimension`;
  await sql`create extension if not exists pg_stat_statements`;
}

/** The database work and response size of one request to the route. */
export async function measureWork(
  sql: postgres.Sql,
  route: Route,
  sessions: Sessions,
): Promise<Work> {
  await sql`select pg_stat_statements_reset()`;
  const response = await request(route, sessions);
  if (response.status !== 200) {
    throw new Error(`${route.app} ${route.path} answered ${response.status}`);
  }
  // Only the API login roles: this connection's own statements are the owner's and never count.
  const [counts] = await sql<Omit<Work, 'bytes'>[]>`
    select
      coalesce(sum(s.calls), 0)::int as statements,
      coalesce(sum(s.shared_blks_hit + s.shared_blks_read), 0)::int as buffers,
      coalesce(sum(s.rows), 0)::int as rows
    from pg_stat_statements s
    join pg_roles r on r.oid = s.userid
    where r.rolname in ('public_api', 'internal_api')
  `;
  if (counts === undefined) throw new Error('pg_stat_statements returned no row');
  return { ...counts, bytes: response.bytes };
}
