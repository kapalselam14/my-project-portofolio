import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Exercise activity HTTP behavior with persistence and notification dependencies stubbed at the service boundary.
const rtdbMocks = vi.hoisted(() => {
  return {
    ref: vi.fn(),
    push: vi.fn(),
    set: vi.fn(),
  };
});

vi.mock('../../database/firebase.js', () => {
  return {
    rtdb: { ref: rtdbMocks.ref },
    firestore: {},
    auth: {},
    checkFirestoreConnection: vi.fn().mockResolvedValue(true),
  };
});

vi.mock('./activities.service.js', () => {
  return {
    createActivity: vi.fn().mockResolvedValue({ activityId: 'activity-1' }),
    enrichActivityWithHostProfile: vi.fn((activity) => Promise.resolve(activity)),
    attachViewerActivityContext: vi.fn((activity) =>
      Promise.resolve({
        ...activity,
        mySwipeDecision: 'join',
        isParticipant: true,
        isHost: false,
      }),
    ),
    getActivityById: vi.fn(),
    listActivities: vi.fn(),
    listPublicActivityTeasers: vi.fn(),
    updateActivity: vi.fn().mockResolvedValue(undefined),
    updateActivityCover: vi.fn().mockResolvedValue(undefined),
    updateActivityStatus: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('./activity-participants.service.js', () => {
  return {
    joinActivity: vi.fn().mockResolvedValue(undefined),
    getParticipants: vi.fn(),
    leaveActivity: vi.fn().mockResolvedValue(undefined),
    requestToJoin: vi.fn().mockResolvedValue(undefined),
    listJoinRequests: vi.fn(),
    listMyJoinRequests: vi.fn().mockResolvedValue([]),
    approveJoinRequest: vi.fn().mockResolvedValue(undefined),
    declineJoinRequest: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('../notifications/notifications.service.js', () => {
  return {
    createNotification: vi.fn().mockResolvedValue({ notificationId: 'notification-1' }),
    renderTemplate: vi.fn().mockResolvedValue(null),
    displayNameOf: vi.fn().mockResolvedValue(''),
  };
});

vi.mock('./discover.service.js', () => ({
  listDiscoverActivities: vi.fn(),
}));

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
import * as activityParticipantsService from './activity-participants.service.js';
import * as notificationsService from '../notifications/notifications.service.js';
import * as discoverService from './discover.service.js';

describe('activities routes', () => {
  describe('POST /api/activities', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('when request body is valid => expected 201', async () => {
      const app = createApp();

      const response = await request(app).post('/api/activities').send({
        title: 'Evening Futsal',
        sportType: 'futsal',
        description: 'Casual 5v5 session',
        locationName: 'Auckland Domain',
        latitude: -36.8585,
        longitude: 174.775,
        geohash: 'rckq2m',
        startTime: '2026-08-19T18:30:00+12:00',
        skillLevel: 'any',
        capacity: 10,
      });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        ok: true,
        data: {
          activityId: 'activity-1',
        },
      });
    });

    it('uses the authenticated host id instead of a host id supplied in the body', async () => {
      const response = await request(createApp()).post('/api/activities').send({
        title: 'Evening Futsal',
        sportType: 'futsal',
        description: 'Casual 5v5 session',
        locationName: 'Auckland Domain',
        latitude: -36.8585,
        longitude: 174.775,
        geohash: 'rckq2m',
        startTime: '2026-08-19T18:30:00+12:00',
        skillLevel: 'any',
        capacity: 10,
        hostId: 'forged-user',
      });

      expect(response.status).toBe(201);
      expect(activitiesService.createActivity).toHaveBeenCalledWith(
        expect.objectContaining({ hostId: 'test-uid-1' }),
      );
    });

    it('when required string fields are not strings => expected 400 w/ INVALID_INPUT', async () => {
      const app = createApp();

      const response = await request(app).post('/api/activities').send({
        title: 123,
        sportType: 'futsal',
        description: 'Casual 5v5 session',
        locationName: 'Auckland Domain',
        geohash: 'rckq2m',
        startTime: '2026-08-19T18:30:00+12:00',
        skillLevel: 'any',
        capacity: 10,
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message:
            'title, sportType, locationName, geohash, and startTime must be strings',
        },
      });
    });

    it('when description is omitted => expected 201', async () => {
      const app = createApp();

      const response = await request(app).post('/api/activities').send({
        title: 'Evening Futsal',
        sportType: 'futsal',
        locationName: 'Auckland Domain',
        latitude: -36.8585,
        longitude: 174.775,
        geohash: 'rckq2m',
        startTime: '2026-08-19T18:30:00+12:00',
        skillLevel: 'any',
        capacity: 10,
      });

      expect(response.status).toBe(201);
      expect(activitiesService.createActivity).toHaveBeenCalledWith(
        expect.objectContaining({ description: '' }),
      );
    });

    it('when description is not a string => expected 400 w/ INVALID_INPUT', async () => {
      const app = createApp();

      const response = await request(app).post('/api/activities').send({
        title: 'Evening Futsal',
        sportType: 'futsal',
        description: 123,
        locationName: 'Auckland Domain',
        geohash: 'rckq2m',
        startTime: '2026-08-19T18:30:00+12:00',
        skillLevel: 'any',
        capacity: 10,
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'description must be a string when provided',
        },
      });
    });

    it('when optional string fields are invalid => expected 400 w/ INVALID_INPUT', async () => {
      const app = createApp();

      const response = await request(app).post('/api/activities').send({
        title: 'Evening Futsal',
        sportType: 'futsal',
        description: 'Casual 5v5 session',
        locationName: 'Auckland Domain',
        address: 123,
        geohash: 'rckq2m',
        startTime: '2026-08-19T18:30:00+12:00',
        skillLevel: 'any',
        capacity: 10,
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'address and endTime must be strings when provided',
        },
      });
    });

    it('when skillLevel is invalid => expected 400 w/ INVALID_INPUT', async () => {
      const app = createApp();

      const response = await request(app).post('/api/activities').send({
        title: 'Evening Futsal',
        sportType: 'futsal',
        description: 'Casual 5v5 session',
        locationName: 'Auckland Domain',
        geohash: 'rckq2m',
        startTime: '2026-08-19T18:30:00+12:00',
        skillLevel: 'expert',
        capacity: 10,
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'skillLevel must be beginner, intermediate, advanced, or any',
        },
      });
    });

    it('when capacity is invalid => expected 400 w/ INVALID_INPUT', async () => {
      const app = createApp();

      const response = await request(app).post('/api/activities').send({
        title: 'Evening Futsal',
        sportType: 'futsal',
        description: 'Casual 5v5 session',
        locationName: 'Auckland Domain',
        geohash: 'rckq2m',
        startTime: '2026-08-19T18:30:00+12:00',
        skillLevel: 'any',
        capacity: 0,
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'capacity must be a positive integer',
        },
      });
    });

    it('when latitude is invalid => expected 400 w/ INVALID_INPUT', async () => {
      const app = createApp();

      const response = await request(app).post('/api/activities').send({
        title: 'Evening Futsal',
        sportType: 'futsal',
        description: 'Casual 5v5 session',
        locationName: 'Auckland Domain',
        latitude: -91,
        longitude: 174.775,
        geohash: 'rckq2m',
        startTime: '2026-08-19T18:30:00+12:00',
        skillLevel: 'any',
        capacity: 10,
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'latitude must be a number between -90 and 90',
        },
      });
    });

    it('when longitude is invalid => expected 400 w/ INVALID_INPUT', async () => {
      const app = createApp();

      const response = await request(app).post('/api/activities').send({
        title: 'Evening Futsal',
        sportType: 'futsal',
        description: 'Casual 5v5 session',
        locationName: 'Auckland Domain',
        latitude: -36.8585,
        longitude: 181,
        geohash: 'rckq2m',
        startTime: '2026-08-19T18:30:00+12:00',
        skillLevel: 'any',
        capacity: 10,
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'longitude must be a number between -180 and 180',
        },
      });
    });

    it('when required string fields are blank => expected 400 w/ EMPTY_INPUT', async () => {
      const app = createApp();

      const response = await request(app).post('/api/activities').send({
        title: '   ',
        sportType: 'futsal',
        description: 'Casual 5v5 session',
        locationName: 'Auckland Domain',
        latitude: -36.8585,
        longitude: 174.775,
        geohash: 'rckq2m',
        startTime: '2026-08-19T18:30:00+12:00',
        skillLevel: 'any',
        capacity: 10,
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'EMPTY_INPUT',
          message:
            'title, sportType, locationName, geohash, and startTime are required',
        },
      });
    });

    it('when service throws unknown error => expected 500 w/ INTERNAL_ERROR', async () => {
      vi.mocked(activitiesService.createActivity).mockRejectedValueOnce(new Error('Unknown error'));

      const app = createApp();

      const response = await request(app).post('/api/activities').send({
        title: 'Evening Futsal',
        sportType: 'futsal',
        description: 'Casual 5v5 session',
        locationName: 'Auckland Domain',
        latitude: -36.8585,
        longitude: 174.775,
        geohash: 'rckq2m',
        startTime: '2026-08-19T18:30:00+12:00',
        skillLevel: 'any',
        capacity: 10,
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

  describe('PATCH /api/activities/:activityId', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('when request body is valid => expected 200', async () => {
      const app = createApp();

      const response = await request(app).patch('/api/activities/activity-1').send({
        title: 'Updated Futsal',
        capacity: 12,
        skillLevel: 'intermediate',
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ok: true,
        data: {
          activityId: 'activity-1',
        },
      });
      expect(activitiesService.updateActivity).toHaveBeenCalledWith({
        activityId: 'activity-1',
        hostId: 'test-uid-1',
        title: 'Updated Futsal',
        skillLevel: 'intermediate',
        capacity: 12,
      });
    });

    it('when updated string field is not a string => expected 400 w/ INVALID_INPUT', async () => {
      const app = createApp();

      const response = await request(app).patch('/api/activities/activity-1').send({
        title: 123,
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'updated string fields must be strings',
        },
      });
    });

    it('when skillLevel is invalid => expected 400 w/ INVALID_INPUT', async () => {
      const app = createApp();

      const response = await request(app).patch('/api/activities/activity-1').send({
        skillLevel: 'expert',
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'skillLevel must be beginner, intermediate, advanced, or any',
        },
      });
    });

    it('when capacity is invalid => expected 400 w/ INVALID_INPUT', async () => {
      const app = createApp();

      const response = await request(app).patch('/api/activities/activity-1').send({
        capacity: 0,
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'capacity must be a positive integer',
        },
      });
    });

    it('when activityId is blank => expected 400 w/ EMPTY_INPUT', async () => {
      const app = createApp();

      const response = await request(app).patch('/api/activities/%20%20').send({
        title: 'Updated Futsal',
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

    it('when updated string field is blank => expected 400 w/ EMPTY_INPUT', async () => {
      vi.mocked(activitiesService.updateActivity).mockRejectedValueOnce(
        new Error('updated string fields cannot be blank'),
      );

      const app = createApp();

      const response = await request(app).patch('/api/activities/activity-1').send({
        title: '   ',
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'EMPTY_INPUT',
          message: 'updated string fields cannot be blank',
        },
      });
    });

    it('when activity is not found => expected 404 w/ NOT_FOUND', async () => {
      vi.mocked(activitiesService.updateActivity).mockRejectedValueOnce(
        new Error('Activity not found'),
      );

      const app = createApp();

      const response = await request(app).patch('/api/activities/missing-activity').send({
        title: 'Updated Futsal',
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

    it('when authenticated user is not activity host => expected 403 w/ FORBIDDEN', async () => {
      vi.mocked(activitiesService.updateActivity).mockRejectedValueOnce(
        new Error('Only the activity host can update this activity'),
      );

      const app = createApp();

      const response = await request(app).patch('/api/activities/activity-1').send({
        title: 'Updated Futsal',
      });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only the activity host can update this activity',
        },
      });
    });

    it('when service throws unknown error => expected 500 w/ INTERNAL_ERROR', async () => {
      vi.mocked(activitiesService.updateActivity).mockRejectedValueOnce(new Error('Unknown error'));

      const app = createApp();

      const response = await request(app).patch('/api/activities/activity-1').send({
        title: 'Updated Futsal',
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

  describe('PATCH /api/activities/:activityId/status', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('when request body is valid => expected 200', async () => {
      const app = createApp();

      const response = await request(app).patch('/api/activities/activity-1/status').send({
        status: 'cancelled',
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ok: true,
        data: {
          activityId: 'activity-1',
          status: 'cancelled',
        },
      });
      expect(activitiesService.updateActivityStatus).toHaveBeenCalledWith({
        activityId: 'activity-1',
        hostId: 'test-uid-1',
        status: 'cancelled',
      });
    });

    it('when status is not a string => expected 400 w/ INVALID_INPUT', async () => {
      const app = createApp();

      const response = await request(app).patch('/api/activities/activity-1/status').send({
        status: 123,
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'status must be a string',
        },
      });
    });

    it('when status is invalid => expected 400 w/ INVALID_INPUT', async () => {
      const app = createApp();

      const response = await request(app).patch('/api/activities/activity-1/status').send({
        status: 'full',
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'status must be open, cancelled, completed, or removed',
        },
      });
    });

    it('when activityId is blank => expected 400 w/ EMPTY_INPUT', async () => {
      const app = createApp();

      const response = await request(app).patch('/api/activities/%20%20/status').send({
        status: 'cancelled',
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'EMPTY_INPUT',
          message: 'activityId and status are required',
        },
      });
    });

    it('when status is blank => expected 400 w/ EMPTY_INPUT', async () => {
      const app = createApp();

      const response = await request(app).patch('/api/activities/activity-1/status').send({
        status: '   ',
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'EMPTY_INPUT',
          message: 'activityId and status are required',
        },
      });
    });

    it('when activity is not found => expected 404 w/ NOT_FOUND', async () => {
      vi.mocked(activitiesService.updateActivityStatus).mockRejectedValueOnce(
        new Error('Activity not found'),
      );

      const app = createApp();

      const response = await request(app).patch('/api/activities/missing-activity/status').send({
        status: 'cancelled',
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

    it('when authenticated user is not activity host => expected 403 w/ FORBIDDEN', async () => {
      vi.mocked(activitiesService.updateActivityStatus).mockRejectedValueOnce(
        new Error('Only the activity host can update this activity'),
      );

      const app = createApp();

      const response = await request(app).patch('/api/activities/activity-1/status').send({
        status: 'cancelled',
      });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only the activity host can update this activity',
        },
      });
    });

    it('when service throws unknown error => expected 500 w/ INTERNAL_ERROR', async () => {
      vi.mocked(activitiesService.updateActivityStatus).mockRejectedValueOnce(
        new Error('Unknown error'),
      );

      const app = createApp();

      const response = await request(app).patch('/api/activities/activity-1/status').send({
        status: 'cancelled',
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

  describe('PATCH /api/activities/:activityId/cover', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('when cover metadata is valid => expected 200', async () => {
      const app = createApp();

      const response = await request(app).patch('/api/activities/activity-1/cover').send({
        coverImagePath: 'activities/activity-1/cover/cover-1787200000000.jpg',
        coverImageUrl:
          'https://storage.googleapis.com/bucket/activities/activity-1/cover/cover-1787200000000.jpg',
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ok: true,
        data: {
          activityId: 'activity-1',
          coverImagePath: 'activities/activity-1/cover/cover-1787200000000.jpg',
          coverImageUrl:
            'https://storage.googleapis.com/bucket/activities/activity-1/cover/cover-1787200000000.jpg',
        },
      });
      expect(activitiesService.updateActivityCover).toHaveBeenCalledWith({
        activityId: 'activity-1',
        hostId: 'test-uid-1',
        coverImagePath: 'activities/activity-1/cover/cover-1787200000000.jpg',
        coverImageUrl:
          'https://storage.googleapis.com/bucket/activities/activity-1/cover/cover-1787200000000.jpg',
      });
    });

    it('when activityId is blank => expected 400 w/ EMPTY_INPUT', async () => {
      const app = createApp();

      const response = await request(app).patch('/api/activities/%20%20/cover').send({
        coverImagePath: 'activities/activity-1/cover/cover-1787200000000.jpg',
        coverImageUrl:
          'https://storage.googleapis.com/bucket/activities/activity-1/cover/cover-1787200000000.jpg',
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'EMPTY_INPUT',
          message: 'activityId is required',
        },
      });
      expect(activitiesService.updateActivityCover).not.toHaveBeenCalled();
    });

    it('when cover metadata is not string => expected 400 w/ INVALID_INPUT', async () => {
      const app = createApp();

      const response = await request(app).patch('/api/activities/activity-1/cover').send({
        coverImagePath: 123,
        coverImageUrl: 'https://storage.googleapis.com/bucket/cover.jpg',
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'coverImagePath and coverImageUrl must be strings',
        },
      });
      expect(activitiesService.updateActivityCover).not.toHaveBeenCalled();
    });

    it('when cover metadata is blank => expected 400 w/ EMPTY_INPUT', async () => {
      const app = createApp();

      const response = await request(app).patch('/api/activities/activity-1/cover').send({
        coverImagePath: '   ',
        coverImageUrl: 'https://storage.googleapis.com/bucket/cover.jpg',
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'EMPTY_INPUT',
          message: 'coverImagePath and coverImageUrl are required',
        },
      });
      expect(activitiesService.updateActivityCover).not.toHaveBeenCalled();
    });

    it('when coverImagePath belongs to another activity => expected 403 w/ FORBIDDEN', async () => {
      const app = createApp();

      const response = await request(app).patch('/api/activities/activity-1/cover').send({
        coverImagePath: 'activities/activity-2/cover/cover-1787200000000.jpg',
        coverImageUrl:
          'https://storage.googleapis.com/bucket/activities/activity-2/cover/cover-1787200000000.jpg',
      });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'coverImagePath must belong to the activity',
        },
      });
      expect(activitiesService.updateActivityCover).not.toHaveBeenCalled();
    });

    it('when activity is not found => expected 404 w/ NOT_FOUND', async () => {
      vi.mocked(activitiesService.updateActivityCover).mockRejectedValueOnce(
        new Error('Activity not found'),
      );

      const app = createApp();

      const response = await request(app).patch('/api/activities/missing-activity/cover').send({
        coverImagePath: 'activities/missing-activity/cover/cover-1787200000000.jpg',
        coverImageUrl:
          'https://storage.googleapis.com/bucket/activities/missing-activity/cover/cover-1787200000000.jpg',
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

    it('when authenticated user is not activity host => expected 403 w/ FORBIDDEN', async () => {
      vi.mocked(activitiesService.updateActivityCover).mockRejectedValueOnce(
        new Error('Only the activity host can update this activity'),
      );

      const app = createApp();

      const response = await request(app).patch('/api/activities/activity-1/cover').send({
        coverImagePath: 'activities/activity-1/cover/cover-1787200000000.jpg',
        coverImageUrl:
          'https://storage.googleapis.com/bucket/activities/activity-1/cover/cover-1787200000000.jpg',
      });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only the activity host can update this activity',
        },
      });
    });

    it('when service throws unknown error => expected 500 w/ INTERNAL_ERROR', async () => {
      vi.mocked(activitiesService.updateActivityCover).mockRejectedValueOnce(
        new Error('Unknown error'),
      );

      const app = createApp();

      const response = await request(app).patch('/api/activities/activity-1/cover').send({
        coverImagePath: 'activities/activity-1/cover/cover-1787200000000.jpg',
        coverImageUrl:
          'https://storage.googleapis.com/bucket/activities/activity-1/cover/cover-1787200000000.jpg',
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

  /** Test section for activity participants POST route. */
  describe('POST /api/activities/:activityId/participants', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('when request is valid and authenticated user is not host => expected 200', async () => {
      vi.mocked(activitiesService.getActivityById).mockResolvedValueOnce({
        activityId: 'activity-1',
        hostId: 'host-uid-1',
      } as never);

      const app = createApp();

      const response = await request(app).post('/api/activities/activity-1/participants').send({});

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ok: true,
        data: {
          activityId: 'activity-1',
          uid: 'test-uid-1',
        },
      });
      expect(notificationsService.createNotification).toHaveBeenCalledWith({
        recipientUid: 'host-uid-1',
        type: 'activity_joined',
        title: 'New participant',
        body: 'Someone joined your activity',
        activityId: 'activity-1',
        senderUid: 'test-uid-1',
        // Host audience: the tap opens the management view.
        audience: 'host',
      });
    });

    it('when authenticated user is activity host => expected 200 without notification', async () => {
      vi.mocked(activitiesService.getActivityById).mockResolvedValueOnce({
        activityId: 'activity-1',
        hostId: 'test-uid-1',
      } as never);

      const app = createApp();

      const response = await request(app).post('/api/activities/activity-1/participants').send({});

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ok: true,
        data: {
          activityId: 'activity-1',
          uid: 'test-uid-1',
        },
      });
      expect(notificationsService.createNotification).not.toHaveBeenCalled();
    });

    it('when activityId is blank => expected 400 w/ EMPTY_INPUT', async () => {
      const app = createApp();

      const response = await request(app).post('/api/activities/%20%20/participants').send({});

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'EMPTY_INPUT',
          message: 'activityId is required',
        },
      });
    });

    it.each([
      'Activity is not open for joining',
      'Activity has already started',
      'Activity is full',
      'User already joined this activity',
      'This activity requires host approval — request to join instead',
    ])('when service rejects with %s => expected 409 w/ CONFLICT', async (message) => {
      vi.mocked(activityParticipantsService.joinActivity).mockRejectedValueOnce(new Error(message));

      const app = createApp();

      const response = await request(app).post('/api/activities/activity-1/participants').send({});

      expect(response.status).toBe(409);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'CONFLICT',
          message,
        },
      });
    });

    it('when activity is not found => expected 404 w/ NOT_FOUND', async () => {
      vi.mocked(activityParticipantsService.joinActivity).mockRejectedValueOnce(
        new Error('Activity not found'),
      );

      const app = createApp();

      const response = await request(app).post('/api/activities/activity-1/participants').send({});

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
      vi.mocked(activityParticipantsService.joinActivity).mockRejectedValueOnce(
        new Error('Unknown error'),
      );

      const app = createApp();

      const response = await request(app).post('/api/activities/activity-1/participants').send({});

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

  /** Test section for activities GET route. */
  describe('GET /api/activities', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('when authenticated user reads activities => expected 200 with viewer context', async () => {
      const activity = {
        activityId: 'activity-1',
        hostId: 'host-uid-1',
        title: 'Evening Futsal',
        sportType: 'futsal',
        description: 'Casual 5v5 session',
        locationName: 'Auckland Domain',
        latitude: -36.8585,
        longitude: 174.775,
        geohash: 'rckq2m',
        startTime: '2026-08-19T18:30:00+12:00',
        skillLevel: 'any',
        capacity: 10,
        participantCount: 0,
        status: 'open',
        hostProfile: {
          authUid: 'host-uid-1',
          displayName: 'Test Host',
        },
        createdAt: { toDate: () => new Date('2026-08-19T06:00:00Z') } as never,
        updatedAt: { toDate: () => new Date('2026-08-19T06:00:00Z') } as never,
      } as const;

      vi.mocked(activitiesService.listActivities).mockResolvedValueOnce([activity]);
      vi.mocked(activitiesService.attachViewerActivityContext).mockResolvedValueOnce({
        ...activity,
        mySwipeDecision: 'join',
        isParticipant: true,
        isHost: false,
      });

      const app = createApp();

      const response = await request(app).get('/api/activities');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        ok: true,
        data: [
          {
            activityId: 'activity-1',
            hostId: 'host-uid-1',
            mySwipeDecision: 'join',
            isParticipant: true,
            isHost: false,
          },
        ],
      });
      expect(activitiesService.attachViewerActivityContext).toHaveBeenCalledWith(
        activity,
        'test-uid-1',
      );
    });

    it('when filters are valid => expected 200', async () => {
      vi.mocked(activitiesService.listActivities).mockResolvedValueOnce([]);

      const app = createApp();

      const response = await request(app).get(
        '/api/activities?status=completed&sportType=futsal&skillLevel=any&limit=10',
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ok: true,
        data: [],
      });
      expect(activitiesService.listActivities).toHaveBeenCalledWith({
        status: 'completed',
        sportType: 'futsal',
        skillLevel: 'any',
        limit: 10,
      });
    });

    it('when status is invalid => expected 400 w/ INVALID_INPUT', async () => {
      const app = createApp();

      const response = await request(app).get('/api/activities?status=invalid');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'status must be open, full, cancelled, completed, or removed',
        },
      });
    });

    it('when skillLevel is invalid => expected 400 w/ INVALID_INPUT', async () => {
      const app = createApp();

      const response = await request(app).get('/api/activities?skillLevel=expert');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'skillLevel must be beginner, intermediate, advanced, or any',
        },
      });
    });

    it('when sportType is blank => expected 400 w/ EMPTY_INPUT', async () => {
      const app = createApp();

      const response = await request(app).get('/api/activities?sportType=%20%20');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'EMPTY_INPUT',
          message: 'sportType is required when provided',
        },
      });
    });

    it.each(['0', '51', '1.5', 'abc'])(
      'when limit is %s => expected 400 w/ INVALID_INPUT',
      async (limit) => {
        const app = createApp();

        const response = await request(app).get(`/api/activities?limit=${limit}`);

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
          ok: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'limit must be an integer between 1 and 50',
          },
        });
      },
    );

    it('when service throws unknown error => expected 500 w/ INTERNAL_ERROR', async () => {
      vi.mocked(activitiesService.listActivities).mockRejectedValueOnce(new Error('Unknown error'));

      const app = createApp();

      const response = await request(app).get('/api/activities');

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

  describe('GET /api/activities?discover=1', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('routes the discover=1 query to the discover pipeline', async () => {
      const baseAct = {
        activityId: 'activity-1',
        hostId: 'host-1',
        title: 'Evening Futsal',
        sportType: 'Futsal',
        description: 'Casual 5v5',
        locationName: 'Auckland Domain',
        latitude: -36.86,
        longitude: 174.77,
        geohash: 'rckq31v',
        startTime: '2026-09-09T04:00:00.000Z',
        skillLevel: 'intermediate',
        capacity: 10,
        participantCount: 4,
        status: 'open',
        hostProfile: null,
      } as const;
      const enriched = {
        ...baseAct,
        mySwipeDecision: null,
        isParticipant: false,
        isHost: false,
      };
      vi.mocked(discoverService.listDiscoverActivities as never).mockResolvedValueOnce([enriched]);

      const app = createApp();
      const response = await request(app).get(
        '/api/activities?discover=1&nearLat=-36.86&nearLng=174.77&radiusKm=20&sportFilters=Futsal:intermediate',
      );

      expect(response.status).toBe(200);
      // The controller enriches host profiles and attaches viewer context exactly like the legacy feed path.
      expect(response.body.data).toEqual([
        { ...enriched, mySwipeDecision: 'join', isParticipant: true, isHost: false },
      ]);
      expect(discoverService.listDiscoverActivities).toHaveBeenCalledWith({
        limit: 20,
        viewerUid: 'test-uid-1',
        discover: {
          near: { latitude: -36.86, longitude: 174.77, radiusKm: 20 },
          sportFilters: [{ sport: 'Futsal', skill: 'intermediate' }],
        },
      });
    });

    it('rejects malformed sportFilters => expected 400 INVALID_INPUT', async () => {
      const app = createApp();
      const response = await request(app).get('/api/activities?discover=1&sportFilters=Futsal');
      expect(response.status).toBe(400);
      expect(response.body.error?.code).toBe('INVALID_INPUT');
    });

    it('forwards includeSwiped to the discover pipeline', async () => {
      vi.mocked(discoverService.listDiscoverActivities as never).mockResolvedValueOnce([]);
      const app = createApp();
      const response = await request(app).get('/api/activities?discover=1&includeSwiped=true');
      expect(response.status).toBe(200);
      expect(discoverService.listDiscoverActivities).toHaveBeenCalledWith({
        limit: 20,
        viewerUid: 'test-uid-1',
        discover: { sportFilters: [], includeSwiped: true },
      });
    });

    it('rejects bad includeSwiped => expected 400 INVALID_INPUT', async () => {
      const app = createApp();
      const response = await request(app).get('/api/activities?discover=1&includeSwiped=yes');
      expect(response.status).toBe(400);
      expect(response.body.error?.code).toBe('INVALID_INPUT');
    });

    it('rejects bad geo values => expected 400 INVALID_INPUT', async () => {
      const app = createApp();
      const response = await request(app).get(
        '/api/activities?discover=1&nearLat=999&nearLng=0&radiusKm=10',
      );
      expect(response.status).toBe(400);
      expect(response.body.error?.code).toBe('INVALID_INPUT');
    });
  });

  describe('GET /api/public/activities', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('when public teasers exist => expected 200', async () => {
      vi.mocked(activitiesService.listPublicActivityTeasers).mockResolvedValueOnce([
        {
          activityId: 'activity-1',
          title: 'Evening Futsal',
          sportType: 'futsal',
          locationName: 'Auckland Domain',
          latitude: -36.8585,
          longitude: 174.775,
          startTime: '2026-08-19T18:30:00+12:00',
          skillLevel: 'any',
          availableSpots: 4,
        },
      ]);

      const app = createApp();

      const response = await request(app).get('/api/public/activities');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ok: true,
        data: [
          {
            activityId: 'activity-1',
            title: 'Evening Futsal',
            sportType: 'futsal',
            locationName: 'Auckland Domain',
            latitude: -36.8585,
            longitude: 174.775,
            startTime: '2026-08-19T18:30:00+12:00',
            skillLevel: 'any',
            availableSpots: 4,
          },
        ],
      });
      expect(activitiesService.listPublicActivityTeasers).toHaveBeenCalledWith(10);
    });

    it('when limit is valid => expected 200', async () => {
      vi.mocked(activitiesService.listPublicActivityTeasers).mockResolvedValueOnce([]);

      const app = createApp();

      const response = await request(app).get('/api/public/activities?limit=5');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ok: true,
        data: [],
      });
      expect(activitiesService.listPublicActivityTeasers).toHaveBeenCalledWith(5);
    });

    it.each(['0', '21', '1.5', 'abc'])(
      'when limit is %s => expected 400 w/ INVALID_INPUT',
      async (limit) => {
        const app = createApp();

        const response = await request(app).get(`/api/public/activities?limit=${limit}`);

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
          ok: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'limit must be an integer between 1 and 20',
          },
        });
      },
    );

    it('when service throws unknown error => expected 500 w/ INTERNAL_ERROR', async () => {
      vi.mocked(activitiesService.listPublicActivityTeasers).mockRejectedValueOnce(
        new Error('Unknown error'),
      );

      const app = createApp();

      const response = await request(app).get('/api/public/activities');

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

  describe('GET /api/activities/:activityId', () => {
    it('when authenticated user reads activity => expected 200 with viewer context', async () => {
      const activity = {
        activityId: 'activity-1',
        hostId: 'host-uid-1',
        title: 'Evening Futsal',
        sportType: 'futsal',
        description: 'Casual 5v5 session',
        locationName: 'Auckland Domain',
        geohash: 'rckq2m',
        startTime: '2026-08-19T18:30:00+12:00',
        skillLevel: 'any',
        capacity: 10,
        participantCount: 0,
        status: 'open',
        hostProfile: {
          authUid: 'host-uid-1',
          displayName: 'Test Host',
        },
        createdAt: { toDate: () => new Date('2026-08-19T06:00:00Z') } as never,
        updatedAt: { toDate: () => new Date('2026-08-19T06:00:00Z') } as never,
      } as const;

      vi.mocked(activitiesService.getActivityById).mockResolvedValueOnce(activity);
      vi.mocked(activitiesService.attachViewerActivityContext).mockResolvedValueOnce({
        ...activity,
        mySwipeDecision: null,
        isParticipant: false,
        isHost: false,
      });

      const app = createApp();

      const response = await request(app).get('/api/activities/activity-1');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        ok: true,
        data: {
          activityId: 'activity-1',
          hostId: 'host-uid-1',
          mySwipeDecision: null,
          isParticipant: false,
          isHost: false,
        },
      });
      expect(activitiesService.attachViewerActivityContext).toHaveBeenCalledWith(
        activity,
        'test-uid-1',
      );
    });

    it('when activityId is blank => expected 400 w/ EMPTY_INPUT', async () => {
      const app = createApp();

      const response = await request(app).get('/api/activities/%20%20');

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
      vi.mocked(activitiesService.getActivityById).mockResolvedValueOnce(null);

      const app = createApp();

      const response = await request(app).get('/api/activities/missing-activity');

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
      vi.mocked(activitiesService.getActivityById).mockRejectedValueOnce(
        new Error('Unknown error'),
      );

      const app = createApp();

      const response = await request(app).get('/api/activities/activity-1');

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

describe('POST /api/activities/:activityId/join-requests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('when request is valid => expected 201 with pending status', async () => {
    const app = createApp();

    const response = await request(app).post('/api/activities/activity-1/join-requests').send({});

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      ok: true,
      data: {
        activityId: 'activity-1',
        uid: 'test-uid-1',
        status: 'pending',
      },
    });
    expect(activityParticipantsService.requestToJoin).toHaveBeenCalledWith(
      'activity-1',
      'test-uid-1',
    );
  });

  it('when activityId is blank => expected 400 w/ EMPTY_INPUT', async () => {
    const app = createApp();

    const response = await request(app).post('/api/activities/%20%20/join-requests').send({});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      ok: false,
      error: {
        code: 'EMPTY_INPUT',
        message: 'activityId is required',
      },
    });
    expect(activityParticipantsService.requestToJoin).not.toHaveBeenCalled();
  });

  it.each([
    'Activity is not open for joining',
    'Activity has already started',
    'User already joined this activity',
    'The host is already in this activity',
    'Join request already pending',
    'This activity does not require approval — join directly',
  ])('when service rejects with %s => expected 409 w/ CONFLICT', async (message) => {
    vi.mocked(activityParticipantsService.requestToJoin).mockRejectedValueOnce(new Error(message));

    const app = createApp();

    const response = await request(app).post('/api/activities/activity-1/join-requests').send({});

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      ok: false,
      error: {
        code: 'CONFLICT',
        message,
      },
    });
  });

  it('when activity is not found => expected 404 w/ NOT_FOUND', async () => {
    vi.mocked(activityParticipantsService.requestToJoin).mockRejectedValueOnce(
      new Error('Activity not found'),
    );

    const app = createApp();

    const response = await request(app).post('/api/activities/activity-1/join-requests').send({});

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      ok: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Activity not found',
      },
    });
  });
});

