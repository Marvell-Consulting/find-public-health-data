import { appEnvFields, parseEnv, z } from '@fphd/config';
import { createDb, type Database, dbEnvFields, resolveDbTls, schema } from '@fphd/db';
import { createTestDatabase, type TestDatabase } from '@fphd/db/testing';
import { and, asc, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createIndicatorAliases,
  renamePendingIndicatorSlug,
} from './indicator-alias-repository.js';

const env = parseEnv(
  z.object({
    ...dbEnvFields,
    ...appEnvFields,
    POSTGRES_USER: z.string().default('fphd'),
    POSTGRES_PASSWORD: z.string().default('fphd'),
  }),
  process.env,
);

const { indicator, indicatorAlias } = schema;

let testDb: TestDatabase;
let db: Database;

// The seed carries the lookup rows an indicator references, which the schema template lacks.
beforeAll(async () => {
  testDb = await createTestDatabase({ template: 'seeded' });
  db = createDb({
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: testDb.name,
    user: env.POSTGRES_USER,
    password: env.POSTGRES_PASSWORD,
    ssl: resolveDbTls(env.APP_ENV, env.DB_TLS),
  });
});

afterAll(async () => {
  await db.$client.end();
  await testDb.drop();
});

/**
 * A draft with nothing but a name, as the first page of the publishing journey creates it.
 * The lookups it must reference are borrowed from a seeded indicator.
 */
async function createDraft(name: string): Promise<string> {
  const [lookups] = await db
    .select({
      valueTypeId: indicator.valueTypeId,
      unitId: indicator.unitId,
      yearTypeId: indicator.yearTypeId,
      polarityId: indicator.polarityId,
      frequencyId: indicator.frequencyId,
    })
    .from(indicator)
    .limit(1);

  if (lookups === undefined) throw new Error('the seed holds no indicator');

  const [created] = await db
    .insert(indicator)
    .values({
      ...lookups,
      name,
      status: 'draft',
      createdBy: 'integration-test',
      updatedBy: 'integration-test',
    })
    .returning({ id: indicator.id });

  if (created === undefined) throw new Error('no draft indicator was created');

  return created.id;
}

function aliasesOf(indicatorId: string) {
  return db
    .select({
      slug: indicatorAlias.slug,
      isPublished: indicatorAlias.isPublished,
      isCanonical: indicatorAlias.isCanonical,
    })
    .from(indicatorAlias)
    .where(eq(indicatorAlias.indicatorId, indicatorId))
    .orderBy(asc(indicatorAlias.slug));
}

describe('createIndicatorAliases', () => {
  it('gives a draft a number from the sequence and a pending slug, neither published', async () => {
    const indicatorId = await createDraft('Emergency admissions for asthma');

    const result = await createIndicatorAliases(db, indicatorId, 'Emergency admissions for asthma');

    expect(result).toEqual({ ok: true, slug: 'emergency-admissions-for-asthma' });
    const aliases = await aliasesOf(indicatorId);
    expect(aliases).toEqual([
      { slug: expect.stringMatching(/^\d+$/), isPublished: false, isCanonical: false },
      { slug: 'emergency-admissions-for-asthma', isPublished: false, isCanonical: false },
    ]);
    // High enough that a Fingertips number imported later can never collide with it.
    const number = Number(aliases.find(({ slug }) => /^\d+$/.test(slug))?.slug);
    expect(number).toBeGreaterThanOrEqual(1_000_000);
  });

  it('refuses a title another indicator has already reserved', async () => {
    const indicatorId = await createDraft('Smoking prevalence in adults');
    await createIndicatorAliases(db, indicatorId, 'Smoking prevalence in adults');
    const second = await createDraft('Smoking prevalence in adults');

    const result = await createIndicatorAliases(db, second, 'Smoking prevalence in adults');

    expect(result).toEqual({ ok: false, reason: 'slug_taken' });
    expect(await aliasesOf(second)).toEqual([]);
  });

  it('refuses a title with no slug in it rather than reserving an empty address', async () => {
    const indicatorId = await createDraft('???');

    expect(await createIndicatorAliases(db, indicatorId, '???')).toEqual({
      ok: false,
      reason: 'no_slug_in_title',
    });
  });
});

describe('renamePendingIndicatorSlug', () => {
  it('rewrites the pending slug in place rather than reserving a second one', async () => {
    const indicatorId = await createDraft('Under 75 mortality from asthma');
    await createIndicatorAliases(db, indicatorId, 'Under 75 mortality from asthma');

    const result = await renamePendingIndicatorSlug(
      db,
      indicatorId,
      'Under 75 mortality rate from asthma',
    );

    expect(result).toEqual({ ok: true, slug: 'under-75-mortality-rate-from-asthma' });
    expect((await aliasesOf(indicatorId)).map(({ slug }) => slug)).toContain(
      'under-75-mortality-rate-from-asthma',
    );
    expect((await aliasesOf(indicatorId)).filter(({ slug }) => !/^\d+$/.test(slug))).toHaveLength(
      1,
    );
  });

  it('leaves a published slug alone: it has been shared', async () => {
    const indicatorId = await createDraft('Reception prevalence of asthma');
    await createIndicatorAliases(db, indicatorId, 'Reception prevalence of asthma');
    await db
      .update(indicatorAlias)
      .set({ isPublished: true })
      .where(
        and(
          eq(indicatorAlias.indicatorId, indicatorId),
          eq(indicatorAlias.slug, 'reception-prevalence-of-asthma'),
        ),
      );

    const result = await renamePendingIndicatorSlug(db, indicatorId, 'Something else entirely');

    expect(result).toEqual({ ok: false, reason: 'not_found' });
    expect((await aliasesOf(indicatorId)).map(({ slug }) => slug)).toContain(
      'reception-prevalence-of-asthma',
    );
  });

  it('refuses a rename onto a slug another indicator holds', async () => {
    const indicatorId = await createDraft('Year 6 prevalence of asthma');
    await createIndicatorAliases(db, indicatorId, 'Year 6 prevalence of asthma');

    const result = await renamePendingIndicatorSlug(
      db,
      indicatorId,
      'Under 75 mortality rate from all causes',
    );

    expect(result).toEqual({ ok: false, reason: 'slug_taken' });
  });
});
