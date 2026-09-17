import { slugify } from '@fphd/config/slug';
import { type Database, schema } from '@fphd/db';
import { and, eq, sql } from 'drizzle-orm';

import { isUniqueViolation } from './unique-violation.js';

const { indicatorAlias } = schema;

export type IndicatorAliasResult =
  | { ok: true; slug: string }
  | { ok: false; reason: 'no_slug_in_title' | 'not_found' | 'slug_taken' };

// A slug of nothing but digits is an indicator number, so a pending slug is never one.
const PENDING_SLUG = sql`${indicatorAlias.slug} !~ '^[0-9]+$' AND NOT ${indicatorAlias.isPublished}`;

/**
 * The addresses a new indicator starts with: its number, minted from the sequence so it can
 * never collide with a Fingertips number imported later, and the pending slug its title
 * implies. Neither is published, so the public site serves neither until the indicator is.
 */
export async function createIndicatorAliases(
  db: Database,
  indicatorId: string,
  title: string,
): Promise<IndicatorAliasResult> {
  const slug = slugify(title);

  if (slug === '') {
    return { ok: false, reason: 'no_slug_in_title' };
  }

  try {
    await db.insert(indicatorAlias).values([
      { indicatorId, slug: sql`nextval('indicator_number_seq')::text` },
      { indicatorId, slug },
    ]);
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, reason: 'slug_taken' };
    throw error;
  }

  return { ok: true, slug };
}

/**
 * A title change while the indicator is unpublished rewrites the slug it has reserved
 * rather than adding a second one: an indicator publishes at most one new address per
 * version, and nothing has been shared yet.
 */
export async function renamePendingIndicatorSlug(
  db: Database,
  indicatorId: string,
  title: string,
): Promise<IndicatorAliasResult> {
  const slug = slugify(title);

  if (slug === '') {
    return { ok: false, reason: 'no_slug_in_title' };
  }

  try {
    const [updated] = await db
      .update(indicatorAlias)
      .set({ slug, updatedAt: sql`now()` })
      .where(and(eq(indicatorAlias.indicatorId, indicatorId), PENDING_SLUG))
      .returning({ slug: indicatorAlias.slug });

    return updated === undefined
      ? { ok: false, reason: 'not_found' }
      : { ok: true, slug: updated.slug };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: false, reason: 'slug_taken' };
    throw error;
  }
}
