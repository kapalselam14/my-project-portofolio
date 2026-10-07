// Tests for users.aliases.
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./users.service.js', () => {
  return {
    bootstrapUser: vi.fn(),
    getUserByAuthUid: vi.fn(),
    updateUserPhoto: vi.fn(),
    updateUserProfile: vi.fn(),
    getPublicUserProfile: vi.fn(),
    mintCustomToken: vi.fn(),
  };
});

vi.mock('../activities/activities.service.js', () => {
  return {
    listMyActivities: vi.fn(),
    listPastActivitiesForUser: vi.fn(),
    attachViewerActivityContext: vi.fn((activity) =>
      Promise.resolve({ ...activity, mySwipeDecision: null }),
    ),
  };
});

vi.mock('../notifications/notifications.service.js', () => {
  return {
    createNotification: vi.fn().mockResolvedValue({ notificationId: 'n-1' }),
    renderTemplate: vi.fn().mockResolvedValue(null),
    displayNameOf: vi.fn().mockResolvedValue(''),
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
import * as activitiesService from '../activities/activities.service.js';

const activityRow = (overrides: Record<string, unknown> = {}) => ({
  activityId: 'a-1',
  hostId: 'other-host',
  title: 'Evening Futsal',
  sportType: 'futsal',
  status: 'open',
  startTime: '2026-09-10T18:30:00+12:00',
  ...overrides,
});

describe('users legacy activity aliases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /api/users/:uid/joined-activities wraps ?mine=joined', async () => {
    vi.mocked(activitiesService.listMyActivities).mockResolvedValueOnce([activityRow()] as never);

    const app = createApp();
    const response = await request(app).get('/api/users/test-uid-1/joined-activities');

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.data).toHaveLength(1);
    expect(activitiesService.listMyActivities).toHaveBeenCalledWith('test-uid-1', 'joined', 20, 0);
  });

  it('GET /api/users/:uid/hosted-activities wraps ?mine=hosted', async () => {
    vi.mocked(activitiesService.listMyActivities).mockResolvedValueOnce([activityRow()] as never);

    const app = createApp();
    const response = await request(app).get(
      '/api/users/test-uid-1/hosted-activities?limit=5&offset=10',
    );

    expect(response.status).toBe(200);
    expect(activitiesService.listMyActivities).toHaveBeenCalledWith('test-uid-1', 'hosted', 5, 10);
  });

  it('GET /api/users/:uid/past-activities reads completed games', async () => {
    vi.mocked(activitiesService.listPastActivitiesForUser).mockResolvedValueOnce([
      activityRow({ status: 'completed' }),
    ] as never);

    const app = createApp();
    const response = await request(app).get('/api/users/test-uid-1/past-activities');

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(activitiesService.listPastActivitiesForUser).toHaveBeenCalledWith('test-uid-1', 20, 0);
  });

  it('when limit is out of range => expected 400 w/ INVALID_INPUT', async () => {
    const app = createApp();
    const response = await request(app).get('/api/users/test-uid-1/joined-activities?limit=500');

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    });
    expect(activitiesService.listMyActivities).not.toHaveBeenCalled();
  });
});
