import type postgres from 'postgres';

/**
 * Drop every application schema object — tables, views, sequences, routines, standalone
 * types — and the drizzle migration schema, so `db migrate` rebuilds from empty. Dropping
 * rather than truncating means it also recovers from a broken migration state, not just
 * bad data.
 *
 * Objects are dropped individually rather than via `DROP SCHEMA public CASCADE`:
 * recreating the schema would silently lose its grants and ownership. Extensions are left
 * in place (the extension migrations are `IF NOT EXISTS`), and roles are never touched —
 * `db bootstrap` owns those. Callers own the safety decision, via assertResetAllowed.
 */
export async function resetDatabase(sql: postgres.Sql): Promise<void> {
  await sql.begin(async (tx) => {
    // The migrator's watermark lives here; a table left behind would make it skip the
    // migrations that rebuild what was just dropped.
    await tx`DROP SCHEMA IF EXISTS drizzle CASCADE`;

    const views = await tx`SELECT viewname FROM pg_views WHERE schemaname = 'public'`;
    for (const { viewname } of views) {
      await tx`DROP VIEW IF EXISTS ${tx(viewname)} CASCADE`;
    }

    const matviews = await tx`SELECT matviewname FROM pg_matviews WHERE schemaname = 'public'`;
    for (const { matviewname } of matviews) {
      await tx`DROP MATERIALIZED VIEW IF EXISTS ${tx(matviewname)} CASCADE`;
    }

    const tables = await tx`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
    for (const { tablename } of tables) {
      await tx`DROP TABLE IF EXISTS ${tx(tablename)} CASCADE`;
    }

    const sequences = await tx`SELECT sequencename FROM pg_sequences WHERE schemaname = 'public'`;
    for (const { sequencename } of sequences) {
      await tx`DROP SEQUENCE IF EXISTS ${tx(sequencename)} CASCADE`;
    }

    // Functions, procedures and aggregates. The extensions install theirs into public
    // too, and dropping an extension member fails, so members (deptype 'e') are excluded.
    // regprocedure renders the schema-qualified, quoted signature the drop needs —
    // `proname` alone cannot name an overload — so this one goes through `unsafe`.
    const routines = await tx`
      SELECT p.oid::regprocedure::text AS signature
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND NOT EXISTS (
          SELECT 1 FROM pg_depend d
          WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e'
        )
    `;
    for (const { signature } of routines) {
      await tx.unsafe(`DROP ROUTINE IF EXISTS ${signature} CASCADE`);
    }

    // Enum, domain, range and standalone composite types; each table's implicit row type
    // went with its table above, and a range's multirange goes with its range. Extension
    // members are excluded, as with routines.
    const types = await tx`
      SELECT t.typname
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      LEFT JOIN pg_class c ON c.oid = t.typrelid
      WHERE n.nspname = 'public'
        AND (t.typtype IN ('e', 'd', 'r') OR (t.typtype = 'c' AND c.relkind = 'c'))
        AND NOT EXISTS (
          SELECT 1 FROM pg_depend d
          WHERE d.classid = 'pg_type'::regclass AND d.objid = t.oid AND d.deptype = 'e'
        )
    `;
    for (const { typname } of types) {
      await tx`DROP TYPE IF EXISTS ${tx(typname)} CASCADE`;
    }
  });
}
