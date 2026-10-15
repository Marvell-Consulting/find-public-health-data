import { execFile } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createServer, type Server } from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { Agent } from 'undici';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest';

import { type DownloadResume, downloadFile } from './download.ts';

let directory: string;
let server: Server;
let url: string;
let cert: Buffer;
let dispatcher: Agent;
let handle: (request: IncomingMessage, response: ServerResponse) => void;
const contents = Buffer.from('0123456789abcdefghij');

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'fphd-download-'));
  await promisify(execFile)('openssl', [
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-nodes',
    '-keyout',
    join(directory, 'key.pem'),
    '-out',
    join(directory, 'cert.pem'),
    '-days',
    '1',
    '-subj',
    '/CN=localhost',
    '-addext',
    'subjectAltName=DNS:localhost,IP:127.0.0.1',
  ]);
  cert = await readFile(join(directory, 'cert.pem'));
  server = createServer(
    { key: await readFile(join(directory, 'key.pem')), cert },
    (request, response) => handle(request, response),
  );
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing HTTPS listener');
  url = `https://127.0.0.1:${address.port}/package`;
});
beforeEach(() => {
  dispatcher = new Agent({ connect: { ca: cert } });
});
afterEach(async () => {
  await dispatcher.close();
});
afterAll(async () => {
  await promisify(server.close.bind(server))();
  await rm(directory, { recursive: true });
});

function drop(response: ServerResponse, etag?: string) {
  response.writeHead(200, { 'content-length': contents.length, ...(etag ? { etag } : {}) });
  response.write(contents.subarray(0, 8));
  setTimeout(() => response.destroy(), 20);
}
function download(
  options: { attempts?: number; onResume?: (resume: DownloadResume) => void } = {},
) {
  return downloadFile(url, join(directory, 'package'), 'Package', {
    dispatcher,
    retryDelayMs: 0,
    ...options,
  });
}

it('resumes a dropped response from its delivered bytes with its original ETag', async () => {
  const requests: { range: string | undefined; match: string | undefined }[] = [];
  handle = (request, response) => {
    requests.push({ range: request.headers.range, match: request.headers['if-match'] });
    if (!request.headers.range) return drop(response, '"v1"');
    response.writeHead(206, {
      etag: '"v1"',
      'content-range': 'bytes 8-19/20',
      'content-length': 12,
    });
    response.end(contents.subarray(8));
  };
  const resumes: DownloadResume[] = [];
  await download({ onResume: (resume) => resumes.push(resume) });
  expect(await readFile(join(directory, 'package'))).toEqual(contents);
  expect(requests).toEqual([
    { range: undefined, match: undefined },
    { range: 'bytes=8-19', match: '"v1"' },
  ]);
  expect(resumes).toMatchObject([{ attempt: 1, bytes: 8 }]);
});
it('restarts whole when a server ignores the range', async () => {
  let calls = 0;
  handle = (_request, response) => {
    if (++calls === 1) return drop(response, '"v1"');
    response.writeHead(200, { etag: '"v1"' });
    response.end(contents);
  };
  await download();
  expect(await readFile(join(directory, 'package'))).toEqual(contents);
  expect(calls).toBe(3);
});
it.each([undefined, 'W/"v1"'])('restarts whole without a strong ETag: %s', async (etag) => {
  let calls = 0;
  handle = (request, response) => {
    expect(request.headers.range).toBeUndefined();
    if (++calls === 1) return drop(response, etag);
    response.end(contents);
  };
  await download();
  expect(calls).toBe(2);
  expect(await readFile(join(directory, 'package'))).toEqual(contents);
});
it('refuses an object changed during resumption', async () => {
  handle = (request, response) => {
    if (!request.headers.range) return drop(response, '"v1"');
    response.writeHead(412);
    response.end();
  };
  await expect(download()).rejects.toThrow('Package changed during download');
});
it.each([undefined, 'bytes 7-19/20'])(
  'rejects a missing or incorrect Content-Range: %s',
  async (range) => {
    handle = (request, response) => {
      if (!request.headers.range) return drop(response, '"v1"');
      response.writeHead(206, { etag: '"v1"', ...(range ? { 'content-range': range } : {}) });
      response.end(contents.subarray(8));
    };
    await expect(download()).rejects.toThrow('Content-Range mismatch');
  },
);
it('rejects a changed ETag even when the server ignores If-Match', async () => {
  handle = (request, response) => {
    if (!request.headers.range) return drop(response, '"v1"');
    response.writeHead(206, { etag: '"v2"', 'content-range': 'bytes 8-19/20' });
    response.end(contents.subarray(8));
  };
  await expect(download()).rejects.toThrow('ETag mismatch');
});
it('retries a temporary HTTP error', async () => {
  let calls = 0;
  handle = (_request, response) => {
    response.writeHead(++calls === 1 ? 503 : 200);
    response.end(contents);
  };
  await download();
  expect(calls).toBe(2);
});
it('does not retry a permanent HTTP error', async () => {
  let calls = 0;
  handle = (_request, response) => {
    calls += 1;
    response.writeHead(403);
    response.end();
  };
  await expect(download()).rejects.toThrow('HTTP 403');
  expect(calls).toBe(1);
});
it('stops after the configured number of dropped attempts', async () => {
  let calls = 0;
  handle = (_request, response) => {
    calls += 1;
    drop(response);
  };
  await expect(download({ attempts: 3 })).rejects.toThrow();
  expect(calls).toBe(3);
});
it('rejects an HTTPS downgrade before contacting the redirect target', async () => {
  handle = (_request, response) => {
    response.writeHead(302, { location: 'http://127.0.0.1:1/insecure' });
    response.end();
  };
  await expect(download()).rejects.toThrow('redirected away from HTTPS');
});
it('follows a redirect to another HTTPS path', async () => {
  handle = (request, response) => {
    if (request.url === '/package') {
      response.writeHead(302, { location: '/final' });
      response.end();
    } else response.end(contents);
  };
  await download();
  expect(await readFile(join(directory, 'package'))).toEqual(contents);
});
