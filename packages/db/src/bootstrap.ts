import type postgres from 'postgres';

export interface DatabaseRole {
  name: string;
  password: string;
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
