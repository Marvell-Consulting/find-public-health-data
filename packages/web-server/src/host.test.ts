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
  writeFileSync(join(assetsDirectory, 'app-123.js'), 'console.log("loaded")');
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
  });

  it('serves hashed client assets with long-lived caching', async () => {
    const response = await request(app).get('/assets/app-123.js');

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it.each([
    '/healthcheck',
    '/healthcheck/live',
    '/healthcheck/ready',
  ])('reports server health at %s', async (path) => {
    const response = await request(app).get(path);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: 'success' });
  });

  it('passes document requests to the React Router server build', async () => {
    const response = await request(app).get('/releases').accept('text/html');

    expect(response.status).toBe(418);
    expect(response.text).toContain('Server rendered');
  });
});
