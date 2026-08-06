export { bootstrapRoles, type DatabaseRole } from './bootstrap.js';
export {
  createDb,
  createPostgresClient,
  type Database,
  type DbConnection,
  type Schema,
  type SqlClient,
} from './client.js';
export { dbEnvFields, resolveDbSsl } from './env.js';
export { type ApprovedIndicator, listApprovedIndicators } from './indicator-repository.js';
export { migrateToLatest } from './migrations.js';
export { rebuildReadModels } from './read-models.js';
export {
  createRepositories,
  type IndicatorRepository,
  type Repositories,
  type TopicRepository,
} from './repositories.js';
export * as schema from './schema.js';
export { createOwnerClient } from './scripts/owner-client.js';
export { assertSeedingAllowed, seedDatabase } from './seeding.js';
export { getTopicBySlug, listTopics, type Topic } from './topic-repository.js';
