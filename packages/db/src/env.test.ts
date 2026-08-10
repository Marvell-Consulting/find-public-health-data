import { parseEnv, z } from '@fphd/config';
import { describe, expect, it } from 'vitest';

import { dbEnvFields, resolveDbTls } from './env.js';

describe('dbEnvFields', () => {
  const schema = z.object(dbEnvFields);

  it('defaults to the local docker compose database', () => {
    expect(parseEnv(schema, {})).toEqual({
      DB_HOST: 'localhost',
      DB_PORT: 5432,
      POSTGRES_DB: 'fphd',
    });
  });

  it('reads overrides from the environment', () => {
    expect(
      parseEnv(schema, { DB_HOST: 'db.internal', DB_PORT: '5433', POSTGRES_DB: 'fphd_test' }),
    ).toEqual({
      DB_HOST: 'db.internal',
      DB_PORT: 5433,
      POSTGRES_DB: 'fphd_test',
    });
  });

  it('rejects an invalid DB_PORT with a clear config error', () => {
    expect(() => parseEnv(schema, { DB_PORT: 'abc' })).toThrow(/DB_PORT/);
  });

  it('leaves DB_TLS undefined when unset, so the APP_ENV default decides', () => {
    expect(parseEnv(schema, {}).DB_TLS).toBeUndefined();
    expect(parseEnv(schema, { DB_TLS: '1' }).DB_TLS).toBe(true);
    expect(parseEnv(schema, { DB_TLS: 'false' }).DB_TLS).toBe(false);
  });
});

describe('resolveDbTls', () => {
  it('is off only where the database runs on this machine', () => {
    expect(resolveDbTls('local', undefined)).toBe(false);
    expect(resolveDbTls('test', undefined)).toBe(false);
  });

  it('is on for an environment it has never heard of', () => {
    // appEnvSchema is what rejects an unknown value; if one ever reaches here the safe
    // reading is that it is deployed.
    expect(resolveDbTls('staging' as never, undefined)).toBe(true);
  });

  it('is on for every deployed environment', () => {
    expect(resolveDbTls('dev', undefined)).toBe(true);
    expect(resolveDbTls('preview', undefined)).toBe(true);
    expect(resolveDbTls('production', undefined)).toBe(true);
  });

  it('lets DB_TLS override the default in both directions', () => {
    expect(resolveDbTls('local', true)).toBe(true);
    expect(resolveDbTls('production', false)).toBe(false);
  });
});
