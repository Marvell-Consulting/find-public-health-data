import { z } from '@fphd/config';
import { asc, eq, inArray, sql } from 'drizzle-orm';

import type { Database } from './client.js';
import { collection, indicator, indicatorCollection } from './schema/index.js';

export const collectionsFileSchema = z.object({
  collections: z.array(
    z.object({
      slug: z
        .string()
        .min(1)
        .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'slug must be lowercase, hyphen-separated words'),
      name: z.string().min(1),
      source: z.string().min(1),
      sourceRef: z.string().nullable().optional(),
    }),
  ),
  indicatorCollections: z.array(
    z.object({ fingertipsId: z.number().int(), collectionSlug: z.string().min(1) }),
  ),
  indicatorDataUpdatedAt: z.record(z.string(), z.iso.datetime({ local: true }).nullable()),
});

export type CollectionsFile = z.infer<typeof collectionsFileSchema>;

export interface CollectionSummary {
  slug: string;
  name: string;
}

export interface ImportSummary {
  collections: number;
  links: number;
  timestamps: number;
  unknownIndicators: number[];
}

/**
 * Parses an indicator-collections import file, rejecting duplicate slugs and links that
 * name a collection the file does not define — both would import silently as missing
 * relationships rather than as an error anyone would notice.
 */
export function parseCollectionsFile(data: unknown): CollectionsFile {
  const result = collectionsFileSchema.safeParse(data);

  if (!result.success) {
    throw new Error(`Invalid collections file:\n${z.prettifyError(result.error)}`);
  }

  const file = result.data;
  const slugs = file.collections.map(({ slug }) => slug);
  const duplicates = slugs.filter((slug, index) => slugs.indexOf(slug) !== index);
  const defined = new Set(slugs);
  const danglingLinks = file.indicatorCollections
    .filter(({ collectionSlug }) => !defined.has(collectionSlug))
    .map(({ collectionSlug }) => collectionSlug);

  const problems = [
    ...new Set([
      ...duplicates.map((slug) => `duplicate collection slug: ${slug}`),
      ...danglingLinks.map((slug) => `link references undefined collection: ${slug}`),
    ]),
  ];

  if (problems.length > 0) {
    throw new Error(`Invalid collections file:\n${problems.join('\n')}`);
  }

  return file;
}

/**
 * Imports collections, their indicator membership and the source system's publication
 * timestamps. Membership is replaced wholesale for the indicators named in the file: the
 * file is the record of what the source system says today, so a link it no longer carries
 * should not survive in the database.
 */
export async function importCollections(
  db: Database,
  file: CollectionsFile,
): Promise<ImportSummary> {
  const fingertipsIds = [
    ...new Set([
      ...file.indicatorCollections.map(({ fingertipsId }) => fingertipsId),
      ...Object.keys(file.indicatorDataUpdatedAt).map(Number),
    ]),
  ];

  const known = await db
    .select({ id: indicator.id, fingertipsId: indicator.fingertipsId })
    .from(indicator)
    .where(inArray(indicator.fingertipsId, fingertipsIds));
  const idByFingertipsId = new Map(known.map((row) => [row.fingertipsId, row.id]));
  const unknownIndicators = fingertipsIds.filter((id) => !idByFingertipsId.has(id));

  return db.transaction(async (tx) => {
    const stored = await tx
      .insert(collection)
      .values(
        file.collections.map(({ slug, name, source, sourceRef }) => ({
          slug,
          name,
          source,
          sourceRef: sourceRef ?? null,
        })),
      )
      .onConflictDoUpdate({
        target: collection.slug,
        set: {
          name: sql`excluded.name`,
          source: sql`excluded.source`,
          sourceRef: sql`excluded.source_ref`,
          updatedAt: sql`now()`,
        },
      })
      .returning({ id: collection.id, slug: collection.slug });
    const collectionIdBySlug = new Map(stored.map((row) => [row.slug, row.id]));

    const links = file.indicatorCollections.flatMap(({ fingertipsId, collectionSlug }) => {
      const indicatorId = idByFingertipsId.get(fingertipsId);
      const collectionId = collectionIdBySlug.get(collectionSlug);
      return indicatorId && collectionId ? [{ indicatorId, collectionId }] : [];
    });

    const indicatorIds = [...new Set(links.map(({ indicatorId }) => indicatorId))];
    if (indicatorIds.length > 0) {
      await tx
        .delete(indicatorCollection)
        .where(inArray(indicatorCollection.indicatorId, indicatorIds));
    }
    if (links.length > 0) {
      await tx.insert(indicatorCollection).values(links);
    }

    let timestamps = 0;
    for (const [fingertipsId, updatedAt] of Object.entries(file.indicatorDataUpdatedAt)) {
      const indicatorId = idByFingertipsId.get(Number(fingertipsId));
      if (!indicatorId || !updatedAt) {
        continue;
      }
      await tx
        .update(indicator)
        .set({ dataUpdatedAt: new Date(`${updatedAt}Z`) })
        .where(eq(indicator.id, indicatorId));
      timestamps += 1;
    }

    return {
      collections: stored.length,
      links: links.length,
      timestamps,
      unknownIndicators,
    };
  });
}

/** The collections an indicator belongs to, ordered by name. */
export async function listCollectionsForIndicator(
  db: Database,
  indicatorId: string,
): Promise<CollectionSummary[]> {
  return db
    .select({ slug: collection.slug, name: collection.name })
    .from(indicatorCollection)
    .innerJoin(collection, eq(indicatorCollection.collectionId, collection.id))
    .where(eq(indicatorCollection.indicatorId, indicatorId))
    .orderBy(asc(collection.name));
}
