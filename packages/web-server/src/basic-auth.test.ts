import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { basicAuth } from './basic-auth.ts';

const app = express();
app.use(basicAuth({ username: 'preview', password: 'pass:word' }));
app.get('/', (_request, response) => {
  response.send('Protected');
});

describe('basicAuth', () => {
  it('lets through a request with the configured credentials', async () => {
    const response = await request(app).get('/').auth('preview', 'pass:word');

    expect(response.status).toBe(200);
    expect(response.text).toBe('Protected');
  });

  it('challenges a request without credentials', async () => {
    const response = await request(app).get('/');

    expect(response.status).toBe(401);
    expect(response.headers['www-authenticate']).toBe(
      'Basic realm="Find public health data", charset="UTF-8"',
    );
    expect(response.text).not.toContain('Protected');
  });

  it.each([
    ['a wrong password', 'preview', 'wrong'],
    ['a wrong username', 'someone', 'pass:word'],
    ['a password prefix', 'preview', 'pass'],
    ['empty credentials', '', ''],
  ])('refuses %s', async (_case, username, password) => {
    const response = await request(app).get('/').auth(username, password);

    expect(response.status).toBe(401);
    expect(response.headers['www-authenticate']).toMatch(/^Basic /);
  });

  it.each(['Bearer abc', 'Basic not-base64!', 'Basic bm9jb2xvbg=='])(
    'refuses the malformed header %s',
    async (header) => {
      const response = await request(app).get('/').set('Authorization', header);

      expect(response.status).toBe(401);
    },
  );
});
