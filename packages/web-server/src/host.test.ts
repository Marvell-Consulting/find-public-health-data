import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createProductionHost } from './host.js';

const clientDirectory = mkdtempSync(join(tmpdir(), 'fphd-web-server-'));
const assetsDirectory = join(clientDirectory, 'assets');

beforeAll(() => {
  mkdirSync(assetsDirectory);
  // Over compression's 1KB threshold, so the gzip assertion below exercises it.
  writeFileSync(join(assetsDirectory, 'app-123.js'), `console.log("${'loaded '.repeat(200)}")`);
});

afterAll(() => {
  rmSync(clientDirectory, { force: true, recursive: true });
});

describe('React Router production host', () => {
  const app = createProductionHost({
    clientDirectory,
    requestHandler: (_request, response) => {
      response.status(418).type('html').send('<html><main>Server rendered</main></html>');
    },
    serviceName: 'test-web',
  });

  it('serves hashed client assets with long-lived caching', async () => {
    const response = await request(app).get('/assets/app-123.js');

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('compresses assets for clients that accept gzip', async () => {
    const response = await request(app).get('/assets/app-123.js').set('Accept-Encoding', 'gzip');

    expect(response.status).toBe(200);
    expect(response.headers['content-encoding']).toBe('gzip');
  });

  it('sets security headers on document responses', async () => {
    const response = await request(app).get('/topics').accept('text/html');

    expect(response.headers['strict-transport-security']).toBe(
      'max-age=31536000; includeSubDomains',
    );
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['content-security-policy']).toContain("script-src 'self' 'nonce-");
  });

  it('issues a fresh CSP nonce per request', async () => {
    const extractNonce = (policy: string | undefined) => policy?.match(/'nonce-([^']+)'/)?.[1];

    const first = await request(app).get('/topics').accept('text/html');
    const second = await request(app).get('/topics').accept('text/html');

    const firstNonce = extractNonce(first.headers['content-security-policy']);
    const secondNonce = extractNonce(second.headers['content-security-policy']);

    expect(firstNonce).toBeDefined();
    expect(secondNonce).toBeDefined();
    expect(firstNonce).not.toBe(secondNonce);
  });

  // The probes themselves are `@fphd/express`'s; this only asserts a web host is built on it,
  // rather than serving the React Router catch-all at those paths.
  it.each(['/livez', '/readyz'])('serves the shared probe at %s', async (path) => {
    const response = await request(app).get(path);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', service: 'test-web' });
  });

  it('passes document requests to the React Router server build', async () => {
    const response = await request(app).get('/topics').accept('text/html');

    expect(response.status).toBe(418);
    expect(response.text).toContain('Server rendered');
  });
});
