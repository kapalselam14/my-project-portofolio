// Verify the authenticated device registration, list, and delete routes and their error mappings.
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./devices.service.js', () => {
  return {
    registerDevice: vi.fn().mockResolvedValue(undefined),
    listDevices: vi.fn(),
    deleteDevice: vi.fn().mockResolvedValue(undefined),
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
import * as devicesService from './devices.service.js';

describe('devices routes', () => {
  describe('POST /api/devices', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('when request body is valid => expected 200', async () => {
      const app = createApp();

      const response = await request(app).post('/api/devices').send({
        deviceId: 'device-1',
        fcmToken: 'fcm-token-1',
        platform: 'android',
        uid: 'forged-user',
      });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ok: true,
        data: {
          uid: 'test-uid-1',
          deviceId: 'device-1',
          platform: 'android',
        },
      });
      expect(devicesService.registerDevice).toHaveBeenCalledWith({
        uid: 'test-uid-1',
        deviceId: 'device-1',
        fcmToken: 'fcm-token-1',
        platform: 'android',
      });
    });

    it('when required fields are not strings => expected 400 w/ INVALID_INPUT', async () => {
      const app = createApp();

      const response = await request(app).post('/api/devices').send({
        deviceId: 123,
        fcmToken: 'fcm-token-1',
        platform: 'android',
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'deviceId, fcmToken, and platform must be strings',
        },
      });
    });

    it('when platform is invalid => expected 400 w/ INVALID_INPUT', async () => {
      const app = createApp();

      const response = await request(app).post('/api/devices').send({
        deviceId: 'device-1',
        fcmToken: 'fcm-token-1',
        platform: 'desktop',
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'platform must be ios, android, or web',
        },
      });
    });

    it('when required fields are blank => expected 400 w/ EMPTY_INPUT', async () => {
      const app = createApp();

      const response = await request(app).post('/api/devices').send({
        deviceId: '   ',
        fcmToken: 'fcm-token-1',
        platform: 'android',
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'EMPTY_INPUT',
          message: 'deviceId and fcmToken are required',
        },
      });
    });

    it('when service throws unknown error => expected 500 w/ INTERNAL_ERROR', async () => {
      vi.mocked(devicesService.registerDevice).mockRejectedValueOnce(new Error('Unknown error'));

      const app = createApp();

      const response = await request(app).post('/api/devices').send({
        deviceId: 'device-1',
        fcmToken: 'fcm-token-1',
        platform: 'android',
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

  describe('GET /api/devices/me', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('when authenticated user devices exist => expected 200', async () => {
      vi.mocked(devicesService.listDevices).mockResolvedValueOnce([
        {
          deviceId: 'device-1',
          uid: 'test-uid-1',
          fcmToken: 'fcm-token-1',
          platform: 'android',
          createdAt: { toDate: () => new Date('2026-08-30T00:00:00Z') } as never,
          updatedAt: { toDate: () => new Date('2026-08-30T00:00:00Z') } as never,
        },
      ]);

      const app = createApp();

      const response = await request(app).get('/api/devices/me');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        ok: true,
        data: [
          {
            deviceId: 'device-1',
            uid: 'test-uid-1',
            fcmToken: 'fcm-token-1',
            platform: 'android',
          },
        ],
      });
      expect(devicesService.listDevices).toHaveBeenCalledWith('test-uid-1');
    });

    it('when authenticated user has no devices => expected 200', async () => {
      vi.mocked(devicesService.listDevices).mockResolvedValueOnce([]);

      const app = createApp();

      const response = await request(app).get('/api/devices/me');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ok: true,
        data: [],
      });
      expect(devicesService.listDevices).toHaveBeenCalledWith('test-uid-1');
    });

    it('when service throws unknown error => expected 500 w/ INTERNAL_ERROR', async () => {
      vi.mocked(devicesService.listDevices).mockRejectedValueOnce(new Error('Unknown error'));

      const app = createApp();

      const response = await request(app).get('/api/devices/me');

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

  describe('DELETE /api/devices/me/:deviceId', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('when authenticated user deletes own device => expected 200', async () => {
      const app = createApp();

      const response = await request(app).delete('/api/devices/me/device-1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ok: true,
        data: {
          uid: 'test-uid-1',
          deviceId: 'device-1',
        },
      });
      expect(devicesService.deleteDevice).toHaveBeenCalledWith('test-uid-1', 'device-1');
    });

    it('when deviceId is blank => expected 400 w/ EMPTY_INPUT', async () => {
      const app = createApp();

      const response = await request(app).delete('/api/devices/me/%20%20');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'EMPTY_INPUT',
          message: 'deviceId is required',
        },
      });
    });

    it('when device is not found => expected 404 w/ NOT_FOUND', async () => {
      vi.mocked(devicesService.deleteDevice).mockRejectedValueOnce(new Error('Device not found'));

      const app = createApp();

      const response = await request(app).delete('/api/devices/me/missing-device');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Device not found',
        },
      });
    });

    it('when service throws unknown error => expected 500 w/ INTERNAL_ERROR', async () => {
      vi.mocked(devicesService.deleteDevice).mockRejectedValueOnce(new Error('Unknown error'));

      const app = createApp();

      const response = await request(app).delete('/api/devices/me/device-1');

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
