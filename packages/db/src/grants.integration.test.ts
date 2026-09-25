import { randomBytes } from 'node:crypto';

import { appEnvFields, parseEnv, z } from '@fphd/config';
import type postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { API_ROLES } from './bootstrap.ts';
import { createPostgresClient } from './client.ts';
import { dbEnvFields, resolveDbTls } from './env.ts';
import { createOwnerClient } from './scripts/owner-client.ts';
import { createTestDatabase, type TestDatabase } from './testing.ts';

const env = parseEnv(z.object({ ...dbEnvFields, ...appEnvFields }), process.env);

const TABLE_PRIVILEGES = [
  'SELECT',
  'INSERT',
  'UPDATE',
  'DELETE',
  'TRUNCATE',
  'REFERENCES',
  'TRIGGER',
];

// public_api's own name is never used here: login roles are cluster-wide, so bootstrapping
// it would rotate the password the rest of the suite connects with. A throwaway member of
// the role inherits exactly the grants under test.
const memberRole = `fphd_grants_test_${randomBytes(6).toString('hex')}`;
const memberPassword = 'grants-test';

let testDb: TestDatabase;
let owner: ReturnType<typeof createOwnerClient>;
let member: postgres.Sql;
let draftIndicatorId: string;
let draftObservationId: string;

/** An indicator whose only version is a draft, with data and read-model rows behind it. */
async function insertDraftOnlyIndicator(): Promise<void> {
  const [indicator] = await owner<{ id: string }[]>`
    INSERT INTO indicator (short_id) VALUES (999997) RETURNING id
  `;
  draftIndicatorId = indicator?.id ?? '';

  const [version] = await owner<{ id: string }[]>`
    INSERT INTO indicator_version
      (indicator_id, status, name, slug, value_type_id, unit_id, year_type_id, polarity,
       update_frequency, definition, created_by, updated_by)
    SELECT ${draftIndicatorId}, 'draft', 'grants-test draft indicator',
           'grants-test-draft-indicator',
           vt.id, u.id, yt.id, 'lower-is-better', 'annually', 'a draft definition',
           'grants-test', 'grants-test'
    FROM value_type vt, unit u, year_type yt
    LIMIT 1
    RETURNING id
  `;
  const versionId = version?.id ?? '';

  await owner`
    INSERT INTO indicator_topic (topic_id, indicator_version_id)
    SELECT t.id, ${versionId} FROM topic t LIMIT 1
  `;
  await owner`
    INSERT INTO indicator_classification (indicator_version_id, classification_id)
    SELECT ${versionId}, c.id FROM classification c LIMIT 1
  `;

  const [batch] = await owner<{ id: string }[]>`
    INSERT INTO upload_batch (indicator_id, original_filename, uploaded_by)
    VALUES (${draftIndicatorId}, 'grants-test.csv', 'grants-test')
    RETURNING id
  `;
  const [observation] = await owner<{ id: string }[]>`
    INSERT INTO observation
      (indicator_id, area_id, from_date, to_date, value, published_at, upload_batch_id, created_by)
    SELECT ${draftIndicatorId}, a.id, '2024-01-01', '2024-12-31', 1.5, now(), ${batch?.id ?? ''},
           'grants-test'
    FROM area a LIMIT 1
    RETURNING id
  `;
  draftObservationId = observation?.id ?? '';

  await owner`
    INSERT INTO observation_dimension (observation_id, dimension_value_id, dimension_type_id)
    SELECT ${draftObservationId}, dv.id, dv.dimension_type_id FROM dimension_value dv LIMIT 1
  `;
  await owner`
    INSERT INTO observation_note (observation_id, note_type_id)
    SELECT ${draftObservationId}, nt.id FROM note_type nt LIMIT 1
  `;

  await owner`
    INSERT INTO latest_headline (indicator_id, area_id, from_date, to_date, value)
    SELECT ${draftIndicatorId}, a.id, '2024-01-01', '2024-12-31', 1.5 FROM area a LIMIT 1
  `;
  await owner`
    INSERT INTO available_data (indicator_id, area_type_id, area_type_name, area_count)
    SELECT ${draftIndicatorId}, at.id, at.name, 1 FROM area_type at LIMIT 1
  `;
  await owner`
    INSERT INTO indicator_dimension_values
      (indicator_id, dimension_type_id, dimension_type_name, dimension_value_id,
       dimension_value_name)
    SELECT ${draftIndicatorId}, dt.id, dt.name, dv.id, dv.name
    FROM dimension_value dv JOIN dimension_type dt ON dt.id = dv.dimension_type_id
    LIMIT 1
  `;
  await owner`
    INSERT INTO observation_range
      (indicator_id, display_group, from_date, to_date, segment, min, max)
    VALUES (${draftIndicatorId}, 'Local authorities', '2024-01-01', '2024-12-31', '', 1.5, 1.5)
  `;
}

