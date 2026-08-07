import { parseEnv, z } from '@fphd/config';
import { describe, expect, it } from 'vitest';

import { dbEnvFields, resolveDbSsl } from './env.js';

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

  it('leaves DB_SSL undefined when unset, so the APP_ENV default decides', () => {
    expect(parseEnv(schema, {}).DB_SSL).toBeUndefined();
    expect(parseEnv(schema, { DB_SSL: '1' }).DB_SSL).toBe(true);
    expect(parseEnv(schema, { DB_SSL: 'false' }).DB_SSL).toBe(false);
  });
});

describe('resolveDbSsl', () => {
  it('is off only where the database runs on this machine', () => {
    expect(resolveDbSsl('local', undefined)).toBe(false);
    expect(resolveDbSsl('test', undefined)).toBe(false);
  });

  it('is on for every deployed environment', () => {
    expect(resolveDbSsl('dev', undefined)).toBe(true);
    expect(resolveDbSsl('preview', undefined)).toBe(true);
    expect(resolveDbSsl('production', undefined)).toBe(true);
  });

  it('lets DB_SSL override the default in both directions', () => {
    expect(resolveDbSsl('local', true)).toBe(true);
    expect(resolveDbSsl('production', false)).toBe(false);
  });
});
