import { describe, expect, it } from 'vitest';

import { loadConfig } from './config.js';

describe('loadConfig', () => {
  it('applies local defaults when only the password is set', () => {
    expect(loadConfig({ PUBLIC_API_PASSWORD: 'pw' })).toEqual({
      appEnv: 'local',
      port: 4000,
      log: { level: 'info', pretty: false },
      db: { host: 'localhost', port: 5432, database: 'fphd', user: 'public_api', password: 'pw' },
    });
  });

  it('reads every value from the environment', () => {
    const config = loadConfig({
      APP_ENV: 'staging',
      PORT: '8080',
      LOG_LEVEL: 'debug',
      LOG_PRETTY: '1',
      DB_HOST: 'db.internal',
      DB_PORT: '5433',
      POSTGRES_DB: 'fphd_staging',
      PUBLIC_API_PASSWORD: 'pw',
    });

    expect(config).toEqual({
      appEnv: 'staging',
      port: 8080,
      log: { level: 'debug', pretty: true },
      db: {
        host: 'db.internal',
        port: 5433,
        database: 'fphd_staging',
        user: 'public_api',
        password: 'pw',
      },
    });
  });

  it('throws naming the missing password', () => {
    expect(() => loadConfig({})).toThrow(/PUBLIC_API_PASSWORD/);
  });

  it('rejects an invalid PORT', () => {
    expect(() => loadConfig({ PUBLIC_API_PASSWORD: 'pw', PORT: 'abc' })).toThrow(/PORT/);
  });

  it('reports all problems in one error', () => {
    expect(() => loadConfig({ PORT: '999999' })).toThrow(/PORT[\s\S]*PUBLIC_API_PASSWORD/);
  });
});
