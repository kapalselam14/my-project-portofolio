// Tests for typing.
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./typing.service.js', () => {
  return {
    setTyping: vi.fn().mockResolvedValue(undefined),
    getTyping: vi.fn(),
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
import * as typingService from './typing.service.js';

describe('typing routes', () => {
  describe('POST /api/typing', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('when request body is valid => expected 200', async () => {
      const app = createApp();

      const response = await request(app).post('/api/typing').send({
        activityId: 'activity-1',
        isTyping: true,
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ok: true,
        data: {
          activityId: 'activity-1',
          uid: 'test-uid-1',
          isTyping: true,
        },
      });
      expect(typingService.setTyping).toHaveBeenCalledWith('activity-1', 'test-uid-1', true);
    });

    it('when activityId is not a string => expected 400 w/ INVALID_INPUT', async () => {
      const app = createApp();

      const response = await request(app).post('/api/typing').send({
        activityId: 123,
        isTyping: true,
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'activityId must be a string',
        },
      });
    });

    it('when isTyping is not a boolean => expected 400 w/ INVALID_INPUT', async () => {
      const app = createApp();

      const response = await request(app).post('/api/typing').send({
        activityId: 'activity-1',
        isTyping: 'yes',
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'isTyping must be a boolean',
        },
      });
    });

    it('when activityId is blank => expected 400 w/ EMPTY_INPUT', async () => {
      const app = createApp();

      const response = await request(app).post('/api/typing').send({
        activityId: '   ',
        isTyping: true,
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'EMPTY_INPUT',
          message: 'activityId is required',
        },
      });
    });

    it('when service throws unknown error => expected 500 w/ INTERNAL_ERROR', async () => {
      vi.mocked(typingService.setTyping).mockRejectedValueOnce(new Error('Unknown error'));

      const app = createApp();

      const response = await request(app).post('/api/typing').send({
        activityId: 'activity-1',
        isTyping: true,
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

  describe('GET /api/typing/:activityId/:uid', () => {
    it('when typing status exists => expected 200', async () => {
      vi.mocked(typingService.getTyping).mockResolvedValueOnce({
        isTyping: true,
      });

      const app = createApp();

      const response = await request(app).get('/api/typing/activity-1/test-uid-1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ok: true,
        data: {
          isTyping: true,
        },
      });
    });

    it('when activityId is blank => expected 400 w/ EMPTY_INPUT', async () => {
      const app = createApp();

      const response = await request(app).get('/api/typing/%20%20/test-uid-1');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'EMPTY_INPUT',
          message: 'activityId is required',
        },
      });
    });

    it('when uid is blank => expected 400 w/ EMPTY_INPUT', async () => {
      const app = createApp();

      const response = await request(app).get('/api/typing/activity-1/%20%20');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'EMPTY_INPUT',
          message: 'uid is required',
        },
      });
    });

    it('when typing status is not found => expected 404 w/ NOT_FOUND', async () => {
      vi.mocked(typingService.getTyping).mockResolvedValueOnce(null);

      const app = createApp();

      const response = await request(app).get('/api/typing/activity-1/missing-user');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Typing status not found',
        },
      });
    });

    it('when service throws unknown error => expected 500 w/ INTERNAL_ERROR', async () => {
      vi.mocked(typingService.getTyping).mockRejectedValueOnce(new Error('Unknown error'));

      const app = createApp();

      const response = await request(app).get('/api/typing/activity-1/test-uid-1');

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
