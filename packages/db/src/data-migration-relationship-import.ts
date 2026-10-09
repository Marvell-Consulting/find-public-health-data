import { readFile } from 'node:fs/promises';
import type postgres from 'postgres';
import { createDbFromTransaction } from './client.ts';
import type { DataMigrationProgressReporter } from './data-migration-copy.ts';
import type { DataMigrationManifest } from './data-migration-manifest.ts';
import { parseDataMigrationRelationships } from './data-migration-relationships.ts';
import { applyIndicatorTopics } from './indicator-topic-repository.ts';

export async function applyRelationships(
  tx: postgres.TransactionSql,
  directory: string,
  manifest: DataMigrationManifest,
  report: DataMigrationProgressReporter,
): Promise<void> {
  report({ table: 'indicator_relationships', phase: 'relationships', state: 'started' });
  const relationships = parseDataMigrationRelationships(
    JSON.parse(await readFile(`${directory}/${manifest.relationships.file}`, 'utf8')),
  );
  const published = await tx<{ shortId: number; versionId: string }[]>`
    SELECT i.short_id AS "shortId", current.id AS "versionId"
    FROM indicator i JOIN current_published_version current ON current.indicator_id = i.id
    ORDER BY i.short_id
  `;
  const sourceIndicators =
    manifest.kind === 'baseline'
      ? await tx<{ shortId: number }[]>`SELECT short_id AS "shortId" FROM indicator`
      : await tx<{ shortId: number }[]>`
        SELECT short_id AS "shortId" FROM data_migration_upsert_indicator
        UNION
        SELECT i.short_id AS "shortId" FROM indicator i
        JOIN migration_source_indicator_version v ON v.indicator_id = i.id
      `;
  const reviewedIds = new Set(relationships.indicators);
  const unreviewed = sourceIndicators
    .filter(({ shortId }) => !reviewedIds.has(shortId))
    .map(({ shortId }) => shortId);
  if (unreviewed.length > 0) {
    throw new Error(
      `Migrated source indicators are missing from reviewed relationship coverage: ${unreviewed.join(', ')}`,
    );
  }
  const actual = published.map(({ shortId }) => shortId);
  const declared = [...relationships.indicators].sort((left, right) => left - right);
  if (actual.length !== declared.length || actual.some((id, index) => id !== declared[index])) {
    const publishedIds = new Set(actual);
    const missing = actual.filter((id) => !reviewedIds.has(id));
    const unavailable = declared.filter((id) => !publishedIds.has(id));
    const problems = [
      missing.length > 0 ? `published indicators absent from coverage: ${missing.join(', ')}` : '',
      unavailable.length > 0
        ? `declared indicators without a published version: ${unavailable.join(', ')}`
        : '',
    ].filter(Boolean);
    throw new Error(
      `Reviewed relationship coverage does not match the migrated indicators (${problems.join('; ')})`,
    );
  }
  if (relationships.indicators.length !== manifest.relationships.rows) {
    throw new Error('Reviewed relationship coverage count does not match the manifest');
  }
  if (published.length > 0) {
    const versionIds = published.map(({ versionId }) => versionId);
    await tx`DELETE FROM indicator_version_topic WHERE indicator_version_id IN ${tx(versionIds)}`;
    await tx`DELETE FROM indicator_version_classification WHERE indicator_version_id IN ${tx(versionIds)}`;
    await tx`
      UPDATE indicator_version
      SET has_risk_factor = NULLIF(has_risk_factor, true), has_framework = NULLIF(has_framework, true)
      WHERE id IN ${tx(versionIds)}
    `;
  }
  const summary = await applyIndicatorTopics(createDbFromTransaction(tx), relationships);
  if (
    summary.unknownIndicators.length > 0 ||
    summary.unknownTopics.length > 0 ||
    summary.unknownClassifications.length > 0 ||
    summary.links !== relationships.indicatorTopics.length ||
    summary.classificationLinks !== relationships.indicatorClassifications.length
  ) {
    const problems = [
      summary.unknownIndicators.length > 0
        ? `unknown indicators: ${summary.unknownIndicators.join(', ')}`
        : '',
      summary.unknownTopics.length > 0 ? `unknown topics: ${summary.unknownTopics.join(', ')}` : '',
      summary.unknownClassifications.length > 0
        ? `unknown classifications: ${summary.unknownClassifications.join(', ')}`
        : '',
      summary.links !== relationships.indicatorTopics.length
        ? `topic links: ${summary.links}/${relationships.indicatorTopics.length}`
        : '',
      summary.classificationLinks !== relationships.indicatorClassifications.length
        ? `classification links: ${summary.classificationLinks}/${relationships.indicatorClassifications.length}`
        : '',
    ].filter(Boolean);
    throw new Error(
      `Reviewed indicator relationships did not apply completely (${problems.join('; ')})`,
    );
  }
  const withoutTopics = await tx<{ shortId: number; name: string | null }[]>`
    SELECT i.short_id AS "shortId", v.name
    FROM indicator i
    JOIN current_published_version current ON current.indicator_id = i.id
    JOIN indicator_version v ON v.id = current.id
    WHERE NOT EXISTS (
      SELECT 1 FROM indicator_version_topic t
      WHERE t.indicator_version_id = current.id
    )
    ORDER BY i.short_id
  `;
  if (withoutTopics.length > 0) {
    throw new Error(
      `Migrated indicators have no topic: ${withoutTopics
        .map(({ shortId, name }) => (name ? `${shortId} (${name})` : String(shortId)))
        .join(', ')}`,
    );
  }
  report({ table: 'indicator_relationships', phase: 'relationships', state: 'complete' });
}