describe('GET /api/activities/:activityId/join-requests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('when caller is host => expected 200 with pending requests', async () => {
    vi.mocked(activitiesService.getActivityById).mockResolvedValueOnce({
      activityId: 'activity-1',
      hostId: 'test-uid-1',
    } as never);
    vi.mocked(activityParticipantsService.listJoinRequests).mockResolvedValueOnce([
      {
        requestId: 'other-user',
        uid: 'other-user',
        activityId: 'activity-1',
        status: 'pending',
        profile: null,
      } as never,
    ]);

    const app = createApp();

    const response = await request(app).get('/api/activities/activity-1/join-requests');

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(activityParticipantsService.listJoinRequests).toHaveBeenCalledWith('activity-1');
  });

  it('when caller is not host => expected 403 w/ FORBIDDEN', async () => {
    vi.mocked(activitiesService.getActivityById).mockResolvedValueOnce({
      activityId: 'activity-1',
      hostId: 'host-uid-1',
    } as never);

    const app = createApp();

    const response = await request(app).get('/api/activities/activity-1/join-requests');

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      ok: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Only the activity host can view join requests',
      },
    });
    expect(activityParticipantsService.listJoinRequests).not.toHaveBeenCalled();
  });
});

describe('POST /api/activities/:activityId/join-requests/:uid/approve', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('when request is valid => expected 200 with approved status', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/api/activities/activity-1/join-requests/other-user/approve')
      .send({});

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      data: {
        activityId: 'activity-1',
        uid: 'other-user',
        status: 'approved',
      },
    });
    expect(activityParticipantsService.approveJoinRequest).toHaveBeenCalledWith(
      'activity-1',
      'other-user',
      'test-uid-1',
    );
  });

  it('when request is missing => expected 404 w/ NOT_FOUND', async () => {
    vi.mocked(activityParticipantsService.approveJoinRequest).mockRejectedValueOnce(
      new Error('Join request not found'),
    );

    const app = createApp();

    const response = await request(app)
      .post('/api/activities/activity-1/join-requests/other-user/approve')
      .send({});

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      ok: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Join request not found',
      },
    });
  });

  it('when actor is not host => expected 403 w/ FORBIDDEN', async () => {
    vi.mocked(activityParticipantsService.approveJoinRequest).mockRejectedValueOnce(
      new Error('Only the activity host can decide join requests'),
    );

    const app = createApp();

    const response = await request(app)
      .post('/api/activities/activity-1/join-requests/other-user/approve')
      .send({});

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      ok: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Only the activity host can decide join requests',
      },
    });
  });

  it('when activity filled up meanwhile => expected 409 w/ CONFLICT', async () => {
    vi.mocked(activityParticipantsService.approveJoinRequest).mockRejectedValueOnce(
      new Error('Activity is full'),
    );

    const app = createApp();

    const response = await request(app)
      .post('/api/activities/activity-1/join-requests/other-user/approve')
      .send({});

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      ok: false,
      error: {
        code: 'CONFLICT',
        message: 'Activity is full',
      },
    });
  });
});

