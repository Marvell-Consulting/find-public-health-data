import { describe, expect, it } from 'vitest';

import { loadConfig } from './load-config.js';

describe('loadConfig', () => {
  it('applies local defaults when only the password is set', () => {
    expect(loadConfig({ PUBLIC_API_PASSWORD: 'pw' })).toEqual({
      appEnv: 'local',
      host: '0.0.0.0',
      port: 4000,
      log: { level: 'info', pretty: true },
      db: { host: 'localhost', port: 5432, database: 'fphd', user: 'public_api', password: 'pw' },
    });
  });

  it('reads every value from the environment', () => {
    const config = loadConfig({
      APP_ENV: 'preview',
      HOST: '127.0.0.1',
      PORT: '8080',
      LOG_LEVEL: 'debug',
      LOG_PRETTY: '1',
      DB_HOST: 'db.internal',
      DB_PORT: '5433',
      POSTGRES_DB: 'fphd_preview',
      PUBLIC_API_PASSWORD: 'pw',
    });

    expect(config).toEqual({
      appEnv: 'preview',
      host: '127.0.0.1',
      port: 8080,
      log: { level: 'debug', pretty: false },
      db: {
        host: 'db.internal',
        port: 5433,
        database: 'fphd_preview',
        user: 'public_api',
        password: 'pw',
      },
    });
  });

  it('allows pretty logging only locally, where it defaults on', () => {
    const env = { PUBLIC_API_PASSWORD: 'pw' };
    expect(loadConfig({ ...env }).log.pretty).toBe(true);
    expect(loadConfig({ ...env, LOG_PRETTY: '0' }).log.pretty).toBe(false);
    expect(loadConfig({ ...env, APP_ENV: 'production' }).log.pretty).toBe(false);
    // pino-pretty is absent from deployed installs; LOG_PRETTY must not be able to force it.
    expect(loadConfig({ ...env, APP_ENV: 'production', LOG_PRETTY: '1' }).log.pretty).toBe(false);
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
