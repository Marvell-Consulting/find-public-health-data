import { portSchema, z } from '@fphd/config';

/**
 * Each app adds its own role password on top of these. Defaults match the local docker
 * compose database.
 */
export const dbEnvFields = {
  DB_HOST: z.string().default('localhost'),
  DB_PORT: portSchema.default(5432),
  POSTGRES_DB: z.string().default('fphd'),
};
