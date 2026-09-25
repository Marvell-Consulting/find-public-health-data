import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createDbFromClient } from '@fphd/db';
import { createOwnerClient, createTestDatabase, type TestDatabase } from '@fphd/db/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { applyIndicatorTopics, parseIndicatorTopicFile } from './indicator-topic-import.ts';

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

describe('an indicator with only a draft', () => {
  it('takes its memberships and data timestamp on the draft', async () => {
    const [topic] = await sql<{ id: string }[]>`SELECT id FROM topic LIMIT 1`;
    const [identity] = await sql<{ id: string; short_id: number }[]>`
      INSERT INTO indicator DEFAULT VALUES RETURNING id, short_id
    `;
    const [draft] = await sql<{ version_id: string }[]>`
      INSERT INTO indicator_version (indicator_id, name, slug, created_by, updated_by)
      VALUES (${identity?.id ?? ''}, 'Draft only', 'draft-only', 'topic-test', 'topic-test')
      RETURNING id AS version_id
    `;
    if (!topic || !identity || !draft) throw new Error('the fixture was not written');

    const summary = await applyIndicatorTopics(
      createDbFromClient(sql),
      parseIndicatorTopicFile({
        indicatorTopics: [{ topicId: topic.id, fingertipsId: identity.short_id }],
        indicatorDataUpdatedAt: { [identity.short_id]: '2026-01-02T03:04:05' },
      }),
    );
    const links = await sql<{ topic_id: string }[]>`
      SELECT topic_id FROM indicator_topic WHERE indicator_version_id = ${draft.version_id}
    `;
    // postgres.js hands a timestamptz back as text here, not as a Date.
    const [updated] = await sql<{ data_updated_at: string | null }[]>`
      SELECT data_updated_at FROM indicator WHERE id = ${identity.id}
    `;

    expect(summary).toMatchObject({ links: 1, timestamps: 1, unknownIndicators: [] });
    expect(links.map(({ topic_id }) => topic_id)).toEqual([topic.id]);
    expect(new Date(updated?.data_updated_at ?? '').toISOString()).toBe('2026-01-02T03:04:05.000Z');
  });
});
