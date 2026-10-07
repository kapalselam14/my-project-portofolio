// Tests for activity checkin.
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./activity-checkin.service.js', () => {
  return {
    checkIn: vi.fn().mockResolvedValue(1787000000000),
    getCheckInStatus: vi.fn(),
  };
});

vi.mock('./activity-participants.service.js', () => {
  return {
    canAccessActivityChat: vi.fn().mockResolvedValue(true),
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
import * as checkInService from './activity-checkin.service.js';
import * as activityParticipantsService from './activity-participants.service.js';

describe('activity check-in routes', () => {
  describe('POST /api/activities/:activityId/check-in', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('when request body is valid => expected 201', async () => {
      const app = createApp();

      const response = await request(app)
        .post('/api/activities/activity-1/check-in')
        .send({ latitude: -36.8558, longitude: 174.7764 });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        ok: true,
        data: { checkedInAt: 1787000000000 },
      });
      expect(activityParticipantsService.canAccessActivityChat).toHaveBeenCalledWith(
        'activity-1',
        'test-uid-1',
      );
      expect(checkInService.checkIn).toHaveBeenCalledWith({
        activityId: 'activity-1',
        uid: 'test-uid-1',
        latitude: -36.8558,
        longitude: 174.7764,
      });
    });

    it('when body is empty => expected 201 without coordinates', async () => {
      const app = createApp();

      const response = await request(app).post('/api/activities/activity-1/check-in').send({});

      expect(response.status).toBe(201);
      expect(checkInService.checkIn).toHaveBeenCalledWith({
        activityId: 'activity-1',
        uid: 'test-uid-1',
        latitude: undefined,
        longitude: undefined,
      });
    });

    it('when activity is not open for check-in => expected 409 w/ CONFLICT', async () => {
      vi.mocked(checkInService.checkIn).mockRejectedValueOnce(
        new Error('Activity is not open for check-in'),
      );

      const app = createApp();

      const response = await request(app).post('/api/activities/activity-1/check-in').send({});

      expect(response.status).toBe(409);
      expect(response.body).toEqual({
        ok: false,
        error: { code: 'CONFLICT', message: 'Activity is not open for check-in' },
      });
    });

    it('when coordinates are not numbers => expected 400 w/ INVALID_INPUT', async () => {
      const app = createApp();

      const response = await request(app)
        .post('/api/activities/activity-1/check-in')
        .send({ latitude: 'far', longitude: 174.7764 });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'latitude and longitude must be numbers when provided',
        },
      });
      expect(checkInService.checkIn).not.toHaveBeenCalled();
    });

    it('when activityId is blank => expected 400 w/ EMPTY_INPUT', async () => {
      const app = createApp();

      const response = await request(app).post('/api/activities/%20%20/check-in').send({});

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        ok: false,
        error: { code: 'EMPTY_INPUT', message: 'activityId is required' },
      });
    });

    it('when authenticated user is not host or participant => expected 403 w/ FORBIDDEN', async () => {
      vi.mocked(activityParticipantsService.canAccessActivityChat).mockResolvedValueOnce(false);

      const app = createApp();

      const response = await request(app).post('/api/activities/activity-1/check-in').send({});

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only the activity host or participants can access this chat',
        },
      });
      expect(checkInService.checkIn).not.toHaveBeenCalled();
    });

    it('when activity is not found => expected 404 w/ NOT_FOUND', async () => {
      vi.mocked(activityParticipantsService.canAccessActivityChat).mockRejectedValueOnce(
        new Error('Activity not found'),
      );

      const app = createApp();

      const response = await request(app)
        .post('/api/activities/missing-activity/check-in')
        .send({});

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Activity not found' },
      });
      expect(checkInService.checkIn).not.toHaveBeenCalled();
    });

    it('when service throws unknown error => expected 500 w/ INTERNAL_ERROR', async () => {
      vi.mocked(checkInService.checkIn).mockRejectedValueOnce(new Error('Unknown error'));

      const app = createApp();

      const response = await request(app).post('/api/activities/activity-1/check-in').send({});

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        ok: false,
        error: { code: 'INTERNAL_ERROR', message: 'Unknown error' },
      });
    });
  });

  describe('GET /api/activities/:activityId/check-in/me', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('when checked in => expected 200 with timestamp', async () => {
      vi.mocked(checkInService.getCheckInStatus).mockResolvedValueOnce({
        checkedIn: true,
        checkedInAt: 1787000000000,
      });

      const app = createApp();

      const response = await request(app).get('/api/activities/activity-1/check-in/me');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ok: true,
        data: { checkedIn: true, checkedInAt: 1787000000000 },
      });
      expect(activityParticipantsService.canAccessActivityChat).toHaveBeenCalledWith(
        'activity-1',
        'test-uid-1',
      );
    });

    it('when not checked in => expected 200 with null timestamp', async () => {
      vi.mocked(checkInService.getCheckInStatus).mockResolvedValueOnce({
        checkedIn: false,
        checkedInAt: null,
      });

      const app = createApp();

      const response = await request(app).get('/api/activities/activity-1/check-in/me');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ok: true,
        data: { checkedIn: false, checkedInAt: null },
      });
    });

    it('when authenticated user is not host or participant => expected 403 w/ FORBIDDEN', async () => {
      vi.mocked(activityParticipantsService.canAccessActivityChat).mockResolvedValueOnce(false);

      const app = createApp();

      const response = await request(app).get('/api/activities/activity-1/check-in/me');

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only the activity host or participants can access this chat',
        },
      });
      expect(checkInService.getCheckInStatus).not.toHaveBeenCalled();
    });

    it('when activity is not found => expected 404 w/ NOT_FOUND', async () => {
      vi.mocked(activityParticipantsService.canAccessActivityChat).mockRejectedValueOnce(
        new Error('Activity not found'),
      );

      const app = createApp();

      const response = await request(app).get('/api/activities/missing-activity/check-in/me');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Activity not found' },
      });
      expect(checkInService.getCheckInStatus).not.toHaveBeenCalled();
    });

    it('when service throws unknown error => expected 500 w/ INTERNAL_ERROR', async () => {
      vi.mocked(checkInService.getCheckInStatus).mockRejectedValueOnce(new Error('Unknown error'));

      const app = createApp();

      const response = await request(app).get('/api/activities/activity-1/check-in/me');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        ok: false,
        error: { code: 'INTERNAL_ERROR', message: 'Unknown error' },
      });
    });
  });
});