beforeAll(async () => {
  testDb = await createTestDatabase({ template: 'seeded' });
  owner = createOwnerClient(testDb.name);
  await owner.unsafe(
    `CREATE ROLE "${memberRole}" LOGIN PASSWORD '${memberPassword}' IN ROLE "${API_ROLES.publicApi}"`,
  );
  await insertDraftOnlyIndicator();
  member = createPostgresClient(
    {
      host: env.DB_HOST,
      port: env.DB_PORT,
      database: testDb.name,
      user: memberRole,
      password: memberPassword,
      ssl: resolveDbTls(env.APP_ENV, env.DB_TLS),
    },
    { max: 1, onnotice: () => {} },
  );
});

afterAll(async () => {
  await member?.end();
  await owner.unsafe(`DROP ROLE IF EXISTS "${memberRole}"`);
  await owner.end();
  await testDb.drop();
});

// What the public API reads about an indicator; a change here changes its responses.
const PUBLISHED_INDICATOR_COLUMNS = [
  'indicator.id uuid',
  'indicator.short_id integer',
  'indicator.data_updated_at timestamp with time zone',
  'indicator.created_at timestamp with time zone',
  'indicator.name text',
  'indicator.slug text',
  'indicator.value_type_id uuid',
  'indicator.unit_id uuid',
  'indicator.year_type_id uuid',
  'indicator.ci_method_id uuid',
  'indicator.polarity text',
  'indicator.update_frequency text',
  'indicator.comparator_method_id uuid',
  'indicator.disclosure_threshold smallint',
  'indicator.ci_confidence_level text',
  'indicator.config jsonb',
  'indicator.definition text',
  'indicator.rationale text',
  'indicator.methodology text',
  'indicator.numerator_definition text',
  'indicator.denominator_definition text',
  'indicator.disclosure_control text',
  'indicator.caveats text',
  'indicator.notes text',
  'indicator.data_source_id uuid',
  'indicator.numerator_source_id uuid',
  'indicator.denominator_source_id uuid',
  'indicator.updated_at timestamp with time zone',
  'indicator.first_published_at timestamp with time zone',
  'indicator.last_published_at timestamp with time zone',
  'indicator_classification.indicator_id uuid',
  'indicator_classification.classification_id uuid',
  'indicator_topic.indicator_id uuid',
  'indicator_topic.topic_id uuid',
];

