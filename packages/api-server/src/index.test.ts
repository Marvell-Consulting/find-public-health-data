import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { addNotFoundHandler, createApiApp } from './index.js';

describe('API server', () => {
  it('reports service health', async () => {
    const response = await request(createApiApp('test-api')).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', service: 'test-api' });
  });

  it('serves only the shared public route table', async () => {
    const app = createApiApp('test-api');
    addNotFoundHandler(app);

    const publicResponse = await request(app).get('/api');
    const internalResponse = await request(app).get('/api/internal');

    expect(publicResponse.status).toBe(200);
    expect(internalResponse.status).toBe(404);
  });

  it('rate-limits API routes without rate-limiting health checks', async () => {
    const app = createApiApp('test-api', {
      rateLimit: { limit: 2, windowMs: 60_000 },
    });

    expect((await request(app).get('/api')).status).toBe(200);
    expect((await request(app).get('/api')).status).toBe(200);

    const limitedResponse = await request(app).get('/api');
    expect(limitedResponse.status).toBe(429);
    expect(limitedResponse.get('RateLimit')).toBeDefined();

    expect((await request(app).get('/health')).status).toBe(200);
    expect((await request(app).get('/health')).status).toBe(200);
    expect((await request(app).get('/health')).status).toBe(200);
  });
});
