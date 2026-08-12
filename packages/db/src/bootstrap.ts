import type postgres from 'postgres';

export interface DatabaseRole {
  name: string;
  password: string;
}

/**
 * Owns every migrated object. A group, with no login of its own: the identity that runs DDL
 * joins it rather than owning what it creates, so that identity can be replaced — a managed
 * identity in place of a password login, say — without leaving the schema split between two
 * owners, one per era.
 */
export const SCHEMA_OWNER_ROLE = 'fphd_owner';

/**
 * Fixed, because the deployed configuration injects passwords for these names and nothing
 * else. Named here rather than in the app so the grant migrations, the bootstrap and the
 * verification cannot disagree about them.
 */
export const API_ROLES = {
  publicApi: 'public_api',
  internalApi: 'internal_api',
} as const;

/**
 * Creates that group in the current database and hands the connected login membership of it,
 * along with the privileges it needs to run migrations: CREATE on the database for extensions
 * and the `drizzle` schema, CREATE on `public` for the tables. Both are per-database, so this
 * runs once per database rather than once per server.
 *
 * It also reassigns anything the current login already owns, which is what lets it be run
 * against a database migrated before this existed and reach the same state as a fresh one.
 * Objects that depend on another are skipped: an extension's are the extension's, and a
 * sequence linked to a table follows that table's owner and cannot be altered on its own.
 */
export async function bootstrapOwnerRole(sql: postgres.Sql): Promise<void> {
  await sql.begin(async (tx) => {
    await tx`SELECT set_config('fphd.owner_role', ${SCHEMA_OWNER_ROLE}, true)`;
    await tx.unsafe(`
      DO $$
      DECLARE
        owner_role text := current_setting('fphd.owner_role');
        login_role text := current_user;
        target record;
      BEGIN
        BEGIN
          EXECUTE format('CREATE ROLE %I NOLOGIN', owner_role);
        EXCEPTION WHEN duplicate_object THEN
          NULL;
        END;

        EXECUTE format('GRANT %I TO %I', owner_role, login_role);
        EXECUTE format('GRANT CREATE ON DATABASE %I TO %I', current_database(), owner_role);
        EXECUTE format('GRANT CREATE, USAGE ON SCHEMA public TO %I', owner_role);

        FOR target IN
          SELECT nspname FROM pg_namespace
          WHERE nspowner = login_role::regrole
            AND nspname NOT LIKE 'pg\\_%'
            AND nspname <> 'information_schema'
        LOOP
          EXECUTE format('ALTER SCHEMA %I OWNER TO %I', target.nspname, owner_role);
        END LOOP;

        FOR target IN
          SELECT c.oid::regclass AS name, c.relkind FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE c.relowner = login_role::regrole
            AND c.relkind IN ('r', 'p', 'v', 'm', 'S')
            AND n.nspname NOT LIKE 'pg\\_%'
            AND n.nspname <> 'information_schema'
            AND NOT EXISTS (
              SELECT 1 FROM pg_depend d
              WHERE d.classid = 'pg_class'::regclass
                AND d.objid = c.oid
                AND d.deptype IN ('e', 'a', 'i')
            )
        LOOP
          EXECUTE format(
            'ALTER %s %s OWNER TO %I',
            CASE target.relkind
              WHEN 'S' THEN 'SEQUENCE'
              WHEN 'v' THEN 'VIEW'
              WHEN 'm' THEN 'MATERIALIZED VIEW'
              ELSE 'TABLE'
            END,
            target.name,
            owner_role
          );
        END LOOP;
      END $$;
    `);
  });
}

/**
 * The compose database gets its login roles from an initdb script, which a managed server
 * never runs. This is the equivalent for one: idempotent, so it can be run against a fresh
 * server or an existing one, and it sets the password every time so the same command also
 * rotates a credential.
 *
 * `CREATE ROLE` is attempted and its duplicate_object swallowed rather than guarded by a
 * `SELECT FROM pg_roles` first — roles are cluster-wide, so two jobs bootstrapping at once
 * would both pass such a check and one would then fail.
 *
 * The password reaches the server as a bind parameter and is quoted by Postgres itself
 * (`format('%L')`). Interpolating it into the statement text would break on a quote
 * character and would let the value inject SQL; it would also write the password into
 * anything logging statement text, which `current_setting` avoids.
 */
export async function bootstrapRoles(
  sql: postgres.Sql,
  roles: readonly DatabaseRole[],
): Promise<void> {
  for (const role of roles) {
    await sql.begin(async (tx) => {
      await tx`SELECT set_config('fphd.bootstrap_role', ${role.name}, true)`;
      await tx`SELECT set_config('fphd.bootstrap_password', ${role.password}, true)`;
      await tx.unsafe(`
        DO $$
        DECLARE
          role_name text := current_setting('fphd.bootstrap_role');
          role_password text := current_setting('fphd.bootstrap_password');
        BEGIN
          BEGIN
            EXECUTE format('CREATE ROLE %I LOGIN', role_name);
          EXCEPTION WHEN duplicate_object THEN
            NULL;
          END;
          EXECUTE format('ALTER ROLE %I WITH LOGIN PASSWORD %L', role_name, role_password);
        END $$;
      `);
    });
  }
}
