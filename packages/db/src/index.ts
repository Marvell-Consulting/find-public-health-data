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
export { assertCoreDataPresent, importCoreData } from './core-data.js';
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
  type IndicatorTopicImportSummary,
  listClassificationsForIndicator,
  listTopicsForIndicator,
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
export {
  analyzeReadModels,
  READ_MODEL_TABLES,
  rebuildReadModels,
  rebuildReadModelTables,
} from './read-models.js';
export {
  type AreaRepository,
  createRepositories,
  type IndicatorRepository,
  type Repositories,
  type TopicRepository,
} from './repositories.js';
export { resetDatabase } from './reset.js';
export * as schema from './schema.js';
export { createOwnerClient, loadOwnerEnv } from './scripts/owner-client.js';
export { assertResetAllowed, assertSeedingAllowed, seedDummyTables } from './seeding.js';
export { getTopicBySlug, listTopics, type Topic } from './topic-repository.js';
