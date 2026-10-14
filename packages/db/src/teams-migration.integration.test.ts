import { TEAMS } from '@fphd/auth';
import type postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { DEFAULT_INDICATOR_TEAM_ID } from './schema/index.ts';
import { createOwnerClient } from './scripts/owner-client.ts';
import { createTestDatabase, migrateThrough, type TestDatabase } from './testing.ts';

const MIGRATION = '0045_teams';

describe(`migration ${MIGRATION}`, () => {
  let testDb: TestDatabase;
  let sql: postgres.Sql;

  beforeAll(async () => {
    testDb = await createTestDatabase({ template: 'unmigrated' });
    sql = createOwnerClient(testDb.name);
    await migrateThrough(sql, MIGRATION);
  });

  afterAll(async () => {
    await sql?.end();
    await testDb?.drop();
  });

  it('inserts the teams @fphd/auth names, with their ids', async () => {
    const rows = await sql<{ id: string; name: string }[]>`SELECT id, name FROM team ORDER BY name`;

    expect(rows).toEqual(TEAMS.map(({ id, name }) => ({ id, name })));
  });

  it('inserts the default team, which is Team A', async () => {
    const [row] = await sql<{ name: string }[]>`
      SELECT name FROM team WHERE id = ${DEFAULT_INDICATOR_TEAM_ID}
    `;

    expect(row?.name).toBe('Team A');
  });
});
