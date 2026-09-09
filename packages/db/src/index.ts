export { type AreaSummary, listAreasByType } from './area-repository.js';
export {
  createDb,
  createPostgresClient,
  type Database,
  type DbConnection,
  type Schema,
  type SqlClient,
} from './client.js';
export { dbEnvFields, resolveDbTls } from './env.js';
export {
  type ApprovedIndicator,
  getApprovedIndicatorById,
  getIndicatorObservations,
  type IndicatorAreaData,
  type IndicatorDetail,
  type IndicatorObservation,
  type IndicatorSource,
  listApprovedIndicators,
  resolveApprovedIndicatorId,
} from './indicator-repository.js';
export {
  type IndicatorClassification,
  listClassificationsForIndicator,
  listTopicsForIndicator,
  type TopicSummaryForIndicator,
} from './indicator-topic-repository.js';
export {
  type AreaRepository,
  createRepositories,
  type IndicatorRepository,
  type Repositories,
  type TopicRepository,
} from './repositories.js';
export * as schema from './schema.js';
export { getTopicBySlug, listTopics, type Topic } from './topic-repository.js';
