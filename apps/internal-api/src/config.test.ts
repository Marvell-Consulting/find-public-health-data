import { describe, expect, it } from 'vitest';

import { loadConfig } from './config.js';

describe('loadConfig', () => {
  it('applies local defaults when only the password is set', () => {
    expect(loadConfig({ INTERNAL_API_PASSWORD: 'pw' })).toEqual({
      appEnv: 'local',
      port: 4001,
      log: { level: 'info', pretty: false },
      db: {
        host: 'localhost',
        port: 5432,
        database: 'fphd',
        user: 'internal_api',
        password: 'pw',
      },
    });
  });

  it('reads every value from the environment', () => {
    const config = loadConfig({
      APP_ENV: 'production',
      PORT: '8081',
      LOG_LEVEL: 'warn',
      LOG_PRETTY: 'false',
      DB_HOST: 'db.internal',
      DB_PORT: '5433',
      POSTGRES_DB: 'fphd_prod',
      INTERNAL_API_PASSWORD: 'pw',
    });

    expect(config).toEqual({
      appEnv: 'production',
      port: 8081,
      log: { level: 'warn', pretty: false },
      db: {
        host: 'db.internal',
        port: 5433,
        database: 'fphd_prod',
        user: 'internal_api',
        password: 'pw',
      },
    });
  });

  it('throws naming the missing password', () => {
    expect(() => loadConfig({})).toThrow(/INTERNAL_API_PASSWORD/);
  });

  it('rejects an invalid PORT', () => {
    expect(() => loadConfig({ INTERNAL_API_PASSWORD: 'pw', PORT: 'abc' })).toThrow(/PORT/);
  });
});
