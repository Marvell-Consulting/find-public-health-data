import { readFileSync } from 'node:fs';
import type postgres from 'postgres';

import { createDbFromTransaction } from './client.ts';
import { type IndicatorTopicFile, parseIndicatorTopicFile } from './indicator-topic-file.ts';
import { applyIndicatorTopics } from './indicator-topic-repository.ts';
import { IMPORTED_INDICATOR_TEAM_ID, SYSTEM_USER_IDS } from './schema/index.ts';

const sourceActors = [SYSTEM_USER_IDS.pholioMigration, SYSTEM_USER_IDS.testSeed];

/** Rebuilds the draft taxonomy of imported seed data, leaving observations and publisher work alone. */
export async function seedTaxonomy(tx: postgres.TransactionSql) {
  const file = parseIndicatorTopicFile(
    JSON.parse(
      readFileSync(new URL('../data/published-indicator-topics.json', import.meta.url), 'utf8'),
    ),
  );
  await tx`LOCK TABLE indicator_version IN SHARE ROW EXCLUSIVE MODE`;
  const imported = await tx<{ shortId: number; sourceOwned: boolean; hasDraft: boolean }[]>`
    SELECT i.short_id AS "shortId",
      (v.created_by IN ${tx(sourceActors)} AND v.updated_by IN ${tx(sourceActors)}) AS "sourceOwned",
      EXISTS (SELECT 1 FROM indicator_version draft WHERE draft.indicator_id = i.id AND draft.status = 'draft') AS "hasDraft"
    FROM indicator i JOIN current_published_version cpv ON cpv.indicator_id = i.id
    JOIN indicator_version v ON v.id = cpv.id
    WHERE i.team_id = ${IMPORTED_INDICATOR_TEAM_ID} ORDER BY i.short_id
  `;
  const conflicts = imported.filter(({ sourceOwned, hasDraft }) => sourceOwned && hasDraft);
  if (conflicts.length)
    throw new Error(
      `Working drafts protect imported indicators: ${conflicts.map(({ shortId }) => shortId).join(', ')}`,
    );
  const indicators = imported
    .filter(({ sourceOwned }) => sourceOwned)
    .map(({ shortId }) => shortId);
  const selected = new Set(indicators);
  const inScope = new Set(file.indicators);
  const selectedFile: IndicatorTopicFile = {
    indicators,
    areaContextIndicators: file.areaContextIndicators.filter((id) => selected.has(id)),
    indicatorTopics: file.indicatorTopics.filter(({ fingertipsId }) => selected.has(fingertipsId)),
    indicatorSubtopics: file.indicatorSubtopics.filter(({ fingertipsId }) =>
      selected.has(fingertipsId),
    ),
    indicatorClassifications: file.indicatorClassifications.filter(({ fingertipsId }) =>
      selected.has(fingertipsId),
    ),
    indicatorDataUpdatedAt: {},
  };
  const relationships = await applyIndicatorTopics(createDbFromTransaction(tx), selectedFile);
  if (
    relationships.unknownTopics.length ||
    relationships.unknownSubtopics.length ||
    relationships.unknownClassifications.length ||
    relationships.unknownIndicators.length ||
    relationships.links !== selectedFile.indicatorTopics.length ||
    relationships.subtopicLinks !== selectedFile.indicatorSubtopics.length ||
    relationships.classificationLinks !== selectedFile.indicatorClassifications.length
  ) {
    throw new Error(
      'The draft taxonomy did not apply completely; import the current core data before seeding it',
    );
  }
  return {
    indicators: indicators.length,
    relationships,
    unplacedIndicators: indicators.filter((id) => !inScope.has(id)),
    publisherIndicatorsSkipped: imported
      .filter(({ sourceOwned }) => !sourceOwned)
      .map(({ shortId }) => shortId),
  };
}
