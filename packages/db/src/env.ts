import { type AppEnv, boolSchema, isDeployedEnv, portSchema, z } from '@fphd/config';

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

/**
 * Every managed Postgres this deploys to requires TLS, so it is on unless the database is
 * on this machine — the compose stack under `local`, the disposable test databases under
 * `test` — where nothing presents a certificate to verify. No default on the field itself:
 * like LOG_PRETTY, the fallback depends on APP_ENV, which a shared field fragment cannot
 * see.
 */
export function resolveDbSsl(appEnv: AppEnv, dbSsl: boolean | undefined): boolean {
  return dbSsl ?? isDeployedEnv(appEnv);
}
