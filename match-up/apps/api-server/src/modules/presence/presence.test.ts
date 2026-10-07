// Tests for presence.
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./presence.service.js', () => {
  return {
    setPresence: vi.fn().mockResolvedValue(undefined),
    getPresence: vi.fn(),
  };
});

vi.mock('../../middleware/auth.middleware.js', () => {
  return {
    requireAuth: vi.fn((req, _res, next) => {
      req.auth = {
        uid: 'test-uid-1',
        token: {} as never,
      };
      next();
    }),

    requireAuthAllowSuspended: vi.fn((req, _res, next) => {
      req.auth = req.auth ?? {
        uid: 'test-uid-1',
        token: {} as never,
      };
      next();
    }),

    requireAdmin: vi.fn((_req, _res, next) => {
      next();
    }),
  };
});

import { createApp } from '../../app/app.js';
import * as presenceService from './presence.service.js';

describe('presence routes', () => {
  describe('POST /api/presence', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('when request body is valid => expected 200', async () => {
      const app = createApp();

      const response = await request(app).post('/api/presence').send({
        state: 'online',
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ok: true,
        data: {
          uid: 'test-uid-1',
          state: 'online',
        },
      });
      expect(presenceService.setPresence).toHaveBeenCalledWith('test-uid-1', 'online');
    });

    it('when state is invalid => expected 400 w/ INVALID_STATE', async () => {
      const app = createApp();

      const response = await request(app).post('/api/presence').send({
        state: 'busy',
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'INVALID_STATE',
          message: 'state must be online or offline',
        },
      });
    });

    it('when service throws unknown error => expected 500 w/ INTERNAL_ERROR', async () => {
      vi.mocked(presenceService.setPresence).mockRejectedValueOnce(new Error('Unknown error'));

      const app = createApp();

      const response = await request(app).post('/api/presence').send({
        state: 'online',
      });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Unknown error',
        },
      });
    });
  });

  describe('GET /api/presence/:uid', () => {
    it('when presence exists => expected 200', async () => {
      vi.mocked(presenceService.getPresence).mockResolvedValueOnce({
        state: 'online',
        lastChanged: 1787000000000,
      });

      const app = createApp();

      const response = await request(app).get('/api/presence/test-uid-1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ok: true,
        data: {
          state: 'online',
          lastChanged: 1787000000000,
        },
      });
    });

    it('when uid is blank => expected 400 w/ EMPTY_INPUT', async () => {
      const app = createApp();

      const response = await request(app).get('/api/presence/%20%20');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'EMPTY_INPUT',
          message: 'uid is required',
        },
      });
    });

    it('when presence is not found => expected 404 w/ NOT_FOUND', async () => {
      vi.mocked(presenceService.getPresence).mockResolvedValueOnce(null);

      const app = createApp();

      const response = await request(app).get('/api/presence/missing-user');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'presence not found',
        },
      });
    });

    it('when service throws unknown error => expected 500 w/ INTERNAL_ERROR', async () => {
      vi.mocked(presenceService.getPresence).mockRejectedValueOnce(new Error('Unknown error'));

      const app = createApp();

      const response = await request(app).get('/api/presence/test-uid-1');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Unknown error',
        },
      });
    });
  });
});
