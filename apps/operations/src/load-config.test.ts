import { describe, expect, it } from 'vitest';

import { loadConfig } from './load-config.js';

describe('loadConfig', () => {
  it('applies local defaults when only the owner password is set', () => {
    expect(loadConfig({ POSTGRES_PASSWORD: 'owner-pw' })).toEqual({
      appEnv: 'local',
      log: { level: 'info', pretty: true },
      db: {
        host: 'localhost',
        port: 5432,
        database: 'fphd',
        user: 'fphd',
        password: 'owner-pw',
        ssl: false,
      },
      roles: { publicApiPassword: undefined, internalApiPassword: undefined },
    });
  });

  it('connects as the owner role over TLS when deployed', () => {
    const config = loadConfig({
      APP_ENV: 'production',
      DB_HOST: 'fphd.postgres.database.azure.com',
      POSTGRES_DB: 'fphd',
      POSTGRES_USER: 'fphd_admin',
      POSTGRES_PASSWORD: 'owner-pw',
      PUBLIC_API_PASSWORD: 'public-pw',
      INTERNAL_API_PASSWORD: 'internal-pw',
    });

    expect(config.db).toEqual({
      host: 'fphd.postgres.database.azure.com',
      port: 5432,
      database: 'fphd',
      user: 'fphd_admin',
      password: 'owner-pw',
      ssl: true,
    });
    expect(config.roles).toEqual({
      publicApiPassword: 'public-pw',
      internalApiPassword: 'internal-pw',
    });
  });

  it('throws naming the missing owner password', () => {
    expect(() => loadConfig({})).toThrow(/POSTGRES_PASSWORD/);
  });

  it('does not require the role passwords, which only db bootstrap uses', () => {
    expect(() => loadConfig({ POSTGRES_PASSWORD: 'owner-pw' })).not.toThrow();
  });
});
