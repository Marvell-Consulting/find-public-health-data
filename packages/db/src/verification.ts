import type postgres from 'postgres';

import { API_ROLES, SCHEMA_OWNER_ROLE } from './bootstrap.js';

export interface VerificationFinding {
  check: string;
  detail: string;
  subjects: string[];
}

const WRITE_PRIVILEGES = ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'] as const;

/**
 * Asserts the invariants a restore, a clone or a hand-run statement can quietly break, and
 * only those that hold regardless of which tables exist: naming a table list here would be a
 * second copy of the grant migrations, drifting the moment one is added.
 *
 * Ownership and the group's own privileges are checked because a logical dump carries
 * neither roles nor database-level grants — a restored database can look complete and still
 * be unable to migrate. Of the API roles, only `public_api` is checked for write privileges:
 * that it holds none is the property the public/internal split rests on, and it stays true
 * however the schema grows. `internal_api` writes, so there is nothing durable to assert.
 */
export async function verifyDatabase(sql: postgres.Sql): Promise<VerificationFinding[]> {
  const findings: VerificationFinding[] = [];

  const misowned = await sql<{ name: string; owner: string }[]>`
    SELECT c.oid::regclass::text AS name, pg_get_userbyid(c.relowner) AS owner
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind IN ('r', 'p', 'v', 'm', 'S')
      AND n.nspname NOT LIKE 'pg\\_%'
      AND n.nspname <> 'information_schema'
      AND pg_get_userbyid(c.relowner) <> ${SCHEMA_OWNER_ROLE}
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d
        WHERE d.classid = 'pg_class'::regclass AND d.objid = c.oid AND d.deptype = 'e'
      )
    ORDER BY 1
  `;
  if (misowned.length > 0) {
    findings.push({
      check: 'object-ownership',
      detail: `not owned by ${SCHEMA_OWNER_ROLE} — run db bootstrap`,
      subjects: misowned.map((row) => `${row.name} (${row.owner})`),
    });
  }

  const [privileges] = await sql<{ database: boolean; schema: boolean }[]>`
    SELECT
      has_database_privilege(${SCHEMA_OWNER_ROLE}, current_database(), 'CREATE') AS database,
      has_schema_privilege(${SCHEMA_OWNER_ROLE}, 'public', 'CREATE')
        AND has_schema_privilege(${SCHEMA_OWNER_ROLE}, 'public', 'USAGE') AS schema
  `;
  if (privileges?.database !== true) {
    findings.push({
      check: 'owner-database-privilege',
      // The one a dump never carries, and the one that stops the next migration dead.
      detail: `${SCHEMA_OWNER_ROLE} cannot CREATE in this database — run db bootstrap`,
      subjects: [],
    });
  }
  if (privileges?.schema !== true) {
    findings.push({
      check: 'owner-schema-privilege',
      detail: `${SCHEMA_OWNER_ROLE} lacks CREATE or USAGE on schema public — run db bootstrap`,
      subjects: [],
    });
  }

  const apiRoles = Object.values(API_ROLES);
  const present = await sql<{ rolname: string }[]>`
    SELECT rolname FROM pg_roles WHERE rolname = ANY(${sql.array([...apiRoles])})
  `;
  const missing = apiRoles.filter((role) => !present.some((row) => row.rolname === role));
  if (missing.length > 0) {
    findings.push({
      check: 'api-roles-present',
      detail: 'login role absent — run db bootstrap',
      subjects: [...missing],
    });
  }

  // Only the public role. internal_api writes — it serves the publisher interface — so what
  // is checkable about it is that it owns nothing, which object-ownership already covers.
  if (!missing.includes(API_ROLES.publicApi)) {
    const writable = await sql<{ name: string; privilege: string }[]>`
      SELECT c.oid::regclass::text AS name, privilege.name AS privilege
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      CROSS JOIN unnest(${sql.array([...WRITE_PRIVILEGES])}::text[]) AS privilege(name)
      WHERE c.relkind IN ('r', 'p')
        AND n.nspname = 'public'
        AND has_table_privilege(${API_ROLES.publicApi}, c.oid, privilege.name)
      ORDER BY 1, 2
    `;
    if (writable.length > 0) {
      findings.push({
        check: 'public-api-read-only',
        detail: `${API_ROLES.publicApi} can write, and the public surface is reads only`,
        subjects: writable.map((row) => `${row.privilege} on ${row.name}`),
      });
    }
  }

  const worldReadable = await sql<{ name: string }[]>`
    SELECT c.oid::regclass::text AS name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind IN ('r', 'p', 'v', 'm')
      AND n.nspname = 'public'
      AND EXISTS (SELECT 1 FROM aclexplode(c.relacl) acl WHERE acl.grantee = 0)
    ORDER BY 1
  `;
  if (worldReadable.length > 0) {
    findings.push({
      check: 'no-public-grants',
      detail: 'granted to PUBLIC, so every role reaches it regardless of its own grants',
      subjects: worldReadable.map((row) => row.name),
    });
  }

  return findings;
}

export function assertVerified(findings: readonly VerificationFinding[]): void {
  if (findings.length === 0) {
    return;
  }

  const detail = findings.map((finding) => `${finding.check}: ${finding.detail}`).join('; ');
  throw new Error(`Database verification failed — ${detail}`);
}
