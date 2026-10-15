/**
 * Everything only the operations CLI and the test harness do to a database: bootstrap,
 * migrate, import, seed, reset and rebuild. Kept off the package's default export so the
 * deployed APIs cannot reach it by accident.
 */
export { API_ROLES, bootstrapRoles, type DatabaseRole } from './bootstrap.ts';
export { assertCoreDataPresent, importCoreData } from './core-data.ts';
export {
  type ApplyDataMigrationResult,
  applyDataMigration,
  type DataMigrationProgress,
  type DataMigrationProgressReporter,
} from './data-migration.ts';
export {
  assertCompleteTableSet,
  assertMigrationFileNames,
  type BaselineManifest,
  baselineManifestSchema,
  DATA_MIGRATION_FORMAT_VERSION,
  DATA_MIGRATION_NULL,
  DATA_MIGRATION_REFERENCE_TABLES,
  DATA_MIGRATION_SCHEMA,
  DATA_MIGRATION_TABLES,
  type DataMigrationManifest,
  dataMigrationManifestSchema,
  type IncrementalManifest,
  incrementalManifestSchema,
} from './data-migration-manifest.ts';
export {
  type DataMigrationRelationships,
  dataMigrationRelationshipsSchema,
  parseDataMigrationRelationships,
} from './data-migration-relationships.ts';
export type {
  IndicatorTopicFile,
  IndicatorTopicImportSummary,
} from './indicator-topic-repository.ts';
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
} from './migration-status.ts';
export { migrateToLatest } from './migrations.ts';
export {
  analyzeReadModels,
  READ_MODEL_TABLES,
  rebuildReadModels,
  rebuildReadModelTables,
} from './read-models.ts';
export { resetDatabase } from './reset.ts';
export { createOwnerClient, loadOwnerEnv } from './scripts/owner-client.ts';
export {
  assertResetAllowed,
  assertSeedingAllowed,
  readCsvHeader,
  SEED_TABLES,
  SEEDED_TABLES,
  type SeedSummary,
  seedDummyTables,
  seedPublishedTables,
} from './seeding.ts';
