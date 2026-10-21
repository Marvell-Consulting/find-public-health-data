import { z } from '@fphd/config';
import { type IndicatorTopicFile, parseIndicatorTopicFile } from '@fphd/db/data-migration-contract';

const sourceSchema = z.object({
  indicators: z.array(
    z.object({
      fingertipsId: z.number().int().positive(),
      status: z.string(),
      measureType: z.string().nullable(),
      programmes: z.array(z.string()),
      lifeStage: z.string().nullable(),
      placements: z.array(
        z.object({ topic: z.string(), subtopic: z.string(), primary: z.boolean() }),
      ),
    }),
  ),
});

interface Topic {
  id: string;
  title: string;
  isActive?: boolean;
}
interface Subtopic {
  id: string;
  topicId: string;
  title: string;
}
interface Classification {
  id: string;
  dimension: string;
  name: string;
  isActive?: boolean;
}

/** Translates explicit workbook placements; names and profiles never supply inferred links. */
export function taxonomyRelationships(
  value: unknown,
  topics: readonly Topic[],
  subtopics: readonly Subtopic[],
  classifications: readonly Classification[],
  selection?: readonly number[],
): IndicatorTopicFile {
  const source = sourceSchema.parse(value);
  const sourceById = new Map(
    source.indicators.map((indicator) => [indicator.fingertipsId, indicator]),
  );
  if (sourceById.size !== source.indicators.length)
    throw new Error('Taxonomy contains duplicate indicator ids');
  const selected = selection ?? source.indicators.map(({ fingertipsId }) => fingertipsId);
  if (new Set(selected).size !== selected.length)
    throw new Error('Taxonomy selection contains duplicate indicator ids');
  const missing = selected.filter((id) => !sourceById.has(id));
  if (missing.length)
    throw new Error(`Indicators absent from the in-scope taxonomy: ${missing.join(', ')}`);
  const topicByTitle = new Map(
    topics.filter(({ isActive }) => isActive !== false).map((topic) => [topic.title, topic.id]),
  );
  const subtopicByTitle = new Map(
    subtopics.map((subtopic) => [`${subtopic.topicId}:${subtopic.title}`, subtopic.id]),
  );
  const classificationByName = new Map(
    classifications
      .filter(({ isActive }) => isActive !== false)
      .map((classification) => [
        `${classification.dimension}:${classification.name}`,
        classification.id,
      ]),
  );
  const file: IndicatorTopicFile = {
    indicators: [...selected].sort((a, b) => a - b),
    areaContextIndicators: [],
    indicatorTopics: [],
    indicatorSubtopics: [],
    indicatorClassifications: [],
    indicatorDataUpdatedAt: {},
  };
  for (const fingertipsId of file.indicators) {
    const indicator = sourceById.get(fingertipsId);
    if (!indicator) throw new Error(`Unknown taxonomy indicator: ${fingertipsId}`);
    const context = indicator.status.startsWith('Not tagged: area context');
    if (context) {
      if (
        indicator.placements.length ||
        indicator.measureType ||
        indicator.programmes.length ||
        indicator.lifeStage
      )
        throw new Error(`Area-context indicator has assignments: ${fingertipsId}`);
      file.areaContextIndicators.push(fingertipsId);
      continue;
    }
    if (indicator.placements.filter(({ primary }) => primary).length !== 1)
      throw new Error(`Indicator needs exactly one primary placement: ${fingertipsId}`);
    const memberships = new Map<string, boolean>();
    for (const placement of indicator.placements) {
      const topicId = topicByTitle.get(placement.topic);
      if (!topicId) throw new Error(`Unknown taxonomy topic: ${placement.topic}`);
      memberships.set(topicId, (memberships.get(topicId) ?? false) || placement.primary);
      const subtopicId = subtopicByTitle.get(`${topicId}:${placement.subtopic}`);
      if (subtopicId)
        file.indicatorSubtopics.push({
          fingertipsId,
          topicId,
          subtopicId,
          isPrimary: placement.primary,
        });
      else if (placement.subtopic !== placement.topic)
        throw new Error(`Unknown taxonomy subtopic: ${placement.topic} > ${placement.subtopic}`);
    }
    for (const [topicId, isPrimary] of memberships)
      file.indicatorTopics.push({ fingertipsId, topicId, isPrimary });
    const tags = [
      ...(indicator.measureType ? [['indicator_type', indicator.measureType]] : []),
      ...indicator.programmes.map((name) => ['framework', name]),
      ...(indicator.lifeStage
        ? indicator.lifeStage.split('; ').map((name) => ['life_stage', name])
        : []),
    ];
    const used = new Set<string>();
    for (const [dimension, name] of tags) {
      const classificationId = classificationByName.get(`${dimension}:${name}`);
      if (!classificationId) throw new Error(`Unknown taxonomy tag: ${dimension}: ${name}`);
      if (used.has(classificationId))
        throw new Error(`Duplicate taxonomy tag: ${fingertipsId}: ${name}`);
      used.add(classificationId);
      file.indicatorClassifications.push({ fingertipsId, classificationId });
    }
  }
  return parseIndicatorTopicFile(file);
}
