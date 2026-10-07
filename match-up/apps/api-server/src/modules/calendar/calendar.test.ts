// Tests for calendar.
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../activities/activities.service.js', () => {
  return {
    listMyActivities: vi.fn(),
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
import { clearSyncedActivities } from './calendar.service.js';

const activityRow = (overrides: Record<string, unknown> = {}) => ({
  activityId: 'a-1',
  hostId: 'test-uid-1',
  title: 'Evening Futsal',
  sportType: 'futsal',
  description: 'Casual 5v5',
  locationName: 'Auckland Domain',
  latitude: -36.86,
  longitude: 174.77,
  geohash: 'rckq2m',
  startTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
  skillLevel: 'any',
  capacity: 10,
  participantCount: 3,
  pendingRequestCount: 0,
  status: 'open',
  isPaid: false,
  hostProfile: null,
  createdAt: { toMillis: () => 1 },
  updatedAt: { toMillis: () => 1 },
  ...overrides,
});

describe('calendar routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSyncedActivities();
  });

  describe('GET /api/calendar/upcoming', () => {
    it('when hosted + joined games are in horizon => expected 200 with entries', async () => {
      vi.mocked(activitiesService.listMyActivities).mockImplementation(async (_uid, kind) => {
        if (kind === 'hosted') return [activityRow()] as never;
        return [
          activityRow({
            activityId: 'a-2',
            hostId: 'other-host',
            title: 'Morning Run',
          }),
        ] as never;
      });

      const app = createApp();
      const response = await request(app).get('/api/calendar/upcoming?days=7');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ok: true,
        data: [
          {
            id: 'a-1',
            activity_id: 'a-1',
            title: 'Evening Futsal',
            start: expect.any(String),
            end: null,
            location: 'Auckland Domain',
            synced: false,
          },
          {
            id: 'a-2',
            activity_id: 'a-2',
            title: 'Morning Run',
            start: expect.any(String),
            end: null,
            location: 'Auckland Domain',
            synced: false,
          },
        ],
      });
    });

    it('when a game is completed or past horizon => excluded', async () => {
      vi.mocked(activitiesService.listMyActivities).mockImplementation(async (_uid, kind) => {
        if (kind === 'hosted') {
          return [
            activityRow({ activityId: 'done', status: 'completed' }),
            activityRow({
              activityId: 'far',
              startTime: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
            }),
          ] as never;
        }
        return [] as never;
      });

      const app = createApp();
      const response = await request(app).get('/api/calendar/upcoming?days=7');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ ok: true, data: [] });
    });

    it('when days is out of range => expected 400 w/ INVALID_INPUT', async () => {
      const app = createApp();
      const response = await request(app).get('/api/calendar/upcoming?days=999');

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        ok: false,
        error: { code: 'INVALID_INPUT' },
      });
      expect(activitiesService.listMyActivities).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/calendar/sync', () => {
    it('when activityIds are valid => expected 200 and upcoming shows synced', async () => {
      vi.mocked(activitiesService.listMyActivities).mockResolvedValue([activityRow()] as never);

      const app = createApp();
      const syncRes = await request(app)
        .post('/api/calendar/sync')
        .send({ activityIds: ['a-1'] });

      expect(syncRes.status).toBe(200);
      expect(syncRes.body).toEqual({ ok: true, data: { synced: 1 } });

      const upcomingRes = await request(app).get('/api/calendar/upcoming');
      expect(upcomingRes.body.data[0]).toMatchObject({
        activity_id: 'a-1',
        synced: true,
      });
    });

    it('when activityIds is empty => expected 400 w/ INVALID_INPUT', async () => {
      const app = createApp();
      const response = await request(app).post('/api/calendar/sync').send({ activityIds: [] });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        ok: false,
        error: { code: 'INVALID_INPUT' },
      });
    });
  });
});