describe('POST /api/activities/:activityId/join-requests/:uid/decline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('when request is valid => expected 200 with declined status', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/api/activities/activity-1/join-requests/other-user/decline')
      .send({});

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      data: {
        activityId: 'activity-1',
        uid: 'other-user',
        status: 'declined',
      },
    });
    expect(activityParticipantsService.declineJoinRequest).toHaveBeenCalledWith(
      'activity-1',
      'other-user',
      'test-uid-1',
    );
  });

  it('when request is missing => expected 404 w/ NOT_FOUND', async () => {
    vi.mocked(activityParticipantsService.declineJoinRequest).mockRejectedValueOnce(
      new Error('Join request not found'),
    );

    const app = createApp();

    const response = await request(app)
      .post('/api/activities/activity-1/join-requests/other-user/decline')
      .send({});

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      ok: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Join request not found',
      },
    });
  });
});

/** Test section for activity participants GET route. */

describe('GET /api/activities/:activityId/participants', () => {
  it('when participants exist => expected 200', async () => {
    vi.mocked(activityParticipantsService.getParticipants).mockResolvedValueOnce([
      {
        participantId: 'test-uid-1',
        uid: 'test-uid-1',
        profile: {
          authUid: 'test-uid-1',
          displayName: 'Test Participant',
          photoUrl: 'https://example.com/participant.png',
        },
        joinedAt: { toDate: () => new Date('2026-08-19T06:00:00Z') } as never,
      },
    ]);

    const app = createApp();

    const response = await request(app).get('/api/activities/activity-1/participants');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      ok: true,
      data: [
        {
          participantId: 'test-uid-1',
          uid: 'test-uid-1',
          profile: {
            authUid: 'test-uid-1',
            displayName: 'Test Participant',
            photoUrl: 'https://example.com/participant.png',
          },
        },
      ],
    });
  });

  it('when activityId is blank => expected 400 w/ EMPTY_INPUT', async () => {
    const app = createApp();

    const response = await request(app).get('/api/activities/%20%20/participants');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      ok: false,
      error: {
        code: 'EMPTY_INPUT',
        message: 'activityId is required',
      },
    });
  });

  it('when no participants exist => expected 200', async () => {
    vi.mocked(activityParticipantsService.getParticipants).mockResolvedValueOnce([]);

    const app = createApp();

    const response = await request(app).get('/api/activities/activity-1/participants');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      data: [],
    });
  });

  it('when service throws unknown error => expected 500 w/ INTERNAL_ERROR', async () => {
    vi.mocked(activityParticipantsService.getParticipants).mockRejectedValueOnce(
      new Error('Unknown error'),
    );

    const app = createApp();

    const response = await request(app).get('/api/activities/activity-1/participants');

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

describe('DELETE /api/activities/:activityId/participants/:uid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rtdbMocks.set.mockResolvedValue(undefined);
    rtdbMocks.push.mockReturnValue({ set: rtdbMocks.set });
    rtdbMocks.ref.mockReturnValue({ push: rtdbMocks.push });
  });

  it('when request is valid => expected 200', async () => {
    vi.mocked(activitiesService.getActivityById).mockResolvedValueOnce({
      activityId: 'activity-1',
      hostId: 'host-uid-1',
    } as never);

    const app = createApp();

    const response = await request(app).delete(
      '/api/activities/activity-1/participants/test-uid-1',
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      data: {
        activityId: 'activity-1',
        uid: 'test-uid-1',
      },
    });
    expect(activityParticipantsService.leaveActivity).toHaveBeenCalledWith({
      activityId: 'activity-1',
      targetUid: 'test-uid-1',
      actorUid: 'test-uid-1',
    });
    expect(notificationsService.createNotification).toHaveBeenCalledWith({
      recipientUid: 'host-uid-1',
      type: 'activity_left',
      title: 'Participant left',
      body: 'Someone left your activity',
      activityId: 'activity-1',
      senderUid: 'test-uid-1',
    });
    expect(notificationsService.createNotification).toHaveBeenCalledTimes(1);
    // In-chat tombstone so remaining members see why they left.
    expect(rtdbMocks.ref).toHaveBeenCalledWith('activityChats/activity-1/messages');
    expect(rtdbMocks.set).toHaveBeenCalledWith({
      senderId: 'system',
      text: 'Someone left the group',
      type: 'system',
      timestamp: expect.any(Number),
    });
  });

  it('when activity host removes another participant => expected 200', async () => {
    vi.mocked(activitiesService.getActivityById).mockResolvedValueOnce({
      activityId: 'activity-1',
      hostId: 'test-uid-1',
    } as never);

    const app = createApp();

    const response = await request(app).delete(
      '/api/activities/activity-1/participants/other-user',
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      data: {
        activityId: 'activity-1',
        uid: 'other-user',
      },
    });
    expect(activityParticipantsService.leaveActivity).toHaveBeenCalledWith({
      activityId: 'activity-1',
      targetUid: 'other-user',
      actorUid: 'test-uid-1',
    });
    expect(notificationsService.createNotification).toHaveBeenCalledWith({
      recipientUid: 'other-user',
      type: 'participant_removed',
      title: 'Removed from activity',
      body: 'The host removed you from an activity',
      activityId: 'activity-1',
      senderUid: 'test-uid-1',
    });
    expect(notificationsService.createNotification).toHaveBeenCalledTimes(1);
    expect(rtdbMocks.set).toHaveBeenCalledWith({
      senderId: 'system',
      text: 'Someone was removed from the group',
      type: 'system',
      timestamp: expect.any(Number),
    });
  });

  it('when activity host removes themselves => expected 200', async () => {
    vi.mocked(activitiesService.getActivityById).mockResolvedValueOnce({
      activityId: 'activity-1',
      hostId: 'test-uid-1',
    } as never);
    vi.mocked(activityParticipantsService.getParticipants).mockResolvedValueOnce([
      {
        participantId: 'test-uid-1',
        uid: 'test-uid-1',
        profile: null,
        joinedAt: { toDate: () => new Date('2026-08-19T06:00:00Z') } as never,
      },
      {
        participantId: 'participant-2',
        uid: 'participant-2',
        profile: null,
        joinedAt: { toDate: () => new Date('2026-08-19T06:00:00Z') } as never,
      },
      {
        participantId: 'participant-3',
        uid: 'participant-3',
        profile: null,
        joinedAt: { toDate: () => new Date('2026-08-19T06:00:00Z') } as never,
      },
    ]);

    const app = createApp();

    const response = await request(app).delete(
      '/api/activities/activity-1/participants/test-uid-1',
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      data: {
        activityId: 'activity-1',
        uid: 'test-uid-1',
      },
    });
    expect(activityParticipantsService.leaveActivity).toHaveBeenCalledWith({
      activityId: 'activity-1',
      targetUid: 'test-uid-1',
      actorUid: 'test-uid-1',
    });
    expect(notificationsService.createNotification).toHaveBeenCalledTimes(2);
    expect(notificationsService.createNotification).toHaveBeenCalledWith({
      recipientUid: 'participant-2',
      type: 'activity_cancelled',
      title: 'Activity cancelled',
      body: 'The host cancelled this activity',
      activityId: 'activity-1',
      senderUid: 'test-uid-1',
    });
    expect(notificationsService.createNotification).toHaveBeenCalledWith({
      recipientUid: 'participant-3',
      type: 'activity_cancelled',
      title: 'Activity cancelled',
      body: 'The host cancelled this activity',
      activityId: 'activity-1',
      senderUid: 'test-uid-1',
    });
  });

  it('when activityId is blank => expected 400 w/ EMPTY_INPUT', async () => {
    const app = createApp();

    const response = await request(app).delete('/api/activities/%20%20/participants/test-uid-1');

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

    const response = await request(app).delete('/api/activities/activity-1/participants/%20%20');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      ok: false,
      error: {
        code: 'EMPTY_INPUT',
        message: 'uid is required',
      },
    });
    expect(activityParticipantsService.leaveActivity).not.toHaveBeenCalled();
  });

  it('when actor is neither participant nor activity host => expected 403 w/ FORBIDDEN', async () => {
    vi.mocked(activityParticipantsService.leaveActivity).mockRejectedValueOnce(
      new Error('Only the participant or activity host can remove this participant'),
    );

    const app = createApp();

    const response = await request(app).delete(
      '/api/activities/activity-1/participants/other-user',
    );

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      ok: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Only the participant or activity host can remove this participant',
      },
    });
  });

  it.each(['Activity not found', 'Participant not found'])(
    'when service rejects with %s => expected 404 w/ NOT_FOUND',
    async (message) => {
      vi.mocked(activityParticipantsService.leaveActivity).mockRejectedValueOnce(
        new Error(message),
      );

      const app = createApp();

      const response = await request(app).delete(
        '/api/activities/activity-1/participants/test-uid-1',
      );

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message,
        },
      });
    },
  );

  it('when service throws unknown error => expected 500 w/ INTERNAL_ERROR', async () => {
    vi.mocked(activityParticipantsService.leaveActivity).mockRejectedValueOnce(
      new Error('Unknown error'),
    );

    const app = createApp();

    const response = await request(app).delete(
      '/api/activities/activity-1/participants/test-uid-1',
    );

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

describe('GET /api/activities/join-requests/me', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the viewer outgoing requests', async () => {
    const app = createApp();
    const response = await request(app).get('/api/activities/join-requests/me');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, data: [] });
  });
});
