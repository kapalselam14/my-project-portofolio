import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Keep persistence behind service mocks so this suite verifies the users HTTP contract.
vi.mock('./users.service.js', () => {
  return {
    bootstrapUser: vi.fn().mockResolvedValue({
      authUid: 'test-uid-1',
      email: 'user@example.com',
      created: true,
    }),
    getUserByAuthUid: vi.fn(),
    updateUserPhoto: vi.fn(),
    updateUserProfile: vi.fn(),
    getPublicUserProfile: vi.fn(),
    mintCustomToken: vi.fn().mockResolvedValue('custom-token-1'),
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
import * as usersService from './users.service.js';

describe('users routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/users/me', () => {
    it('when authenticated request body is valid => expected 201', async () => {
      const app = createApp();

      const response = await request(app).post('/api/users/me').send({
        email: 'user@example.com',
      });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        ok: true,
        data: {
          authUid: 'test-uid-1',
          email: 'user@example.com',
          created: true,
        },
      });
      expect(usersService.bootstrapUser).toHaveBeenCalledWith({
        authUid: 'test-uid-1',
        email: 'user@example.com',
      });
    });

    it('when authenticated user already has profile => expected 200', async () => {
      vi.mocked(usersService.bootstrapUser).mockResolvedValueOnce({
        authUid: 'test-uid-1',
        email: 'user@example.com',
        created: false,
      });

      const app = createApp();

      const response = await request(app).post('/api/users/me').send({
        email: 'user@example.com',
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ok: true,
        data: {
          authUid: 'test-uid-1',
          email: 'user@example.com',
          created: false,
        },
      });
    });

    it('when email is not a string => expected 400 w/ INVALID_INPUT', async () => {
      const app = createApp();

      const response = await request(app).post('/api/users/me').send({
        email: 123,
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'email must be a string',
        },
      });
    });

    it('when email is blank => expected 400 w/ EMPTY_INPUT', async () => {
      const app = createApp();

      const response = await request(app).post('/api/users/me').send({
        email: '   ',
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'EMPTY_INPUT',
          message: 'email is required',
        },
      });
    });

    it('when email already exists => expected 409 w/ CONFLICT', async () => {
      vi.mocked(usersService.bootstrapUser).mockRejectedValueOnce(
        new Error('Email already in use'),
      );

      const app = createApp();

      const response = await request(app).post('/api/users/me').send({
        email: 'user@example.com',
      });

      expect(response.status).toBe(409);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'CONFLICT',
          message: 'Email already in use',
        },
      });
    });

    it('when service throws unknown error => expected 500 w/ INTERNAL_ERROR', async () => {
      vi.mocked(usersService.bootstrapUser).mockRejectedValueOnce(new Error('Unknown error'));

      const app = createApp();

      const response = await request(app).post('/api/users/me').send({
        email: 'user@example.com',
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

  describe('GET /api/users/me', () => {
    it('when authenticated user exists => expected 200', async () => {
      vi.mocked(usersService.getUserByAuthUid).mockResolvedValueOnce({
        authUid: 'test-uid-1',
        email: 'user@example.com',
        createdAt: {
          toDate: () => new Date('2026-08-18T00:00:00Z'),
        } as never,
      });

      const app = createApp();

      const response = await request(app).get('/api/users/me');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        ok: true,
        data: {
          authUid: 'test-uid-1',
          email: 'user@example.com',
        },
      });
      expect(usersService.getUserByAuthUid).toHaveBeenCalledWith('test-uid-1');
    });

    it('when authenticated user is not found => expected 404 w/ NOT_FOUND', async () => {
      vi.mocked(usersService.getUserByAuthUid).mockResolvedValueOnce(null);

      const app = createApp();

      const response = await request(app).get('/api/users/me');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
        },
      });
    });

    it('when service throws unknown error => expected 500 w/ INTERNAL_ERROR', async () => {
      vi.mocked(usersService.getUserByAuthUid).mockRejectedValueOnce(new Error('Unknown error'));

      const app = createApp();

      const response = await request(app).get('/api/users/me');

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

  describe('PATCH /api/users/me', () => {
    it('when profile body is valid => expected 200', async () => {
      vi.mocked(usersService.updateUserProfile).mockResolvedValueOnce({
        authUid: 'test-uid-1',
        email: 'user@example.com',
        displayName: 'Test User',
        bio: 'I like futsal',
        skillLevel: 'intermediate',
        preferredSports: ['futsal', 'badminton'],
        preferredLocations: ['Auckland'],
        profileCompleted: true,
        createdAt: {
          toDate: () => new Date('2026-08-18T00:00:00Z'),
        } as never,
        updatedAt: {
          toDate: () => new Date('2026-09-06T00:00:00Z'),
        } as never,
      });

      const app = createApp();

      const response = await request(app)
        .patch('/api/users/me')
        .send({
          displayName: ' Test User ',
          bio: ' I like futsal ',
          skillLevel: 'intermediate',
          preferredSports: [' futsal ', 'badminton'],
          preferredLocations: [' Auckland '],
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        ok: true,
        data: {
          authUid: 'test-uid-1',
          email: 'user@example.com',
          displayName: 'Test User',
          bio: 'I like futsal',
          skillLevel: 'intermediate',
          preferredSports: ['futsal', 'badminton'],
          preferredLocations: ['Auckland'],
          profileCompleted: true,
        },
      });
      expect(usersService.updateUserProfile).toHaveBeenCalledWith('test-uid-1', {
        displayName: 'Test User',
        bio: 'I like futsal',
        skillLevel: 'intermediate',
        preferredSports: ['futsal', 'badminton'],
        preferredLocations: ['Auckland'],
      });
    });

    // NOTE: profile photos use the dedicated `PATCH /api/users/me/photo` endpoint (photoPath + photoUrl).

    it('when request body is empty => expected 400 w/ EMPTY_INPUT', async () => {
      const app = createApp();

      const response = await request(app).patch('/api/users/me').send({});

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'EMPTY_INPUT',
          message: 'at least one profile field is required',
        },
      });
    });

    it('when request body contains unsupported field => expected 400 w/ INVALID_INPUT', async () => {
      const app = createApp();

      const response = await request(app).patch('/api/users/me').send({
        email: 'new@example.com',
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'request body contains unsupported profile fields',
        },
      });
    });

    it('when request body contains photoUrl => expected 400 w/ INVALID_INPUT', async () => {
      const app = createApp();

      const response = await request(app).patch('/api/users/me').send({
        photoUrl: 'https://example.com/avatar.png',
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'request body contains unsupported profile fields',
        },
      });
    });

    it('when heightCm is valid => forwards it to the service', async () => {
      vi.mocked(usersService.updateUserProfile).mockResolvedValueOnce({
        authUid: 'test-uid-1',
        email: 'user@example.com',
        heightCm: 178,
        createdAt: {
          toDate: () => new Date('2026-08-18T00:00:00Z'),
        } as never,
        updatedAt: {
          toDate: () => new Date('2026-09-06T00:00:00Z'),
        } as never,
      });

      const app = createApp();

      const response = await request(app).patch('/api/users/me').send({ heightCm: 178 });

      expect(response.status).toBe(200);
      expect(usersService.updateUserProfile).toHaveBeenCalledWith('test-uid-1', { heightCm: 178 });
    });

    it.each([199.5, 20, 400, 'tall', true])(
      'when heightCm is %p => expected 400 w/ INVALID_INPUT',
      async (heightCm) => {
        const app = createApp();

        const response = await request(app).patch('/api/users/me').send({ heightCm });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
          ok: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'heightCm must be an integer between 50 and 300',
          },
        });
      },
    );

    it('when weightKg is valid => forwards it to the service', async () => {
      vi.mocked(usersService.updateUserProfile).mockResolvedValueOnce({
        authUid: 'test-uid-1',
        email: 'user@example.com',
        weightKg: 73,
        createdAt: {
          toDate: () => new Date('2026-08-18T00:00:00Z'),
        } as never,
        updatedAt: {
          toDate: () => new Date('2026-09-06T00:00:00Z'),
        } as never,
      });

      const app = createApp();

      const response = await request(app).patch('/api/users/me').send({ weightKg: 73 });

      expect(response.status).toBe(200);
      expect(usersService.updateUserProfile).toHaveBeenCalledWith('test-uid-1', { weightKg: 73 });
    });

    it.each([72.5, 10, 400, 'heavy', true])(
      'when weightKg is %p => expected 400 w/ INVALID_INPUT',
      async (weightKg) => {
        const app = createApp();

        const response = await request(app).patch('/api/users/me').send({ weightKg });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
          ok: false,
          error: {
            code: 'INVALID_INPUT',
            message: 'weightKg must be an integer between 30 and 300',
          },
        });
      },
    );

    it('when goal is valid => trims and forwards it to the service', async () => {
      vi.mocked(usersService.updateUserProfile).mockResolvedValueOnce({
        authUid: 'test-uid-1',
        email: 'user@example.com',
        goal: 'Run a half marathon',
        createdAt: {
          toDate: () => new Date('2026-08-18T00:00:00Z'),
        } as never,
        updatedAt: {
          toDate: () => new Date('2026-09-06T00:00:00Z'),
        } as never,
      });

      const app = createApp();

      const response = await request(app)
        .patch('/api/users/me')
        .send({ goal: '  Run a half marathon  ' });

      expect(response.status).toBe(200);
      expect(usersService.updateUserProfile).toHaveBeenCalledWith('test-uid-1', {
        goal: 'Run a half marathon',
      });
    });

    it('when goal is not a string => expected 400 w/ INVALID_INPUT', async () => {
      const app = createApp();

      const response = await request(app).patch('/api/users/me').send({ goal: 123 });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'goal must be a string',
        },
      });
    });

    it('when displayName is not a string => expected 400 w/ INVALID_INPUT', async () => {
      const app = createApp();

      const response = await request(app).patch('/api/users/me').send({
        displayName: 123,
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'displayName must be a string',
        },
      });
    });

    it('when skillLevel is invalid => expected 400 w/ INVALID_INPUT', async () => {
      const app = createApp();

      const response = await request(app).patch('/api/users/me').send({
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

    it('when preferredSports is not a string array => expected 400 w/ INVALID_INPUT', async () => {
      const app = createApp();

      const response = await request(app)
        .patch('/api/users/me')
        .send({
          preferredSports: ['futsal', 123],
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'preferredSports must be a string array',
        },
      });
    });

    it('when sportSkillLevels has an invalid level => expected 400 w/ INVALID_INPUT', async () => {
      const app = createApp();

      const response = await request(app)
        .patch('/api/users/me')
        .send({
          sportSkillLevels: { Tennis: 'expert' },
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message:
            'sportSkillLevels must map sport names to beginner, intermediate, advanced, or any',
        },
      });
    });

    it('when joinReason is not a string => expected 400 w/ INVALID_INPUT', async () => {
      const app = createApp();

      const response = await request(app).patch('/api/users/me').send({
        joinReason: 123,
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'joinReason must be a string',
        },
      });
    });

    it('when onboarding fields are valid => forwards them to updateUserProfile', async () => {
      vi.mocked(usersService.updateUserProfile).mockResolvedValueOnce({
        authUid: 'test-uid-1',
        email: 'user@example.com',
        createdAt: { toDate: () => new Date('2026-08-18T00:00:00Z') } as never,
      });

      const app = createApp();

      const response = await request(app)
        .patch('/api/users/me')
        .send({
          joinReason: ' Stay active with new sports ',
          preferredSports: ['Tennis'],
          sportSkillLevels: { Tennis: 'intermediate' },
          skillLevel: 'intermediate',
        });

      expect(response.status).toBe(200);
      expect(usersService.updateUserProfile).toHaveBeenCalledWith('test-uid-1', {
        joinReason: 'Stay active with new sports',
        preferredSports: ['Tennis'],
        sportSkillLevels: { Tennis: 'intermediate' },
        skillLevel: 'intermediate',
      });
    });

    it('when user is not found => expected 404 w/ NOT_FOUND', async () => {
      vi.mocked(usersService.updateUserProfile).mockRejectedValueOnce(new Error('User not found'));

      const app = createApp();

      const response = await request(app).patch('/api/users/me').send({
        displayName: 'Test User',
      });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
        },
      });
    });

    it('when service throws unknown error => expected 500 w/ INTERNAL_ERROR', async () => {
      vi.mocked(usersService.updateUserProfile).mockRejectedValueOnce(new Error('Unknown error'));

      const app = createApp();

      const response = await request(app).patch('/api/users/me').send({
        displayName: 'Test User',
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

  describe('PATCH /api/users/me/photo', () => {
    it('when photo metadata is valid => expected 200', async () => {
      vi.mocked(usersService.updateUserPhoto).mockResolvedValueOnce({
        authUid: 'test-uid-1',
        email: 'user@example.com',
        photoPath: 'users/test-uid-1/profile/avatar-1787200000000.jpg',
        photoUrl:
          'https://storage.googleapis.com/bucket/users/test-uid-1/profile/avatar-1787200000000.jpg',
        createdAt: {
          toDate: () => new Date('2026-08-18T00:00:00Z'),
        } as never,
        updatedAt: {
          toDate: () => new Date('2026-09-06T00:00:00Z'),
        } as never,
      });

      const app = createApp();

      const response = await request(app).patch('/api/users/me/photo').send({
        photoPath: 'users/test-uid-1/profile/avatar-1787200000000.jpg',
        photoUrl:
          'https://storage.googleapis.com/bucket/users/test-uid-1/profile/avatar-1787200000000.jpg',
      });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        ok: true,
        data: {
          authUid: 'test-uid-1',
          email: 'user@example.com',
          photoPath: 'users/test-uid-1/profile/avatar-1787200000000.jpg',
          photoUrl:
            'https://storage.googleapis.com/bucket/users/test-uid-1/profile/avatar-1787200000000.jpg',
        },
      });
      expect(usersService.updateUserPhoto).toHaveBeenCalledWith('test-uid-1', {
        photoPath: 'users/test-uid-1/profile/avatar-1787200000000.jpg',
        photoUrl:
          'https://storage.googleapis.com/bucket/users/test-uid-1/profile/avatar-1787200000000.jpg',
      });
    });

    it('when photo metadata is not string => expected 400 w/ INVALID_INPUT', async () => {
      const app = createApp();

      const response = await request(app).patch('/api/users/me/photo').send({
        photoPath: 123,
        photoUrl: 'https://storage.googleapis.com/bucket/avatar.jpg',
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'photoPath and photoUrl must be strings',
        },
      });
    });

    it('when photo metadata is blank => expected 400 w/ EMPTY_INPUT', async () => {
      const app = createApp();

      const response = await request(app).patch('/api/users/me/photo').send({
        photoPath: '   ',
        photoUrl: 'https://storage.googleapis.com/bucket/avatar.jpg',
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'EMPTY_INPUT',
          message: 'photoPath and photoUrl are required',
        },
      });
    });

    it('when photoPath belongs to another user => expected 403 w/ FORBIDDEN', async () => {
      const app = createApp();

      const response = await request(app).patch('/api/users/me/photo').send({
        photoPath: 'users/other-uid/profile/avatar-1787200000000.jpg',
        photoUrl:
          'https://storage.googleapis.com/bucket/users/other-uid/profile/avatar-1787200000000.jpg',
      });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'photoPath must belong to the authenticated user',
        },
      });
      expect(usersService.updateUserPhoto).not.toHaveBeenCalled();
    });

    it('when user is not found => expected 404 w/ NOT_FOUND', async () => {
      vi.mocked(usersService.updateUserPhoto).mockRejectedValueOnce(new Error('User not found'));

      const app = createApp();

      const response = await request(app).patch('/api/users/me/photo').send({
        photoPath: 'users/test-uid-1/profile/avatar-1787200000000.jpg',
        photoUrl:
          'https://storage.googleapis.com/bucket/users/test-uid-1/profile/avatar-1787200000000.jpg',
      });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
        },
      });
    });

    it('when service throws unknown error => expected 500 w/ INTERNAL_ERROR', async () => {
      vi.mocked(usersService.updateUserPhoto).mockRejectedValueOnce(new Error('Unknown error'));

      const app = createApp();

      const response = await request(app).patch('/api/users/me/photo').send({
        photoPath: 'users/test-uid-1/profile/avatar-1787200000000.jpg',
        photoUrl:
          'https://storage.googleapis.com/bucket/users/test-uid-1/profile/avatar-1787200000000.jpg',
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

  describe('GET /api/users/:uid/profile', () => {
    it('when public profile exists => expected 200', async () => {
      vi.mocked(usersService.getPublicUserProfile).mockResolvedValueOnce({
        authUid: 'other-uid',
        displayName: 'Other User',
        photoUrl: 'https://example.com/avatar.png',
        bio: 'Weekend player',
        skillLevel: 'beginner',
        preferredSports: ['futsal'],
        preferredLocations: ['Auckland'],
        profileCompleted: true,
      });

      const app = createApp();

      const response = await request(app).get('/api/users/other-uid/profile');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ok: true,
        data: {
          authUid: 'other-uid',
          displayName: 'Other User',
          photoUrl: 'https://example.com/avatar.png',
          bio: 'Weekend player',
          skillLevel: 'beginner',
          preferredSports: ['futsal'],
          preferredLocations: ['Auckland'],
          profileCompleted: true,
        },
      });
      expect(usersService.getPublicUserProfile).toHaveBeenCalledWith('other-uid');
    });

    it('when uid is blank => expected 400 w/ EMPTY_INPUT', async () => {
      const app = createApp();

      const response = await request(app).get('/api/users/%20%20/profile');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'EMPTY_INPUT',
          message: 'uid is required',
        },
      });
    });

    it('when public profile is not found => expected 404 w/ NOT_FOUND', async () => {
      vi.mocked(usersService.getPublicUserProfile).mockResolvedValueOnce(null);

      const app = createApp();

      const response = await request(app).get('/api/users/missing-user/profile');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
        },
      });
    });

    it('when service throws unknown error => expected 500 w/ INTERNAL_ERROR', async () => {
      vi.mocked(usersService.getPublicUserProfile).mockRejectedValueOnce(
        new Error('Unknown error'),
      );

      const app = createApp();

      const response = await request(app).get('/api/users/test-uid-1/profile');

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

  describe('POST /api/users/custom-token', () => {
    it('when authenticated => expected 200 with custom token', async () => {
      const app = createApp();

      const response = await request(app).post('/api/users/custom-token').send({});

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ok: true,
        data: {
          customToken: 'custom-token-1',
        },
      });
      expect(usersService.mintCustomToken).toHaveBeenCalledWith('test-uid-1');
    });

    it('when service throws unknown error => expected 500 w/ INTERNAL_ERROR', async () => {
      vi.mocked(usersService.mintCustomToken).mockRejectedValueOnce(new Error('Unknown error'));

      const app = createApp();

      const response = await request(app).post('/api/users/custom-token').send({});

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
