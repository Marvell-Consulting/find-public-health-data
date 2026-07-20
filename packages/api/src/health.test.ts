import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { healthHandler } from './health.js';

describe('healthHandler', () => {
  it('reports the named service as healthy', async () => {
    const app = express().get('/health', healthHandler({ service: 'test-api' }));

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', service: 'test-api' });
  });
});
