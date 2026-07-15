import { parseEnv, z } from '@fphd/config';
import { describe, expect, it } from 'vitest';

import { dbEnvFields } from './env.js';

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
});
