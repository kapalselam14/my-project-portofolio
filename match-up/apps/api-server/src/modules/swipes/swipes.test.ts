import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./swipes.service.js', () => {
  return {
    saveSwipeDecision: vi.fn().mockResolvedValue(undefined),
    getSwipeDecision: vi.fn(),
    listSwipeDecisions: vi.fn(),
  };
});

vi.mock('../activities/activities.service.js', () => {
  return {
    getActivityById: vi.fn(),
  };
});

vi.mock('../notifications/notifications.service.js', () => {
  return {
    createNotification: vi.fn().mockResolvedValue({ notificationId: 'notification-1' }),
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
import * as swipesService from './swipes.service.js';
import * as activitiesService from '../activities/activities.service.js';
import * as notificationsService from '../notifications/notifications.service.js';

describe('swipes routes', () => {
  describe('POST /api/swipes', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('when request body is valid and decision is join => expected 200 without notification', async () => {
      const app = createApp();

      const response = await request(app).post('/api/swipes').send({
        activityId: 'activity-1',
        decision: 'join',
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ok: true,
        data: {
          uid: 'test-uid-1',
          activityId: 'activity-1',
          decision: 'join',
        },
      });
      // Joining happens in a separate request, which owns the host notification.
      expect(notificationsService.createNotification).not.toHaveBeenCalled();
    });

    it('uses the authenticated uid instead of a uid supplied in the request body', async () => {
      const response = await request(createApp()).post('/api/swipes').send({
        activityId: 'activity-1',
        decision: 'pass',
        uid: 'forged-user',
      });

      expect(response.status).toBe(200);
      expect(swipesService.saveSwipeDecision).toHaveBeenCalledWith({
        uid: 'test-uid-1',
        activityId: 'activity-1',
        decision: 'pass',
      });
    });

    it('when decision is pass => expected 200 without notification', async () => {
      const app = createApp();

      const response = await request(app).post('/api/swipes').send({
        activityId: 'activity-1',
        decision: 'pass',
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ok: true,
        data: {
          uid: 'test-uid-1',
          activityId: 'activity-1',
          decision: 'pass',
        },
      });
      expect(activitiesService.getActivityById).not.toHaveBeenCalled();
      expect(notificationsService.createNotification).not.toHaveBeenCalled();
    });

    it('when authenticated user swipes own activity => expected 200 without notification', async () => {
      const app = createApp();

      const response = await request(app).post('/api/swipes').send({
        activityId: 'activity-1',
        decision: 'join',
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ok: true,
        data: {
          uid: 'test-uid-1',
          activityId: 'activity-1',
          decision: 'join',
        },
      });
      expect(notificationsService.createNotification).not.toHaveBeenCalled();
    });

    it('when activityId is not a string => expected 400 w/ INVALID_INPUT', async () => {
      const app = createApp();

      const response = await request(app).post('/api/swipes').send({
        activityId: 1234,
        decision: 'join',
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

    it('when decision is invalid => expected 400 w/ INVALID_INPUT', async () => {
      const app = createApp();

      const response = await request(app).post('/api/swipes').send({
        activityId: 'activity-1',
        decision: 'maybe',
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'decision must be pass or join',
        },
      });
    });

    it('when activityId is blank => expected 400 w/ EMPTY_INPUT', async () => {
      const app = createApp();

      const response = await request(app).post('/api/swipes').send({
        activityId: '   ',
        decision: 'join',
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

    it('when activity is not found => expected 404 w/ NOT_FOUND', async () => {
      vi.mocked(swipesService.saveSwipeDecision).mockRejectedValueOnce(
        new Error('Activity not found'),
      );

      const app = createApp();

      const response = await request(app).post('/api/swipes').send({
        activityId: 'missing-activity',
        decision: 'join',
      });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Activity not found',
        },
      });
    });

    it('when service throws unknown error => expected 500 w/ INTERNAL_ERROR', async () => {
      vi.mocked(swipesService.saveSwipeDecision).mockRejectedValueOnce(new Error('Unknown error'));

      const app = createApp();

      const response = await request(app).post('/api/swipes').send({
        activityId: 'activity-1',
        decision: 'join',
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

  describe('GET /api/swipes/me/:activityId', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('when authenticated user requests own swipe decision => expected 200', async () => {
      vi.mocked(swipesService.getSwipeDecision).mockResolvedValueOnce({
        swipeId: 'activity-1',
        uid: 'test-uid-1',
        activityId: 'activity-1',
        decision: 'join',
        createdAt: { toDate: () => new Date('2026-08-20T00:00:00Z') } as never,
        updatedAt: { toDate: () => new Date('2026-08-20T00:00:00Z') } as never,
      });

      const app = createApp();

      const response = await request(app).get('/api/swipes/me/activity-1');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        ok: true,
        data: {
          swipeId: 'activity-1',
          uid: 'test-uid-1',
          activityId: 'activity-1',
          decision: 'join',
        },
      });
      expect(swipesService.getSwipeDecision).toHaveBeenCalledWith('test-uid-1', 'activity-1');
    });

    it('when activityId is blank => expected 400 w/ EMPTY_INPUT', async () => {
      const app = createApp();

      const response = await request(app).get('/api/swipes/me/%20%20');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'EMPTY_INPUT',
          message: 'activityId is required',
        },
      });
    });

    it('when swipe decision is not found => expected 404 w/ NOT_FOUND', async () => {
      vi.mocked(swipesService.getSwipeDecision).mockResolvedValueOnce(null);

      const app = createApp();

      const response = await request(app).get('/api/swipes/me/activity-1');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Swipe decision not found',
        },
      });
    });

    it('when service throws unknown error => expected 500 w/ INTERNAL_ERROR', async () => {
      vi.mocked(swipesService.getSwipeDecision).mockRejectedValueOnce(new Error('Unknown error'));

      const app = createApp();

      const response = await request(app).get('/api/swipes/me/activity-1');

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

  describe('GET /api/swipes/me', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('when authenticated user requests own swipe decisions => expected 200', async () => {
      vi.mocked(swipesService.listSwipeDecisions).mockResolvedValueOnce([
        {
          swipeId: 'activity-2',
          uid: 'test-uid-1',
          activityId: 'activity-2',
          decision: 'pass',
          createdAt: { toDate: () => new Date('2026-08-20T00:00:00Z') } as never,
          updatedAt: { toDate: () => new Date('2026-08-20T01:00:00Z') } as never,
        },
      ]);

      const app = createApp();

      const response = await request(app).get('/api/swipes/me');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        ok: true,
        data: [
          {
            swipeId: 'activity-2',
            uid: 'test-uid-1',
            activityId: 'activity-2',
            decision: 'pass',
          },
        ],
      });
      expect(swipesService.listSwipeDecisions).toHaveBeenCalledWith('test-uid-1');
    });

    it('when no swipe decisions exist => expected 200', async () => {
      vi.mocked(swipesService.listSwipeDecisions).mockResolvedValueOnce([]);

      const app = createApp();

      const response = await request(app).get('/api/swipes/me');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ok: true,
        data: [],
      });
    });

    it('when service throws unknown error => expected 500 w/ INTERNAL_ERROR', async () => {
      vi.mocked(swipesService.listSwipeDecisions).mockRejectedValueOnce(new Error('Unknown error'));

      const app = createApp();

      const response = await request(app).get('/api/swipes/me');

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
