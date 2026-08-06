import { boolSchema, portSchema, z } from '@fphd/config';

/**
 * Each app adds its own role password on top of these. Defaults match the local docker
 * compose database.
 */
export const dbEnvFields = {
  DB_HOST: z.string().default('localhost'),
  DB_PORT: portSchema.default(5432),
  DB_SSL: boolSchema.optional(),
  POSTGRES_DB: z.string().default('fphd'),
};

// 'test' is not an APP_ENV the apps accept, but the seed CLI and integration harness
// recognise it; like 'local' it means a database on this machine, presenting no certificate
// there is anything to verify against.
const NON_TLS_APP_ENVS = ['local', 'test'];

/**
 * Every managed Postgres this deploys to requires TLS, so it is on unless the environment
 * is a developer's machine. No default on the field itself: like LOG_PRETTY, the fallback
 * depends on APP_ENV, which a shared field fragment cannot see.
 */
export function resolveDbSsl(appEnv: string, dbSsl: boolean | undefined): boolean {
  return dbSsl ?? !NON_TLS_APP_ENVS.includes(appEnv);
}
