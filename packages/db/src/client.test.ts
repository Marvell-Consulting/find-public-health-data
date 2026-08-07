import { describe, expect, it } from 'vitest';

import { createPostgresClient, type DbConnection } from './client.js';

// postgres.js connects lazily, so building a client touches no database.
const connection: DbConnection = {
  host: 'db.example',
  port: 5432,
  database: 'fphd',
  user: 'public_api',
  password: 'pw',
  ssl: true,
};

describe('createPostgresClient', () => {
  it('passes ssl through as a boolean, never a string postgres.js would downgrade', () => {
    expect(createPostgresClient(connection).options.ssl).toBe(true);
    expect(createPostgresClient({ ...connection, ssl: false }).options.ssl).toBe(false);
  });

  it('does not let the options bag reach a connection field', () => {
    // Deliberately ill-typed: the type already forbids this, and the point of the test is
    // that the runtime does too, so a caller cannot turn TLS back off through the back door.
    const client = createPostgresClient(connection, {
      ssl: false,
      host: 'attacker.example',
    } as never);

    expect(client.options.ssl).toBe(true);
    expect(client.options.host).toEqual(['db.example']);
  });

  it('still applies options that name no connection field', () => {
    const client = createPostgresClient(connection, { max: 1 });

    expect(client.options.max).toBe(1);
    expect(client.options.ssl).toBe(true);
  });
});
