export { type AreaSummary, listAreasByType } from './area-repository.ts';
export {
  createDb,
  createPostgresClient,
  type Database,
  type DbConnection,
  type Schema,
  type SqlClient,
} from './client.ts';
export { dbEnvFields, resolveDbTls } from './env.ts';
export {
  type ApprovedIndicator,
  getApprovedIndicatorById,
  getIndicatorObservations,
  type IndicatorAreaData,
  type IndicatorDetail,
  type IndicatorFacets,
  type IndicatorObservation,
  type IndicatorSearchFilters,
  type IndicatorSearchResult,
  type IndicatorSearchRow,
  type IndicatorSource,
  listApprovedIndicators,
  listIndicatorFacets,
  resolveApprovedIndicatorId,
  searchIndicators,
} from './indicator-repository.ts';
export {
  type IndicatorClassification,
  listClassificationsForIndicator,
  listTopicsForIndicator,
  type TopicSummaryForIndicator,
} from './indicator-topic-repository.ts';
export {
  type AreaRepository,
  createRepositories,
  type IndicatorRepository,
  type Repositories,
  type TopicRepository,
} from './repositories.ts';
export * as schema from './schema.ts';
export { getTopicBySlug, listTopics, type Topic } from './topic-repository.ts';
