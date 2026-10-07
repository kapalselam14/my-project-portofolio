// Tests for notifications.unread.
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./notifications.service.js', () => {
  return {
    listNotifications: vi.fn(),
    markNotificationRead: vi.fn().mockResolvedValue(undefined),
    listUnread: vi.fn(),
    markAllRead: vi.fn(),
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

const notificationRow = (overrides: Record<string, unknown> = {}) => ({
  notificationId: 'notification-1',
  recipientUid: 'test-uid-1',
  type: 'activity_joined',
  title: 'New participant',
  body: 'A user joined your activity',
  isRead: false,
  createdAt: { toDate: () => new Date('2026-08-30T00:00:00Z') } as never,
  ...overrides,
});

describe('notifications unread + read-all routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/notifications/unread', () => {
    it('when unread notifications exist => expected 200 with unread only', async () => {
      vi.mocked(notificationsService.listUnread).mockResolvedValueOnce([notificationRow()]);

      const app = createApp();
      const response = await request(app).get('/api/notifications/unread');

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.data).toHaveLength(1);
      expect(notificationsService.listUnread).toHaveBeenCalledWith('test-uid-1');
    });

    it('when service throws => expected 500 w/ INTERNAL_ERROR', async () => {
      vi.mocked(notificationsService.listUnread).mockRejectedValueOnce(new Error('Unknown error'));

      const app = createApp();
      const response = await request(app).get('/api/notifications/unread');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        ok: false,
        error: { code: 'INTERNAL_ERROR', message: 'Unknown error' },
      });
    });
  });

  describe('POST /api/notifications/read-all', () => {
    it('when unread notifications exist => expected 200 with marked count', async () => {
      vi.mocked(notificationsService.markAllRead).mockResolvedValueOnce({
        marked: 3,
      });

      const app = createApp();
      const response = await request(app).post('/api/notifications/read-all');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ ok: true, data: { marked: 3 } });
      expect(notificationsService.markAllRead).toHaveBeenCalledWith('test-uid-1');
    });

    it('when inbox is already clear => expected 200 with marked 0', async () => {
      vi.mocked(notificationsService.markAllRead).mockResolvedValueOnce({
        marked: 0,
      });

      const app = createApp();
      const response = await request(app).post('/api/notifications/read-all');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ ok: true, data: { marked: 0 } });
    });
  });
});
