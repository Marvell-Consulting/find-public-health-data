import { createHash } from 'node:crypto';
import { createServer, request as httpRequest } from 'node:http';
import type { AddressInfo } from 'node:net';
import { text } from 'node:stream/consumers';

import { request } from '@fphd/express/testing';
import { BlobNotFoundError, type BlobStorage } from '@fphd/internal-storage';
import { createFakeBlobStorage } from '@fphd/internal-storage/testing';
import express from 'express';
import { describe, expect, it } from 'vitest';

import { DATA_TABLE_MESSAGES } from './data-upload-contract.ts';
import { receiveDataTable, UploadAbortedError } from './data-upload-receive.ts';

const BLOB = 'indicator-1/batch-1.csv';
const CSV = 'area_code,period_start,period_end,value\nE92000001,2019-04-01,2020-03-31,83.8\n';

/** An app answering with what `receiveDataTable` made of the request, or the error it threw. */
function createTestApp(storage: BlobStorage, maxBytes?: number) {
  const app = express();
  app.post('/upload', async (req, res) => {
    try {
      res.json(await receiveDataTable(req, storage, BLOB, maxBytes));
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });
  return app;
}

describe('receiveDataTable', () => {
  it('stores the file under the name given, with its name, size and SHA-256', async () => {
    const storage = createFakeBlobStorage();

    const response = await request(createTestApp(storage))
      .post('/upload')
      .attach('dataTable', Buffer.from(CSV), 'life-expectancy.csv');

    expect(response.body).toEqual({
      ok: true,
      originalFilename: 'life-expectancy.csv',
      byteSize: Buffer.byteLength(CSV),
      sha256: createHash('sha256').update(CSV).digest('hex'),
    });
    expect(await text(await storage.get(BLOB))).toBe(CSV);
  });

  it('accepts a CSV whatever the case of its extension', async () => {
    const response = await request(createTestApp(createFakeBlobStorage()))
      .post('/upload')
      .attach('dataTable', Buffer.from(CSV), 'DATA.CSV');

    expect(response.body.ok).toBe(true);
  });

  it('ignores other fields and files', async () => {
    const storage = createFakeBlobStorage();

    const response = await request(createTestApp(storage))
      .post('/upload')
      .field('note', 'hello')
      .attach('other', Buffer.from('not this'), 'other.csv')
      .attach('dataTable', Buffer.from(CSV), 'data.csv');

    expect(response.body.ok).toBe(true);
    expect(await text(await storage.get(BLOB))).toBe(CSV);
  });

  it('stores the file and ignores the parts beyond the limit of ten', async () => {
    const storage = createFakeBlobStorage();
    const test = request(createTestApp(storage))
      .post('/upload')
      .attach('dataTable', Buffer.from(CSV), 'data.csv');
    for (let part = 0; part < 12; part += 1) test.field(`extra${part}`, 'x');

    const response = await test;

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(await text(await storage.get(BLOB))).toBe(CSV);
  });

  it('asks for a file when it comes after the limit of ten parts', async () => {
    const storage = createFakeBlobStorage();
    const test = request(createTestApp(storage)).post('/upload');
    for (let part = 0; part < 12; part += 1) test.field(`extra${part}`, 'x');

    const response = await test.attach('dataTable', Buffer.from(CSV), 'data.csv');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: false, message: DATA_TABLE_MESSAGES.missing });
    await expect(storage.get(BLOB)).rejects.toThrow(BlobNotFoundError);
  });

  it('asks for a file when the form has none', async () => {
    const response = await request(createTestApp(createFakeBlobStorage()))
      .post('/upload')
      .field('note', 'hello');

    expect(response.body).toEqual({ ok: false, message: DATA_TABLE_MESSAGES.missing });
  });

  it('asks for a file when none was chosen, as a browser sends an empty file part', async () => {
    const response = await request(createTestApp(createFakeBlobStorage()))
      .post('/upload')
      .set('Content-Type', 'multipart/form-data; boundary=b')
      .send(
        '--b\r\nContent-Disposition: form-data; name="dataTable"; filename=""\r\n' +
          'Content-Type: application/octet-stream\r\n\r\n\r\n--b--\r\n',
      );

    expect(response.body).toEqual({ ok: false, message: DATA_TABLE_MESSAGES.missing });
  });

  it('asks for a file when the file part has no filename at all', async () => {
    const response = await request(createTestApp(createFakeBlobStorage()))
      .post('/upload')
      .set('Content-Type', 'multipart/form-data; boundary=b')
      .send(
        '--b\r\nContent-Disposition: form-data; name="dataTable"\r\n' +
          `Content-Type: application/octet-stream\r\n\r\n${CSV}\r\n--b--\r\n`,
      );

    expect(response.body).toEqual({ ok: false, message: DATA_TABLE_MESSAGES.missing });
  });

  it('asks for a file when the body is not a multipart form', async () => {
    const response = await request(createTestApp(createFakeBlobStorage()))
      .post('/upload')
      .send({ dataTable: CSV });

    expect(response.body).toEqual({ ok: false, message: DATA_TABLE_MESSAGES.missing });
  });

  it('asks for a file when the form is cut short, storing nothing', async () => {
    const storage = createFakeBlobStorage();

    const response = await request(createTestApp(storage))
      .post('/upload')
      .set('Content-Type', 'multipart/form-data; boundary=b')
      .send(
        `--b\r\nContent-Disposition: form-data; name="dataTable"; filename="data.csv"\r\n\r\n${CSV}`,
      );

    expect(response.body).toEqual({ ok: false, message: DATA_TABLE_MESSAGES.missing });
    await expect(storage.get(BLOB)).rejects.toThrow(BlobNotFoundError);
  });

  it('refuses a file that is not a CSV, storing nothing', async () => {
    const storage = createFakeBlobStorage();

    const response = await request(createTestApp(storage))
      .post('/upload')
      .attach('dataTable', Buffer.from(CSV), 'data.xlsx');

    expect(response.body).toEqual({ ok: false, message: DATA_TABLE_MESSAGES.notCsv });
    await expect(storage.get(BLOB)).rejects.toThrow(BlobNotFoundError);
  });

  it('refuses an empty file', async () => {
    const response = await request(createTestApp(createFakeBlobStorage()))
      .post('/upload')
      .attach('dataTable', Buffer.alloc(0), 'data.csv');

    expect(response.body).toEqual({ ok: false, message: DATA_TABLE_MESSAGES.empty });
  });

  it('refuses a file over the limit, storing nothing, and reads the request to its end', async () => {
    const storage = createFakeBlobStorage();

    const response = await request(createTestApp(storage, 10))
      .post('/upload')
      .attach('dataTable', Buffer.from(CSV.repeat(1000)), 'data.csv')
      .field('after', 'the file');

    expect(response.body).toEqual({ ok: false, message: DATA_TABLE_MESSAGES.tooLarge });
    await expect(storage.get(BLOB)).rejects.toThrow(BlobNotFoundError);
  });

  it('rejects with the error when storage fails, having read the request', async () => {
    const storage: BlobStorage = {
      ...createFakeBlobStorage(),
      put: async () => {
        throw new Error('storage is down');
      },
    };

    const response = await request(createTestApp(storage))
      .post('/upload')
      .attach('dataTable', Buffer.from(CSV.repeat(1000)), 'data.csv');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ error: 'Error: storage is down' });
  });

  it('rejects as abandoned, storing nothing, when the request stops part way', async () => {
    const storage = createFakeBlobStorage();
    let outcome: Promise<unknown> | undefined;
    const server = createServer((req) => {
      outcome = receiveDataTable(req, storage, BLOB).catch((error: unknown) => error);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

    const client = httpRequest({
      host: '127.0.0.1',
      port: (server.address() as AddressInfo).port,
      method: 'POST',
      path: '/upload',
      headers: { 'content-type': 'multipart/form-data; boundary=b' },
    });
    client.on('error', () => {});
    client.write(
      `--b\r\nContent-Disposition: form-data; name="dataTable"; filename="data.csv"\r\n\r\n${CSV}`,
    );
    await expect.poll(() => outcome !== undefined).toBe(true);
    client.destroy();

    expect(await outcome).toBeInstanceOf(UploadAbortedError);
    await expect(storage.get(BLOB)).rejects.toThrow(BlobNotFoundError);
    server.close();
  });
});
