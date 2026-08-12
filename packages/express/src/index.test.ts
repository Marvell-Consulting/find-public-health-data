import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createBaseApp } from './index.js';

describe('createBaseApp', () => {
  it('answers both probes while it is serving normally', async () => {
    const app = createBaseApp({ serviceName: 'public-api' });

    const live = await request(app).get('/livez');
    const ready = await request(app).get('/readyz');

    expect(live.status).toBe(200);
    expect(ready.status).toBe(200);
    expect(live.body).toEqual({ status: 'ok', service: 'public-api' });
    expect(ready.body).toEqual({ status: 'ok', service: 'public-api' });
  });

  it('fails readiness while draining but stays alive, so the stop is not cut short', async () => {
    const app = createBaseApp({ serviceName: 'public-api' });
    app.locals.draining = true;

    const ready = await request(app).get('/readyz');
    const live = await request(app).get('/livez');

    expect(ready.status).toBe(503);
    expect(ready.body).toEqual({ status: 'draining', service: 'public-api' });
    expect(live.status).toBe(200);
  });

  it('names the app that answered, where four sit behind one front door', async () => {
    const app = createBaseApp({ serviceName: 'internal-web' });

    expect((await request(app).get('/livez')).body.service).toBe('internal-web');
  });

  it('does not advertise the framework', async () => {
    const app = createBaseApp({ serviceName: 'public-api' });

    expect((await request(app).get('/livez')).headers['x-powered-by']).toBeUndefined();
  });

  it('sends the headers that carry no policy decision, on every response', async () => {
    const app = createBaseApp({ serviceName: 'public-api' });
    app.get('/anything', (_request, response) => response.json({}));

    const response = await request(app).get('/anything');

    expect(response.headers['strict-transport-security']).toBe(
      'max-age=31536000; includeSubDomains',
    );
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });

  // CSP and X-Frame-Options need an HTML document to mean anything, so they are the web
  // server's own and an API must not be given them here.
  it('leaves the document-only headers to whatever serves documents', async () => {
    const app = createBaseApp({ serviceName: 'public-api' });

    const response = await request(app).get('/livez');

    expect(response.headers['content-security-policy']).toBeUndefined();
    expect(response.headers['x-frame-options']).toBeUndefined();
  });
});
