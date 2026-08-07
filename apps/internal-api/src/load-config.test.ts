import { describe, expect, it } from 'vitest';

import { loadConfig } from './load-config.js';

describe('loadConfig', () => {
  const sessionSecret = 'a-jwt-session-secret-that-is-long-enough';
  const local = {
    APP_ENV: 'local',
    INTERNAL_API_PASSWORD: 'pw',
    SESSION_JWT_SECRET: sessionSecret,
  };

  it('applies local defaults when only APP_ENV, the password and the secret are set', () => {
    expect(loadConfig({ ...local })).toEqual({
      appEnv: 'local',
      host: '0.0.0.0',
      port: 4001,
      log: { level: 'info', pretty: true },
      shutdown: { drainMs: 0 },
      session: { secret: sessionSecret, secure: false },
      db: {
        host: 'localhost',
        port: 5432,
        database: 'fphd',
        user: 'internal_api',
        password: 'pw',
        ssl: false,
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
      shutdown: { drainMs: 5_000 },
      session: { secret: sessionSecret, secure: true },
      db: {
        host: 'db.internal',
        port: 5433,
        database: 'fphd_prod',
        user: 'internal_api',
        password: 'pw',
        ssl: true,
      },
    });
  });

  it('turns database TLS on everywhere but this machine, and lets DB_TLS override', () => {
    expect(loadConfig({ ...local }).db.ssl).toBe(false);
    expect(loadConfig({ ...local, APP_ENV: 'test' }).db.ssl).toBe(false);
    expect(loadConfig({ ...local, APP_ENV: 'dev' }).db.ssl).toBe(true);
    expect(loadConfig({ ...local, APP_ENV: 'production' }).db.ssl).toBe(true);
    expect(loadConfig({ ...local, DB_TLS: '1' }).db.ssl).toBe(true);
    expect(loadConfig({ ...local, APP_ENV: 'production', DB_TLS: '0' }).db.ssl).toBe(false);
  });

  it('secures session cookies everywhere but this machine', () => {
    expect(loadConfig({ ...local }).session.secure).toBe(false);
    expect(loadConfig({ ...local, APP_ENV: 'test' }).session.secure).toBe(false);
    expect(loadConfig({ ...local, APP_ENV: 'dev' }).session.secure).toBe(true);
  });

  it('allows pretty logging only locally, where it defaults on', () => {
    expect(loadConfig({ ...local }).log.pretty).toBe(true);
    expect(loadConfig({ ...local, LOG_PRETTY: '0' }).log.pretty).toBe(false);
    expect(loadConfig({ ...local, APP_ENV: 'dev' }).log.pretty).toBe(false);
    // pino-pretty is absent from deployed installs; LOG_PRETTY must not be able to force it.
    expect(loadConfig({ ...local, APP_ENV: 'dev', LOG_PRETTY: '1' }).log.pretty).toBe(false);
  });

  it('requires APP_ENV rather than assuming the environment that relaxes TLS', () => {
    expect(() =>
      loadConfig({ INTERNAL_API_PASSWORD: 'pw', SESSION_JWT_SECRET: sessionSecret }),
    ).toThrow(/APP_ENV/);
  });

  it('throws naming the missing password', () => {
    expect(() => loadConfig({ APP_ENV: 'local', SESSION_JWT_SECRET: sessionSecret })).toThrow(
      /INTERNAL_API_PASSWORD/,
    );
  });

  it('rejects an invalid PORT', () => {
    expect(() => loadConfig({ ...local, PORT: 'abc' })).toThrow(/PORT/);
  });

  it('requires a JWT session secret', () => {
    expect(() => loadConfig({ APP_ENV: 'local', INTERNAL_API_PASSWORD: 'pw' })).toThrow(
      /SESSION_JWT_SECRET/,
    );
  });
});