describe('the public role', () => {
  it('holds no privilege on any relation in the public schema', async () => {
    const held = await owner<{ relname: string; priv: string }[]>`
      SELECT c.relname, p.priv
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      CROSS JOIN unnest(${owner.array(TABLE_PRIVILEGES)}::text[]) AS p(priv)
      WHERE n.nspname = 'public'
        AND c.relkind IN ('r', 'v', 'm', 'p', 'f')
        AND has_table_privilege(${memberRole}, c.oid, p.priv)
      ORDER BY c.relname, p.priv
    `;

    expect(held).toEqual([]);
  });

  it('may select every view in the published schema and nothing more', async () => {
    const [usage] = await owner<{ granted: boolean }[]>`
      SELECT has_schema_privilege(${memberRole}, 'published', 'USAGE') AS granted
    `;
    expect(usage?.granted).toBe(true);

    const views = await owner<{ relname: string; readable: boolean; writable: boolean }[]>`
      SELECT
        c.relname,
        has_table_privilege(${memberRole}, c.oid, 'SELECT') AS readable,
        has_table_privilege(${memberRole}, c.oid, 'INSERT') AS writable
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'published' AND c.relkind = 'v'
    `;

    expect(views.length).toBeGreaterThan(0);
    expect(views.filter(({ readable }) => !readable)).toEqual([]);
    expect(views.filter(({ writable }) => writable)).toEqual([]);
  });

  // The catalogue check above could miss a privilege arriving some other way; a real read
  // cannot.
  it.each(['indicator', 'indicator_version', 'current_published_version', 'observation'])(
    'is refused a direct read of %s',
    async (relation) => {
      await expect(member.unsafe(`SELECT 1 FROM public.${relation} LIMIT 1`)).rejects.toMatchObject(
        {
          code: '42501',
        },
      );
    },
  );

  it('reads the same columns of each indicator view as it always has', async () => {
    const columns = await member<{ table_name: string; column_name: string; data_type: string }[]>`
      SELECT table_name, column_name, data_type FROM information_schema.columns
      WHERE table_schema = 'published'
        AND table_name IN ('indicator', 'indicator_topic', 'indicator_classification')
      ORDER BY table_name, ordinal_position
    `;

    expect(columns.map((c) => `${c.table_name}.${c.column_name} ${c.data_type}`)).toEqual(
      PUBLISHED_INDICATOR_COLUMNS,
    );
  });

  it('sees no upload batch, which is internal detail', async () => {
    const columns = await member<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.columns
      WHERE table_schema = 'published' AND column_name = 'upload_batch_id'
    `;

    expect(columns).toEqual([]);
  });
});

describe('the internal role', () => {
  // A view that is dropped and recreated loses its grants, so these are checked by name.
  it.each([
    'public.current_published_version',
    'published.indicator',
    'published.indicator_topic',
    'published.indicator_classification',
  ])('may select %s', async (relation) => {
    const [row] = await owner<{ readable: boolean }[]>`
      SELECT has_table_privilege(${API_ROLES.internalApi}, ${relation}, 'SELECT') AS readable
    `;

    expect(row?.readable).toBe(true);
  });
});

describe('an indicator whose only version is a draft', () => {
  it('is invisible through every view the public role reads', async () => {
    const counts = await member<{ view: string; rows: number }[]>`
      SELECT 'indicator' AS view, count(*)::int AS rows
        FROM published.indicator WHERE id = ${draftIndicatorId}
      UNION ALL SELECT 'indicator_topic', count(*)::int
        FROM published.indicator_topic WHERE indicator_id = ${draftIndicatorId}
      UNION ALL SELECT 'indicator_classification', count(*)::int
        FROM published.indicator_classification WHERE indicator_id = ${draftIndicatorId}
      UNION ALL SELECT 'indicator_slug', count(*)::int
        FROM published.indicator_slug
        WHERE indicator_id = ${draftIndicatorId} OR slug = 'grants-test-draft-indicator'
      UNION ALL SELECT 'observation', count(*)::int
        FROM published.observation WHERE indicator_id = ${draftIndicatorId}
      UNION ALL SELECT 'observation_dimension', count(*)::int
        FROM published.observation_dimension WHERE observation_id = ${draftObservationId}
      UNION ALL SELECT 'observation_note', count(*)::int
        FROM published.observation_note WHERE observation_id = ${draftObservationId}
      UNION ALL SELECT 'latest_headline', count(*)::int
        FROM published.latest_headline WHERE indicator_id = ${draftIndicatorId}
      UNION ALL SELECT 'available_data', count(*)::int
        FROM published.available_data WHERE indicator_id = ${draftIndicatorId}
      UNION ALL SELECT 'indicator_dimension_values', count(*)::int
        FROM published.indicator_dimension_values WHERE indicator_id = ${draftIndicatorId}
      UNION ALL SELECT 'observation_range', count(*)::int
        FROM published.observation_range WHERE indicator_id = ${draftIndicatorId}
    `;

    expect(counts.filter(({ rows }) => rows > 0)).toEqual([]);
    expect(counts).toHaveLength(11);
  });

  it('does not stop the seeded published indicators being served', async () => {
    const [seeded] = await member<{ rows: number }[]>`
      SELECT count(*)::int AS rows FROM published.indicator
    `;

    expect(seeded?.rows).toBe(12);
  });
});
