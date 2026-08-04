export { type AreaSummary, listAreasByType } from './area-repository.js';
export { API_ROLES, bootstrapRoles, type DatabaseRole } from './bootstrap.js';
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
  getApprovedIndicatorByFingertipsId,
  getIndicatorObservations,
  type IndicatorAreaData,
  type IndicatorDetail,
  type IndicatorObservation,
  type IndicatorSource,
  listApprovedIndicators,
} from './indicator-repository.js';
export {
  type IndicatorClassification,
  type IndicatorTopicFile,
  importIndicatorTopics,
  listClassificationsForIndicator,
  listTopicsForIndicator,
  parseIndicatorTopicFile,
  type TopicSummaryForIndicator,
} from './indicator-topic-repository.js';
export {
  type AppliedMigration,
  assertMigratable,
  blockingMigrations,
  compareMigrations,
  type LocalMigration,
  type MigrationReport,
  type MigrationState,
  readAppliedMigrations,
  readLocalMigrations,
} from './migration-status.js';
export { migrateToLatest } from './migrations.js';
export { analyzeReadModels, rebuildReadModels, rebuildReadModelTables } from './read-models.js';
export {
  type AreaRepository,
  createRepositories,
  type IndicatorRepository,
  type Repositories,
  type TopicRepository,
} from './repositories.js';
export * as schema from './schema.js';
export { createOwnerClient } from './scripts/owner-client.js';
export { assertSeedingAllowed, seedDatabase, seedTables } from './seeding.js';
export {
  getTopicById,
  getTopicBySlug,
  listTopics,
  type Topic,
  type TopicUpdate,
  type UpdateTopicResult,
  updateTopic,
} from './topic-repository.js';
