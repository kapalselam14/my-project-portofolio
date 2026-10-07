import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// requireAdmin now reads Firestore `admins/{uid}` (plus the ADMIN_UIDS env fallback).
const docGet = vi.fn();
vi.mock('../database/firebase.js', () => ({
  auth: { verifyIdToken: vi.fn() },
  firestore: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({ get: docGet })),
    })),
  },
  rtdb: {},
}));

import { requireAdmin } from './auth.middleware.js';

/** Fail-closed proof for the admin gate: with the default test env. */
function createAdminApp(uid: string | null) {
  const app = express();
  app.get('/admin-only', requireAdmin, (_req, res) => {
    res.status(200).json({ ok: true });
  });
  // Simulate requireAuth having run first.
  app.get(
    '/admin-only-authed',
    (req, _res, next) => {
      if (uid !== null) req.auth = { uid, token: {} as never };
      next();
    },
    requireAdmin,
    (_req, res) => {
      res.status(200).json({ ok: true });
    },
  );
  return app;
}

describe('requireAdmin', () => {
  beforeEach(() => {
    docGet.mockReset();
    // Default: no admins/{uid} doc.
    docGet.mockResolvedValue({ exists: false });
  });

  it('without prior auth => 401 UNAUTHORIZED', async () => {
    const response = await request(createAdminApp(null)).get('/admin-only-authed');
    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      ok: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authenticated user is required',
      },
    });
  });

  it('with non-admin uid (no doc, empty ADMIN_UIDS) => 403 FORBIDDEN', async () => {
    const response = await request(createAdminApp('some-user')).get('/admin-only-authed');
    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      ok: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Admin access is required',
      },
    });
  });

  it('with admins/{uid} doc => 200 (database grant, no .env needed)', async () => {
    docGet.mockResolvedValue({ exists: true });
    const response = await request(createAdminApp('db-admin')).get('/admin-only-authed');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  it('with unreadable admins lookup => 403 FORBIDDEN (fail closed)', async () => {
    docGet.mockRejectedValue(new Error('firestore down'));
    const response = await request(createAdminApp('some-user')).get('/admin-only-authed');
    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      ok: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Admin access is required',
      },
    });
  });
});
