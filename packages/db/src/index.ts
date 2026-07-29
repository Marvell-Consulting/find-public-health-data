export {
  createDb,
  type Database,
  type DbConnection,
  type Schema,
  type SqlClient,
} from './client.js';
export { dbEnvFields, resolveDbTls } from './env.js';
export {
  type ApprovedIndicator,
  getApprovedIndicatorByFingertipsId,
  getIndicatorObservations,
  type IndicatorAreaData,
  type IndicatorDetail,
  type IndicatorObservation,
  type IndicatorSource,
  listApprovedIndicators,
} from './indicator-repository.js';
export { rebuildReadModels } from './read-models.js';
export {
  createRepositories,
  type IndicatorRepository,
  type Repositories,
  type TopicRepository,
} from './repositories.js';
export * as schema from './schema.js';
export { createOwnerClient } from './scripts/owner-client.js';
export { getTopicBySlug, listTopics, type Topic } from './topic-repository.js';
