import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./notifications.service.js', () => {
  return {
    listNotifications: vi.fn(),
    markNotificationRead: vi.fn().mockResolvedValue(undefined),
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
import * as notificationsService from './notifications.service.js';

describe('notifications routes', () => {
  describe('GET /api/notifications/me', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('when authenticated user requests own notifications => expected 200', async () => {
      vi.mocked(notificationsService.listNotifications).mockResolvedValueOnce([
        {
          notificationId: 'notification-1',
          recipientUid: 'test-uid-1',
          type: 'activity_joined',
          title: 'New participant',
          body: 'A user joined your activity',
          isRead: false,
          createdAt: { toDate: () => new Date('2026-08-30T00:00:00Z') } as never,
          activityId: 'activity-1',
          senderUid: 'test-uid-2',
        },
      ]);

      const app = createApp();

      const response = await request(app).get('/api/notifications/me');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        ok: true,
        data: [
          {
            notificationId: 'notification-1',
            recipientUid: 'test-uid-1',
            type: 'activity_joined',
            title: 'New participant',
            body: 'A user joined your activity',
            isRead: false,
            activityId: 'activity-1',
            senderUid: 'test-uid-2',
          },
        ],
      });
      expect(notificationsService.listNotifications).toHaveBeenCalledWith('test-uid-1');
    });

    it('when service throws unknown error => expected 500 w/ INTERNAL_ERROR', async () => {
      vi.mocked(notificationsService.listNotifications).mockRejectedValueOnce(
        new Error('Unknown error'),
      );

      const app = createApp();

      const response = await request(app).get('/api/notifications/me');

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

  describe('PATCH /api/notifications/me/:notificationId/read', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('when authenticated user marks own notification read => expected 200', async () => {
      const app = createApp();

      const response = await request(app).patch('/api/notifications/me/notification-1/read');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ok: true,
        data: {
          uid: 'test-uid-1',
          notificationId: 'notification-1',
          isRead: true,
        },
      });
      expect(notificationsService.markNotificationRead).toHaveBeenCalledWith(
        'test-uid-1',
        'notification-1',
      );
    });

    it('when notificationId is blank => expected 400 w/ INVALID_INPUT', async () => {
      // Blank path params are now rejected by `validateParams` with the unified INVALID_INPUT envelope.
      const app = createApp();

      const response = await request(app).patch('/api/notifications/me/%20%20/read');

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Invalid path parameters',
          details: { notificationId: expect.any(Array) },
        },
      });
    });

    it('when notification is not found => expected 404 w/ NOT_FOUND', async () => {
      vi.mocked(notificationsService.markNotificationRead).mockRejectedValueOnce(
        new Error('Notification not found'),
      );

      const app = createApp();

      const response = await request(app).patch('/api/notifications/me/missing-notification/read');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Notification not found',
        },
      });
    });

    it('when service throws unknown error => expected 500 w/ INTERNAL_ERROR', async () => {
      vi.mocked(notificationsService.markNotificationRead).mockRejectedValueOnce(
        new Error('Unknown error'),
      );

      const app = createApp();

      const response = await request(app).patch('/api/notifications/me/notification-1/read');

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
