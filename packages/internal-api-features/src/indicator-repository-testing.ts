import { appEnvFields, parseEnv, z } from '@fphd/config';
import { createDb, type Database, dbEnvFields, resolveDbTls, schema } from '@fphd/db';
import { createTestDatabase } from '@fphd/db/testing';
import type { ClassificationDimension } from '@fphd/utils/classification-dimension';
import { slugify } from '@fphd/utils/slug';
import { and, eq, sql } from 'drizzle-orm';
import { test } from 'vitest';

import { type CreatedIndicatorDraft, createIndicatorDraft } from './indicator-draft-repository.ts';

const env = parseEnv(
  z.object({
    ...dbEnvFields,
    ...appEnvFields,
    POSTGRES_USER: z.string().default('fphd'),
    POSTGRES_PASSWORD: z.string().default('fphd'),
  }),
  process.env,
);

/**
 * A test given its file's own copy of the seeded database as `db`. The seed carries the lookup
 * rows an indicator references, which the schema template lacks.
 */
export const repositoryTest = test
  // biome-ignore lint/correctness/noEmptyPattern: vitest reads a fixture's dependencies from this pattern
  .extend('db', { scope: 'file' }, async ({}, { onCleanup }) => {
    const testDb = await createTestDatabase({ template: 'seeded' });
    const db = createDb({
      host: env.DB_HOST,
      port: env.DB_PORT,
      database: testDb.name,
      user: env.POSTGRES_USER,
      password: env.POSTGRES_PASSWORD,
      ssl: resolveDbTls(env.APP_ENV, env.DB_TLS),
    });

    onCleanup(async () => {
      await db.$client.end();
      await testDb.drop();
    });

    return db;
  })
  // Captured before the file's first test writes, so the later cases still know what the seed held.
  .extend('seededIds', { scope: 'file', auto: true }, ({ db }) => idsNewestFirst(db));

const {
  classification,
  indicatorVersionClassification,
  indicatorVersionTopic,
  indicatorVersion,
  indicatorVersionAgeRange,
  indicatorVersionLink,
} = schema;

export const ACTOR = 'integration-test';

/** Every case here names its indicator distinctly, so the slug is free. */
export async function newDraft(db: Database, name: string): Promise<CreatedIndicatorDraft> {
  const created = await createIndicatorDraft(db, { name }, ACTOR);
  if (!created.ok) throw new Error(`createIndicatorDraft refused the name: ${created.reason}`);
  return created;
}

/** The dashboard's order, stated in SQL so the test does not lean on the code it checks. */
export async function idsNewestFirst(db: Database): Promise<string[]> {
  const rows = (await db.execute(sql`
    SELECT i.id
    FROM indicator i
    LEFT JOIN indicator_version d ON d.indicator_id = i.id AND d.status = 'draft'
    LEFT JOIN LATERAL (
      SELECT pv.* FROM indicator_version pv
      WHERE pv.indicator_id = i.id AND pv.status = 'published'
      ORDER BY pv.published_at DESC NULLS LAST, pv.id DESC
      LIMIT 1
    ) p ON true
    ORDER BY greatest(d.updated_at, p.updated_at) DESC, coalesce(d.name, p.name), i.id
  `)) as unknown as { id: string }[];

  return rows.map((row) => row.id);
}

export async function ciMethodId(db: Database, name: string): Promise<string> {
  const [row] = await db
    .select({ id: schema.ciMethod.id })
    .from(schema.ciMethod)
    .where(eq(schema.ciMethod.name, name));
  if (!row) throw new Error(`The seed holds no CI method named ${name}`);
  return row.id;
}

/**
 * An indicator with two published versions whose id order disagrees with their publication
 * order: the superseded one is written last, so only published_at picks out the current one.
 * Each case names its own, because a slug belongs to one indicator.
 */
