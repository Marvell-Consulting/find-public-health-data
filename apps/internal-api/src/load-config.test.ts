import { describe, expect, it } from 'vitest';

import { loadConfig } from './load-config.js';

describe('loadConfig', () => {
  const sessionSecret = 'a-jwt-session-secret-that-is-long-enough';

  it('applies local defaults when only the password is set', () => {
    expect(loadConfig({ INTERNAL_API_PASSWORD: 'pw', SESSION_JWT_SECRET: sessionSecret })).toEqual({
      appEnv: 'local',
      host: '0.0.0.0',
      port: 4001,
      log: { level: 'info', pretty: true },
      session: { secret: sessionSecret, secure: false },
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
      HOST: '127.0.0.1',
      PORT: '8081',
      LOG_LEVEL: 'warn',
      LOG_PRETTY: 'false',
      DB_HOST: 'db.internal',
      DB_PORT: '5433',
      POSTGRES_DB: 'fphd_prod',
      INTERNAL_API_PASSWORD: 'pw',
      SESSION_JWT_SECRET: sessionSecret,
    });

    expect(config).toEqual({
      appEnv: 'production',
      host: '127.0.0.1',
      port: 8081,
      log: { level: 'warn', pretty: false },
      session: { secret: sessionSecret, secure: true },
      db: {
        host: 'db.internal',
        port: 5433,
        database: 'fphd_prod',
        user: 'internal_api',
        password: 'pw',
      },
    });
  });

  it('allows pretty logging only locally, where it defaults on', () => {
    const env = { INTERNAL_API_PASSWORD: 'pw', SESSION_JWT_SECRET: sessionSecret };
    expect(loadConfig({ ...env }).log.pretty).toBe(true);
    expect(loadConfig({ ...env, APP_ENV: 'dev' }).log.pretty).toBe(false);
    expect(loadConfig({ ...env, APP_ENV: 'dev', LOG_PRETTY: '1' }).log.pretty).toBe(false);
  });

  it('throws naming the missing password', () => {
    expect(() => loadConfig({ SESSION_JWT_SECRET: sessionSecret })).toThrow(
      /INTERNAL_API_PASSWORD/,
    );
  });

  it('rejects an invalid PORT', () => {
    expect(() =>
      loadConfig({
        INTERNAL_API_PASSWORD: 'pw',
        PORT: 'abc',
        SESSION_JWT_SECRET: sessionSecret,
      }),
    ).toThrow(/PORT/);
  });

  it('requires a JWT session secret', () => {
    expect(() => loadConfig({ INTERNAL_API_PASSWORD: 'pw' })).toThrow(/SESSION_JWT_SECRET/);
  });
});
