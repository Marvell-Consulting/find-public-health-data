import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { addNotFoundHandler, createApiApp } from './index.js';

describe('API server', () => {
  it('reports service health', async () => {
    const app = createApiApp('test-api');

    const health = await request(app).get('/health');
    const live = await request(app).get('/health/live');
    const ready = await request(app).get('/health/ready');

    expect(health.status).toBe(200);
    expect(health.body).toEqual({ status: 'ok', service: 'test-api' });
    expect(live.status).toBe(200);
    expect(ready.status).toBe(200);
  });

  it('fails readiness, but not health, once the server starts draining', async () => {
    const app = createApiApp('test-api');
    app.locals.draining = true;

    const ready = await request(app).get('/health/ready');

    expect(ready.status).toBe(503);
    expect(ready.body).toEqual({ status: 'draining', service: 'test-api' });
    expect((await request(app).get('/health')).status).toBe(200);
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
