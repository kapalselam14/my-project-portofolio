// Cover search-filter validation and how accepted filters are forwarded to the activity service.
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./activities.service.js', () => {
  return {
    listActivities: vi.fn(),
    attachViewerActivityContext: vi.fn((activity) =>
      Promise.resolve({ ...activity, mySwipeDecision: null }),
    ),
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
import * as activitiesService from './activities.service.js';

const activityRow = (overrides: Record<string, unknown> = {}) => ({
  activityId: 'a-1',
  hostId: 'host-1',
  title: 'Evening Futsal',
  sportType: 'futsal',
  description: 'Casual 5v5',
  locationName: 'Auckland Domain',
  latitude: -36.8585,
  longitude: 174.775,
  geohash: 'rckq2m',
  startTime: '2026-09-10T18:30:00+12:00',
  skillLevel: 'any',
  capacity: 10,
  participantCount: 3,
  pendingRequestCount: 0,
  status: 'open',
  isPaid: false,
  hostProfile: null,
  ...overrides,
});

describe('GET /api/activities/search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('when no filters are given => reuses the open feed', async () => {
    vi.mocked(activitiesService.listActivities).mockResolvedValueOnce([activityRow()] as never);

    const app = createApp();
    const response = await request(app).get('/api/activities/search');

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.data).toHaveLength(1);
    expect(activitiesService.listActivities).toHaveBeenCalledWith({
      status: 'open',
      limit: 50,
    });
  });

  it('when sport + skill are given => pushed into the list query', async () => {
    vi.mocked(activitiesService.listActivities).mockResolvedValueOnce([]);

    const app = createApp();
    const response = await request(app).get('/api/activities/search?sport=futsal&skill=any');

    expect(response.status).toBe(200);
    expect(activitiesService.listActivities).toHaveBeenCalledWith({
      status: 'open',
      sportType: 'futsal',
      skillLevel: 'any',
      limit: 50,
    });
  });

  it('when geo radius is given => filters out distant games', async () => {
    vi.mocked(activitiesService.listActivities).mockResolvedValueOnce([
      activityRow({ activityId: 'near' }),
      activityRow({
        activityId: 'far',
        latitude: 51.5074,
        longitude: -0.1278,
      }),
    ] as never);

    const app = createApp();
    const response = await request(app).get(
      '/api/activities/search?lat=-36.8585&lng=174.775&max_km=5',
    );

    expect(response.status).toBe(200);
    expect(response.body.data.map((a: { activityId: string }) => a.activityId)).toEqual(['near']);
  });

  it('when skill is invalid => expected 400 w/ INVALID_INPUT', async () => {
    const app = createApp();
    const response = await request(app).get('/api/activities/search?skill=expert');

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    });
    expect(activitiesService.listActivities).not.toHaveBeenCalled();
  });

  it('when only lat is given => expected 400 w/ INVALID_INPUT', async () => {
    const app = createApp();
    const response = await request(app).get('/api/activities/search?lat=-36.85');

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    });
  });
});
