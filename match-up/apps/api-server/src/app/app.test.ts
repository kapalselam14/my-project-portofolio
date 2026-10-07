import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../database/firebase.js', () => {
  return {
    checkFirestoreConnection: vi.fn().mockResolvedValue(undefined),
  };
});

import { createApp } from './app.js';

describe('createApp', () => {
  it('returns healthy response from GET /health', async () => {
    const app = createApp();

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      data: {
        status: 'ok',
        service: 'api-server',
        database: 'connected',
      },
    });
  });

  it('returns 503 from GET /health when database is unavailable', async () => {
    const { checkFirestoreConnection } = await import('../database/firebase.js');
    vi.mocked(checkFirestoreConnection).mockRejectedValueOnce(new Error('DB down'));

    const app = createApp();

    const response = await request(app).get('/api/health');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      ok: false,
      error: {
        code: 'DB_UNAVAILABLE',
        message: 'Firestore unreachable',
      },
    });
  });
});

describe('unknown /api/* routes', () => {
  it('GET unknown path returns the JSON 404 envelope (not Express HTML)', async () => {
    const app = createApp();

    const response = await request(app).get('/api/no-such-route');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      ok: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Not found',
      },
    });
  });

  it('POST unknown path returns the JSON 404 envelope', async () => {
    const app = createApp();

    const response = await request(app).post('/api/no-such-route').send({});

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      ok: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Not found',
      },
    });
  });

  it('passes through the global rate limiter', async () => {
    const app = createApp();

    const response = await request(app).get('/api/no-such-route');

    expect(response.status).toBe(404);
    expect(response.headers['ratelimit-limit']).toBe('1200');
  });
});

describe('request body handling', () => {
  it('malformed JSON returns the 400 envelope (not Express HTML)', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/api/no-such-route')
      .set('Content-Type', 'application/json')
      .send('{"broken":');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      ok: false,
      error: {
        code: 'INVALID_INPUT',
        message: 'Invalid JSON body',
      },
    });
  });
});
