// Tests for ratings.
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./ratings.service.js', () => {
  return {
    submitActivityRating: vi.fn(),
    hasUserRated: vi.fn(),
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
import * as ratingsService from './ratings.service.js';

describe('ratings routes', () => {
  describe('POST /api/activities/:activityId/ratings', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('when request body is valid => expected 200', async () => {
      vi.mocked(ratingsService.submitActivityRating).mockResolvedValue({
        ratingId: 'test-uid-1',
        updated: false,
      });
      const app = createApp();

      const res = await request(app)
        .post('/api/activities/activity-1/ratings')
        .send({
          sportType: 'Basketball',
          comment: 'Great game!',
          participantRatings: [{ rateeUid: 'user-2', stars: 5 }],
        });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(ratingsService.submitActivityRating).toHaveBeenCalledWith({
        activityId: 'activity-1',
        raterUid: 'test-uid-1',
        sportType: 'Basketball',
        comment: 'Great game!',
        participantRatings: [{ rateeUid: 'user-2', stars: 5 }],
      });
    });

    it('when participantRatings is missing => expected 400', async () => {
      const app = createApp();

      const res = await request(app)
        .post('/api/activities/activity-1/ratings')
        .send({ sportType: 'Basketball' });

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(ratingsService.submitActivityRating).not.toHaveBeenCalled();
    });

    it('when a rateeUid is missing => expected 400', async () => {
      const app = createApp();

      const res = await request(app)
        .post('/api/activities/activity-1/ratings')
        .send({ participantRatings: [{ stars: 5 }] });

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
    });

    it('when activity does not exist => expected 404', async () => {
      vi.mocked(ratingsService.submitActivityRating).mockRejectedValue(
        new Error('Activity not found'),
      );
      const app = createApp();

      const res = await request(app)
        .post('/api/activities/missing/ratings')
        .send({ participantRatings: [] });

      expect(res.status).toBe(404);
      expect(res.body.ok).toBe(false);
    });

    it('when rater did not take part => expected 403', async () => {
      vi.mocked(ratingsService.submitActivityRating).mockRejectedValue(
        new Error('Only the host or participants can rate this activity'),
      );
      const app = createApp();

      const res = await request(app)
        .post('/api/activities/activity-1/ratings')
        .send({ participantRatings: [] });

      expect(res.status).toBe(403);
      expect(res.body.ok).toBe(false);
    });

    it('when activity is not completed => expected 409', async () => {
      vi.mocked(ratingsService.submitActivityRating).mockRejectedValue(
        new Error('Activity must be completed before it can be rated'),
      );
      const app = createApp();

      const res = await request(app)
        .post('/api/activities/activity-1/ratings')
        .send({ participantRatings: [] });

      expect(res.status).toBe(409);
      expect(res.body.ok).toBe(false);
    });

    it('when activityStars is valid => forwarded to the service', async () => {
      vi.mocked(ratingsService.submitActivityRating).mockResolvedValue({
        ratingId: 'test-uid-1',
        updated: false,
      });
      const app = createApp();

      const res = await request(app)
        .post('/api/activities/activity-1/ratings')
        .send({
          sportType: 'Basketball',
          activityStars: 4,
          participantRatings: [{ rateeUid: 'user-2', stars: 5 }],
        });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(ratingsService.submitActivityRating).toHaveBeenCalledWith(
        expect.objectContaining({ activityStars: 4 }),
      );
    });

    it('when activityStars is out of range => expected 400', async () => {
      const app = createApp();

      for (const activityStars of [0, 6]) {
        vi.clearAllMocks();
        const res = await request(app)
          .post('/api/activities/activity-1/ratings')
          .send({
            activityStars,
            participantRatings: [{ rateeUid: 'user-2', stars: 5 }],
          });

        expect(res.status).toBe(400);
        expect(res.body.ok).toBe(false);
        expect(ratingsService.submitActivityRating).not.toHaveBeenCalled();
      }
    });

    it('when activityStars is absent => service input stays undefined', async () => {
      vi.mocked(ratingsService.submitActivityRating).mockResolvedValue({
        ratingId: 'test-uid-1',
        updated: false,
      });
      const app = createApp();

      const res = await request(app)
        .post('/api/activities/activity-1/ratings')
        .send({
          sportType: 'Basketball',
          participantRatings: [{ rateeUid: 'user-2', stars: 5 }],
        });

      expect(res.status).toBe(200);
      const call = vi.mocked(ratingsService.submitActivityRating).mock.calls[0][0];
      expect(call).not.toHaveProperty('activityStars');
    });
  });

  describe('GET /api/activities/:activityId/my-rating', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('when rated => expected hasRated true', async () => {
      vi.mocked(ratingsService.hasUserRated).mockResolvedValue(true);
      const app = createApp();

      const res = await request(app).get('/api/activities/activity-1/my-rating');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true, data: { hasRated: true } });
      expect(ratingsService.hasUserRated).toHaveBeenCalledWith('activity-1', 'test-uid-1');
    });

    it('when not rated => expected hasRated false', async () => {
      vi.mocked(ratingsService.hasUserRated).mockResolvedValue(false);
      const app = createApp();

      const res = await request(app).get('/api/activities/activity-1/my-rating');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true, data: { hasRated: false } });
    });
  });
});
