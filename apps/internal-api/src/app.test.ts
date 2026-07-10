import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from './app.js';

describe('internal API', () => {
  it('includes the public surface', async () => {
    const response = await request(createApp()).get('/api');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ audience: 'public' });
  });

  it('includes its internal-only surface', async () => {
    const response = await request(createApp()).get('/api/internal');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ audience: 'internal' });
  });
});
