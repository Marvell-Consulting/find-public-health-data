import { portSchema, z } from '@fphd/config';

/**
 * The database connection vars every consumer shares — the two APIs and drizzle-kit. Spread
 * into an app's env schema; each app adds its own role password on top. Defaults match the
 * local docker compose database.
 */
export const dbEnvFields = {
  DB_HOST: z.string().default('localhost'),
  DB_PORT: portSchema.default(5432),
  POSTGRES_DB: z.string().default('fphd'),
};
