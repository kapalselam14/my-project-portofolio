// Tests for validate.
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { validateBody, validateParams, validateQuery } from './validate.js';

const schema = z.object({
  name: z.string().trim().min(1),
  age: z.number().int().positive().optional(),
});

function buildApp() {
  const app = express();
  app.use(express.json());
  app.post('/api/things', validateBody(schema), (req, res) => {
    res.json({ ok: true, data: req.body });
  });
  return app;
}

describe('validateBody', () => {
  it('passes parsed (trimmed/defaulted) bodies through', async () => {
    const res = await request(buildApp()).post('/api/things').send({ name: '  Ada  ', age: 36 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, data: { name: 'Ada', age: 36 } });
  });

  it('rejects malformed bodies with the INVALID_INPUT envelope', async () => {
    const res = await request(buildApp()).post('/api/things').send({ name: '   ', age: -1 });
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error.code).toBe('INVALID_INPUT');
    expect(res.body.error.details).toMatchObject({ name: expect.any(Array) });
  });

  it('rejects wrong types', async () => {
    const res = await request(buildApp()).post('/api/things').send({ name: 42 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_INPUT');
  });
});

describe('validateQuery', () => {
  const querySchema = z.object({
    days: z.coerce.number().int().min(1).max(90).optional(),
    sport: z.string().trim().min(1).optional(),
  });

  function buildQueryApp() {
    const app = express();
    app.use(express.json());
    app.get('/api/things', validateQuery(querySchema), (req, res) => {
      res.json({ ok: true, data: req.query });
    });
    return app;
  }

  it('passes valid queries through (coerced)', async () => {
    const res = await request(buildQueryApp()).get('/api/things?days=7');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, data: { days: 7 } });
  });

  it('rejects out-of-range queries with the INVALID_INPUT envelope', async () => {
    const res = await request(buildQueryApp()).get('/api/things?days=999');
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error.code).toBe('INVALID_INPUT');
    expect(res.body.error.message).toBe('Invalid query parameters');
    expect(res.body.error.details).toMatchObject({ days: expect.any(Array) });
  });
});

describe('validateParams', () => {
  const paramsSchema = z.object({
    id: z.string().trim().min(1, 'id is required'),
  });

  function buildParamsApp() {
    const app = express();
    app.use(express.json());
    app.get('/api/things/:id', validateParams(paramsSchema), (req, res) => {
      res.json({ ok: true, data: req.params });
    });
    return app;
  }

  it('passes valid params through', async () => {
    const res = await request(buildParamsApp()).get('/api/things/abc');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, data: { id: 'abc' } });
  });

  it('rejects blank params with the INVALID_INPUT envelope', async () => {
    const res = await request(buildParamsApp()).get('/api/things/%20%20');
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error.code).toBe('INVALID_INPUT');
    expect(res.body.error.message).toBe('Invalid path parameters');
    expect(res.body.error.details).toMatchObject({ id: expect.any(Array) });
  });
});
