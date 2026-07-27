import type { Database } from '@fphd/db';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from './app.js';

// Routes under test never touch the database; integration tests cover the real one.
const db = {} as Database;

describe('public API', () => {
  it('reports its health', async () => {
    const response = await request(createApp({ db })).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', service: 'public-api' });
  });

  it('does not expose the internal surface', async () => {
    const response = await request(createApp({ db })).get('/api/internal');

    expect(response.status).toBe(404);
  });
});
