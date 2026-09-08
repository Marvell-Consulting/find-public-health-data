import { Writable } from 'node:stream';

import { createLogger } from '@fphd/logger';
import { pino } from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { addNotFoundHandler, createApiApp } from './index.js';

const logger = createLogger({ name: 'test-api', level: 'silent' });

describe('API server', () => {
  // The probes themselves are `@fphd/express`'s; this only asserts an API app is built on it,
  // and passes its own name through.
  it('serves the shared probes under its own service name', async () => {
    const app = createApiApp({ logger, serviceName: 'test-api' });

    const live = await request(app).get('/livez');
    const ready = await request(app).get('/readyz');

    expect(live.status).toBe(200);
    expect(ready.status).toBe(200);
    expect(live.body).toEqual({ status: 'ok', service: 'test-api' });
  });

  it('sends the security headers that apply to a JSON response too', async () => {
    const app = createApiApp({ logger, serviceName: 'test-api' });

    const response = await request(app).get('/api');

    expect(response.headers['strict-transport-security']).toBe(
      'max-age=31536000; includeSubDomains',
    );
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('serves only the shared public route table', async () => {
    const app = createApiApp({ logger, serviceName: 'test-api' });
    addNotFoundHandler(app);

    const publicResponse = await request(app).get('/api');
    const internalResponse = await request(app).get('/api/internal');

    expect(publicResponse.status).toBe(200);
    expect(internalResponse.status).toBe(404);
  });

  // The line's shape is `@fphd/express`'s; this asserts an API app writes one at all, under its
  // own name, which is what FPH-316's verification found missing.
  it('logs each request through the logger it was given', async () => {
    const lines: Record<string, unknown>[] = [];
    const destination = new Writable({
      write(chunk, _encoding, callback) {
        lines.push(JSON.parse(String(chunk)));
        callback();
      },
    });
    const app = createApiApp({
      logger: pino({ name: 'test-api' }, destination),
      serviceName: 'test-api',
    });
    addNotFoundHandler(app);

    await request(app).get('/api');
    await request(app).get('/api/nowhere');
    await request(app).get('/livez');
    await new Promise((resolve) => setImmediate(resolve));

    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ name: 'test-api', req: { method: 'GET', url: '/api' } });
    expect(lines[1]).toMatchObject({ res: { statusCode: 404 } });
  });
});
