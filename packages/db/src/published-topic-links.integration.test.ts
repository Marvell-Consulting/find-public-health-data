import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDbFromClient } from './client.ts';
import { applyIndicatorTopics, parseIndicatorTopicFile } from './indicator-topic-repository.ts';
import { createOwnerClient } from './scripts/owner-client.ts';
import { createTestDatabase, type TestDatabase } from './testing.ts';

let database: TestDatabase;
let sql: ReturnType<typeof createOwnerClient>;

beforeAll(async () => {
  database = await createTestDatabase({ template: 'seeded' });
  sql = createOwnerClient(database.name);
});

afterAll(async () => {
  await sql.end();
  await database.drop();
});

describe('published demo topic links', () => {
  it('applies public-profile memberships to imported Fingertips indicators', async () => {
    const path = fileURLToPath(new URL('../data/published-indicator-topics.json', import.meta.url));
    const file = parseIndicatorTopicFile(JSON.parse(readFileSync(path, 'utf-8')));
    const summary = await applyIndicatorTopics(createDbFromClient(sql), file);
    const [row] = await sql<
      { count: number }[]
    >`SELECT count(*)::int AS count FROM indicator_topic`;

    expect(summary.unknownTopics).toEqual([]);
    expect(summary.links).toBeGreaterThanOrEqual(22);
    expect(row?.count).toBe(summary.links);
  });
});
