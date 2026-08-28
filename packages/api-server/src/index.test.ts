import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { addNotFoundHandler, createApiApp } from './index.js';

describe('API server', () => {
  // The probes themselves are `@fphd/express`'s; this only asserts an API app is built on it,
  // and passes its own name through.
  it('serves the shared probes under its own service name', async () => {
    const app = createApiApp('test-api');

    const live = await request(app).get('/livez');
    const ready = await request(app).get('/readyz');

    expect(live.status).toBe(200);
    expect(ready.status).toBe(200);
    expect(live.body).toEqual({ status: 'ok', service: 'test-api' });
  });

  it('sends the security headers that apply to a JSON response too', async () => {
    const app = createApiApp('test-api');

    const response = await request(app).get('/api');

    expect(response.headers['strict-transport-security']).toBe(
      'max-age=31536000; includeSubDomains',
    );
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('serves only the shared public route table', async () => {
    const app = createApiApp('test-api');
    addNotFoundHandler(app);

    const publicResponse = await request(app).get('/api');
    const internalResponse = await request(app).get('/api/internal');

    expect(publicResponse.status).toBe(200);
    expect(internalResponse.status).toBe(404);
  });
});
