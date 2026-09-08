import { Writable } from 'node:stream';

import express from 'express';
import { pino } from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createBaseApp, requestLogging } from './index.js';

function createCapturingLogger() {
  const lines: Record<string, unknown>[] = [];
  const destination = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(JSON.parse(String(chunk)));
      callback();
    },
  });

  return { logger: pino({ name: 'public-web' }, destination), lines };
}

function createApp() {
  const { logger, lines } = createCapturingLogger();
  const app = createBaseApp({ serviceName: 'public-web' });
  app.use(requestLogging(logger));
  app.get('/topics', (_request, response) => response.json({}));
  app.get('/broken', (_request, response) => response.status(500).send('no'));
  app.use((_request, response) => response.status(404).send('missing'));

  return { app, lines };
}

async function settled(lines: unknown[]) {
  // The line is written on the response's 'finish' event, after supertest has resolved.
  await new Promise((resolve) => setImmediate(resolve));
  return lines;
}

describe('requestLogging', () => {
  it('writes one line per request, in the shape the rest of the log already has', async () => {
    const { app, lines } = createApp();

    await request(app).get('/topics?page=2');

    expect(await settled(lines)).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      level: 30,
      name: 'public-web',
      req: { method: 'GET', url: '/topics?page=2' },
      res: { statusCode: 200 },
    });
    expect(lines[0]).toHaveProperty('time');
    expect(lines[0]?.responseTime).toBeTypeOf('number');
  });

  it('keeps headers out of the line, since the session cookie travels in one', async () => {
    const { app, lines } = createApp();

    await request(app).get('/topics').set('Cookie', 'session=secret');
    await settled(lines);

    expect(JSON.stringify(lines[0])).not.toContain('secret');
    expect(lines[0]?.req).toEqual({ method: 'GET', url: '/topics' });
    expect(lines[0]?.res).toEqual({ statusCode: 200 });
  });

  it('logs a server error response at error level, and a miss at info', async () => {
    const { app, lines } = createApp();

    await request(app).get('/broken');
    await request(app).get('/nowhere');
    await settled(lines);

    expect(lines[0]).not.toHaveProperty('err');

    expect(
      lines.map((line) => [line.level, (line.res as { statusCode: number }).statusCode]),
    ).toEqual([
      [50, 500],
      [30, 404],
    ]);
  });

  // Mounted ahead of the probes, unlike createBaseApp's, so the middleware sees them and the
  // ignore is what keeps the log empty.
  it.each(['/livez', '/readyz', '/readyz?full=1'])('skips the probe at %s', async (path) => {
    const { logger, lines } = createCapturingLogger();
    const app = express();
    app.use(requestLogging(logger));
    app.get(['/livez', '/readyz'], (_request, response) => response.json({}));

    await request(app).get(path);

    expect(await settled(lines)).toHaveLength(0);
  });

  it('uses the request path as express sees it, whatever router served it', async () => {
    const { logger, lines } = createCapturingLogger();
    const app = express();
    app.use(requestLogging(logger));
    app.use(
      '/api',
      express.Router().get('/topics', (_request, response) => response.json({})),
    );

    await request(app).get('/api/topics');
    await settled(lines);

    expect(lines[0]?.req).toEqual({ method: 'GET', url: '/api/topics' });
  });
});
