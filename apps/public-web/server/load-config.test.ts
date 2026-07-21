import { describe, expect, it } from 'vitest';

import { loadConfig } from './load-config.ts';

describe('loadConfig', () => {
  it('applies local defaults when nothing is set', () => {
    expect(loadConfig({})).toEqual({
      appEnv: 'local',
      development: false,
      host: '0.0.0.0',
      port: 3000,
      log: { level: 'info', pretty: true },
    });
  });

  it('reads every value from the environment', () => {
    const config = loadConfig({
      APP_ENV: 'preview',
      HOST: '127.0.0.1',
      NODE_ENV: 'development',
      PORT: '8080',
      LOG_LEVEL: 'debug',
      LOG_PRETTY: '1',
    });

    expect(config).toEqual({
      appEnv: 'preview',
      development: true,
      host: '127.0.0.1',
      port: 8080,
      log: { level: 'debug', pretty: false },
    });
  });

  it('allows pretty logging only locally, where it defaults on', () => {
    expect(loadConfig({}).log.pretty).toBe(true);
    expect(loadConfig({ LOG_PRETTY: '0' }).log.pretty).toBe(false);
    expect(loadConfig({ APP_ENV: 'production' }).log.pretty).toBe(false);
    // pino-pretty is absent from deployed installs; LOG_PRETTY must not be able to force it.
    expect(loadConfig({ APP_ENV: 'production', LOG_PRETTY: '1' }).log.pretty).toBe(false);
  });

  it('treats a blank PORT as unset, so the default still applies', () => {
    expect(loadConfig({ PORT: '' }).port).toBe(3000);
  });

  it('rejects an invalid PORT', () => {
    expect(() => loadConfig({ PORT: 'abc' })).toThrow(/PORT/);
  });

  it('reports all problems in one error', () => {
    expect(() => loadConfig({ APP_ENV: 'staging', PORT: '999999' })).toThrow(/APP_ENV[\s\S]*PORT/);
  });
});