export async function indicatorWithTwoPublications(
  db: Database,
  currentName: string,
): Promise<{
  indicatorId: string;
  currentId: string;
  supersededId: string;
  currentName: string;
  currentSlug: string;
}> {
  const created = await newDraft(db, currentName);
  const currentSlug = slugify(currentName);
  await db
    .update(indicatorVersion)
    .set({
      status: 'published',
      publishedAt: new Date('2030-01-01T00:00:00Z'),
      updatedAt: new Date('2030-01-01T00:00:00Z'),
    })
    .where(eq(indicatorVersion.id, created.versionId));

  const [superseded] = await db
    .insert(indicatorVersion)
    .values({
      indicatorId: created.indicatorId,
      status: 'published',
      name: `${currentName}, superseded`,
      slug: `${currentSlug}-superseded`,
      publishedAt: new Date('2029-01-01T00:00:00Z'),
      createdBy: ACTOR,
      updatedBy: ACTOR,
    })
    .returning({ id: indicatorVersion.id });
  if (!superseded) throw new Error('inserted no version');

  return {
    indicatorId: created.indicatorId,
    currentId: created.versionId,
    supersededId: superseded.id,
    currentName,
    currentSlug,
  };
}

export const commentary = { url: 'https://www.gov.uk/statistics', text: 'Statistical commentary' };
export const fingertips = { url: 'https://fingertips.phe.org.uk/', text: 'Fingertips' };

/** A version's links as the table holds them, in order. */
export async function linksOf(
  db: Database,
  versionId: string,
): Promise<{ url: string; text: string }[]> {
  return db
    .select({ url: indicatorVersionLink.url, text: indicatorVersionLink.text })
    .from(indicatorVersionLink)
    .where(eq(indicatorVersionLink.indicatorVersionId, versionId))
    .orderBy(indicatorVersionLink.position);
}

export const sixteenPlus = {
  lowerLimit: 16,
  lowerLimitUnit: 'years',
  upperLimit: null,
  upperLimitUnit: null,
} as const;
export const underFive = {
  lowerLimit: null,
  lowerLimitUnit: null,
  upperLimit: 4,
  upperLimitUnit: 'years',
} as const;

/** A version's age ranges as the table holds them, in order. */
export async function ageRangesOf(db: Database, versionId: string) {
  return db
    .select({
      lowerLimit: indicatorVersionAgeRange.lowerLimit,
      lowerLimitUnit: indicatorVersionAgeRange.lowerLimitUnit,
      upperLimit: indicatorVersionAgeRange.upperLimit,
      upperLimitUnit: indicatorVersionAgeRange.upperLimitUnit,
    })
    .from(indicatorVersionAgeRange)
    .where(eq(indicatorVersionAgeRange.indicatorVersionId, versionId))
    .orderBy(indicatorVersionAgeRange.position);
}

/** The core data's ONS provider, with one of its sources and with none specific. */
export async function onsSources(db: Database) {
  const [row] = await db
    .select({ providerId: schema.dataProvider.id, sourceId: schema.dataProviderSource.id })
    .from(schema.dataProvider)
    .innerJoin(
      schema.dataProviderSource,
      eq(schema.dataProviderSource.providerId, schema.dataProvider.id),
    )
    .where(
      and(
        eq(schema.dataProvider.name, 'Office for National Statistics (ONS)'),
        eq(schema.dataProviderSource.name, 'Live births'),
      ),
    );
  if (!row) throw new Error('The core data holds no ONS live births');
  return { liveBirths: row, onsAlone: { providerId: row.providerId, sourceId: null } };
}

export async function topicIdsOf(db: Database, versionId: string): Promise<string[]> {
  const rows = await db
    .select({ topicId: indicatorVersionTopic.topicId })
    .from(indicatorVersionTopic)
    .where(eq(indicatorVersionTopic.indicatorVersionId, versionId));
  return rows.map(({ topicId }) => topicId).sort();
}

/** The first classification of a dimension, by name, from the core data. */
export async function classificationIn(
  db: Database,
  dimension: ClassificationDimension,
): Promise<{ id: string }> {
  const [row] = await db
    .select({ id: classification.id })
    .from(classification)
    .where(eq(classification.dimension, dimension))
    .orderBy(classification.name)
    .limit(1);
  if (row === undefined) throw new Error(`The core data holds no ${dimension}`);
  return row;
}

export const typeClassification = (db: Database) => classificationIn(db, 'indicator_type');

export async function classificationIdsOf(db: Database, versionId: string): Promise<string[]> {
  const rows = await db
    .select({ id: indicatorVersionClassification.classificationId })
    .from(indicatorVersionClassification)
    .where(eq(indicatorVersionClassification.indicatorVersionId, versionId));
  return rows.map(({ id }) => id).sort();
}
