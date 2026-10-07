import express, { type Request } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createRateLimiter, MemoryRateLimitStore } from './rate-limit.js';

function buildApp(options: {
  max: number;
  windowMs?: number;
  skip?: (req: Request) => boolean;
  trustProxy?: boolean;
}) {
  const app = express();
  if (options.trustProxy) {
    app.set('trust proxy', true);
  }
  app.use(
    createRateLimiter({
      windowMs: options.windowMs ?? 60_000,
      max: options.max,
      skip: options.skip,
    }),
  );
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, data: { status: 'ok' } });
  });
  app.get('/api/things', (_req, res) => {
    res.json({ ok: true, data: [] });
  });
  return app;
}

describe('createRateLimiter', () => {
  it('passes requests under the limit', async () => {
    const app = buildApp({ max: 3 });

    for (let i = 0; i < 3; i++) {
      const response = await request(app).get('/api/things');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ ok: true, data: [] });
    }
  });

  it('returns 429 with the RATE_LIMITED envelope once over the limit', async () => {
    const app = buildApp({ max: 2 });

    expect((await request(app).get('/api/things')).status).toBe(200);
    expect((await request(app).get('/api/things')).status).toBe(200);

    const limited = await request(app).get('/api/things');
    expect(limited.status).toBe(429);
    expect(limited.body).toEqual({
      ok: false,
      error: {
        code: 'RATE_LIMITED',
        message: expect.any(String),
      },
    });
    expect(limited.headers['retry-after']).toBeDefined();
  });

  it('resets the window after windowMs elapses', async () => {
    const app = buildApp({ max: 1, windowMs: 100 });

    expect((await request(app).get('/api/things')).status).toBe(200);
    expect((await request(app).get('/api/things')).status).toBe(429);

    await new Promise((resolve) => setTimeout(resolve, 150));

    expect((await request(app).get('/api/things')).status).toBe(200);
  });

  it('skips requests matched by skip (e.g. /api/health)', async () => {
    const app = buildApp({ max: 1, skip: (req) => req.path === '/api/health' });

    for (let i = 0; i < 5; i++) {
      expect((await request(app).get('/api/health')).status).toBe(200);
    }

    expect((await request(app).get('/api/things')).status).toBe(200);
    expect((await request(app).get('/api/things')).status).toBe(429);
  });

  it('tracks limits independently per client IP', async () => {
    const app = buildApp({ max: 1, trustProxy: true });

    expect((await request(app).get('/api/things').set('X-Forwarded-For', '1.2.3.4')).status).toBe(
      200,
    );
    expect((await request(app).get('/api/things').set('X-Forwarded-For', '1.2.3.4')).status).toBe(
      429,
    );

    // A different IP still has its full quota.
    expect((await request(app).get('/api/things').set('X-Forwarded-For', '5.6.7.8')).status).toBe(
      200,
    );
  });

  it('shares one budget across limiter instances on a shared store', async () => {
    // The seam a future Redis store plugs into: two middleware instances.
    const store = new MemoryRateLimitStore();
    const buildShared = () => {
      const app = express();
      app.use(createRateLimiter({ windowMs: 60_000, max: 2, store }));
      app.get('/api/things', (_req, res) => {
        res.json({ ok: true, data: [] });
      });
      return app;
    };
    const a = buildShared();
    const b = buildShared();

    expect((await request(a).get('/api/things')).status).toBe(200);
    expect((await request(b).get('/api/things')).status).toBe(200);
    // Third hit — regardless of instance — is over budget.
    expect((await request(a).get('/api/things')).status).toBe(429);
  });
});
