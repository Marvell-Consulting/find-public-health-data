import { type AppEnv, isDeployedEnv, z } from '@fphd/config';

/** Either the account URL with a managed identity, in Azure, or a connection string, for Azurite. */
export const storageEnvFields = {
  STORAGE_CONTAINER: z.string().min(1),
  STORAGE_ACCOUNT_URL: z.url({ protocol: /^https$/ }).optional(),
  AZURE_CLIENT_ID: z.guid().optional(),
  STORAGE_CONNECTION_STRING: z.string().optional(),
};

export type StorageConfig = { container: string } & (
  | { connectionString: string }
  | { accountUrl: string; clientId: string }
);

type StorageEnv = {
  STORAGE_CONTAINER: string;
  STORAGE_ACCOUNT_URL?: string | undefined;
  AZURE_CLIENT_ID?: string | undefined;
  STORAGE_CONNECTION_STRING?: string | undefined;
};

/** A connection string carries an account key, so it is accepted only for Azurite on this machine. */
export function resolveStorage(appEnv: AppEnv, env: StorageEnv): StorageConfig {
  const container = env.STORAGE_CONTAINER;
  const accountUrl = env.STORAGE_ACCOUNT_URL;
  const clientId = env.AZURE_CLIENT_ID;
  const connectionString = env.STORAGE_CONNECTION_STRING;

  if (connectionString !== undefined) {
    if (accountUrl !== undefined || clientId !== undefined) {
      throw storageConfigError(
        'set STORAGE_CONNECTION_STRING or STORAGE_ACCOUNT_URL with AZURE_CLIENT_ID, not both',
      );
    }
    if (isDeployedEnv(appEnv)) {
      throw storageConfigError(
        `STORAGE_CONNECTION_STRING is for Azurite and is refused when APP_ENV is ${appEnv}; ` +
          'set STORAGE_ACCOUNT_URL and AZURE_CLIENT_ID',
      );
    }
    return { container, connectionString };
  }

  if (accountUrl === undefined || clientId === undefined) {
    throw storageConfigError(
      'set STORAGE_ACCOUNT_URL and AZURE_CLIENT_ID, or STORAGE_CONNECTION_STRING for Azurite',
    );
  }
  return { container, accountUrl, clientId };
}

function storageConfigError(message: string): Error {
  return new Error(`Invalid environment configuration:\n${message}\n(see .env.example)`);
}
