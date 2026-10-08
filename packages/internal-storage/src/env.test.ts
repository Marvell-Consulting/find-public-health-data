import { parseEnv, z } from '@fphd/config';
import { describe, expect, it } from 'vitest';

import { resolveStorage, storageEnvFields } from './env.ts';

const schema = z.object(storageEnvFields);
const azurite = 'UseDevelopmentStorage=true';
const managedIdentity = {
  STORAGE_CONTAINER: 'uploads',
  STORAGE_ACCOUNT_URL: 'https://fphddev.blob.core.windows.net',
  AZURE_CLIENT_ID: '00000000-0000-0000-0000-000000000000',
};

describe('storageEnvFields', () => {
  it('requires a container', () => {
    expect(() => parseEnv(schema, { STORAGE_CONNECTION_STRING: azurite })).toThrow(
      /STORAGE_CONTAINER/,
    );
  });

  it('rejects an account URL that is not https and a client id that is not a GUID', () => {
    expect(() => parseEnv(schema, { ...managedIdentity, STORAGE_ACCOUNT_URL: 'fphddev' })).toThrow(
      /STORAGE_ACCOUNT_URL/,
    );
    expect(() =>
      parseEnv(schema, { ...managedIdentity, STORAGE_ACCOUNT_URL: 'http://fphddev.example' }),
    ).toThrow(/STORAGE_ACCOUNT_URL/);
    expect(() => parseEnv(schema, { ...managedIdentity, AZURE_CLIENT_ID: 'internal-api' })).toThrow(
      /AZURE_CLIENT_ID/,
    );
  });
});

describe('resolveStorage', () => {
  it('connects by managed identity in any environment', () => {
    const expected = {
      container: 'uploads',
      accountUrl: 'https://fphddev.blob.core.windows.net',
      clientId: '00000000-0000-0000-0000-000000000000',
    };

    expect(resolveStorage('production', managedIdentity)).toEqual(expected);
    expect(resolveStorage('local', managedIdentity)).toEqual(expected);
  });

  it('accepts a connection string only where the storage is on this machine', () => {
    const env = { STORAGE_CONTAINER: 'uploads', STORAGE_CONNECTION_STRING: azurite };

    expect(resolveStorage('local', env)).toEqual({
      container: 'uploads',
      connectionString: azurite,
    });
    expect(resolveStorage('test', env)).toEqual({
      container: 'uploads',
      connectionString: azurite,
    });
    expect(() => resolveStorage('dev', env)).toThrow(/STORAGE_CONNECTION_STRING is for Azurite/);
    expect(() => resolveStorage('production', env)).toThrow(/APP_ENV is production/);
  });

  it('refuses both forms at once', () => {
    expect(() =>
      resolveStorage('local', { ...managedIdentity, STORAGE_CONNECTION_STRING: azurite }),
    ).toThrow(/not both/);
  });

  it('needs the account URL and the client id together', () => {
    const { AZURE_CLIENT_ID: _, ...withoutClientId } = managedIdentity;
    const { STORAGE_ACCOUNT_URL: __, ...withoutAccountUrl } = managedIdentity;

    expect(() => resolveStorage('dev', withoutClientId)).toThrow(/AZURE_CLIENT_ID/);
    expect(() => resolveStorage('dev', withoutAccountUrl)).toThrow(/STORAGE_ACCOUNT_URL/);
    expect(() => resolveStorage('dev', { STORAGE_CONTAINER: 'uploads' })).toThrow(
      /STORAGE_ACCOUNT_URL and AZURE_CLIENT_ID/,
    );
  });
});
