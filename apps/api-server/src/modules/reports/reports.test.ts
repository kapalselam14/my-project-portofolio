import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./reports.service.js', () => {
  return {
    submitReport: vi.fn().mockResolvedValue({ reportId: 'report-1', autoHidden: false }),
    listReports: vi.fn().mockResolvedValue([]),
    resolveReport: vi.fn().mockResolvedValue(undefined),
    dismissReport: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('../notifications/notifications.service.js', () => {
  return {
    createNotification: vi.fn().mockResolvedValue({ notificationId: 'n-1' }),
    renderTemplate: vi.fn().mockResolvedValue(null),
    displayNameOf: vi.fn().mockResolvedValue(''),
  };
});

// Controller reads the report doc best-effort for the reporter notice —
// keep it hermetic (no network) with a missing doc.
vi.mock('../../database/firebase.js', () => {
  return {
    firestore: {
      collection: vi.fn().mockReturnValue({
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ exists: false }),
        }),
      }),
    },
    auth: {},
    rtdb: {},
  };
});

let adminPass = true;

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

    requireAdmin: vi.fn((req, res, next) => {
      if (adminPass) {
        next();
        return;
      }
      res.status(403).json({
        ok: false,
        error: { code: 'FORBIDDEN', message: 'Admin access is required' },
      });
    }),
  };
});

export function __setAdminPass(value: boolean) {
  adminPass = value;
}

import { createApp } from '../../app/app.js';
import * as reportsService from './reports.service.js';

describe('reports routes', () => {
  describe('POST /api/reports', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('when request body is valid => expected 201', async () => {
      const app = createApp();

      const response = await request(app).post('/api/reports').send({
        targetId: 'activity-1',
        targetType: 'activity',
        reason: 'Spam / Fake activity',
        details: 'Looks copy-pasted',
      });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        ok: true,
        data: {
          reportId: 'report-1',
          autoHidden: false,
        },
      });
      expect(reportsService.submitReport).toHaveBeenCalledWith({
        reporterId: 'test-uid-1',
        targetId: 'activity-1',
        targetType: 'activity',
        reason: 'Spam / Fake activity',
        details: 'Looks copy-pasted',
      });
    });

    it('when details is omitted => expected 201 without details', async () => {
      const app = createApp();

      const response = await request(app).post('/api/reports').send({
        targetId: 'user-2',
        targetType: 'user',
        reason: 'Harassment',
      });

      expect(response.status).toBe(201);
      expect(reportsService.submitReport).toHaveBeenCalledWith({
        reporterId: 'test-uid-1',
        targetId: 'user-2',
        targetType: 'user',
        reason: 'Harassment',
      });
    });

    it('when evidenceUrls is a valid string array => expected 201 with evidenceUrls forwarded', async () => {
      const app = createApp();

      const response = await request(app)
        .post('/api/reports')
        .send({
          targetId: 'activity-1',
          targetType: 'activity',
          reason: 'Spam / Fake activity',
          evidenceUrls: ['https://example.com/a.jpg'],
        });

      expect(response.status).toBe(201);
      expect(reportsService.submitReport).toHaveBeenCalledWith({
        reporterId: 'test-uid-1',
        targetId: 'activity-1',
        targetType: 'activity',
        reason: 'Spam / Fake activity',
        evidenceUrls: ['https://example.com/a.jpg'],
      });
    });

    it.each([
      { name: 'evidenceUrls is not an array', evidenceUrls: 'https://example.com/a.jpg' },
      { name: 'evidenceUrls contains a non-string', evidenceUrls: [123] },
    ])('when $name => expected 400 w/ INVALID_INPUT', async ({ evidenceUrls }) => {
      const app = createApp();

      const response = await request(app).post('/api/reports').send({
        targetId: 'activity-1',
        targetType: 'activity',
        reason: 'Spam / Fake activity',
        evidenceUrls,
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'evidenceUrls must be an array of strings',
        },
      });
      expect(reportsService.submitReport).not.toHaveBeenCalled();
    });

    it.each([
      {
        name: 'targetId is not a string',
        body: { targetId: 123, targetType: 'user', reason: 'Spam' },
      },
      {
        name: 'reason is not a string',
        body: { targetId: 'user-2', targetType: 'user', reason: 123 },
      },
      {
        name: 'details is not a string',
        body: {
          targetId: 'user-2',
          targetType: 'user',
          reason: 'Spam',
          details: 123,
        },
      },
    ])('when $name => expected 400 w/ INVALID_INPUT', async ({ body }) => {
      const app = createApp();

      const response = await request(app).post('/api/reports').send(body);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'targetId and reason must be strings',
        },
      });
      expect(reportsService.submitReport).not.toHaveBeenCalled();
    });

    it('when targetType is invalid => expected 400 w/ INVALID_INPUT', async () => {
      const app = createApp();

      const response = await request(app).post('/api/reports').send({
        targetId: 'activity-1',
        targetType: 'group',
        reason: 'Spam',
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'targetType must be user or activity',
        },
      });
      expect(reportsService.submitReport).not.toHaveBeenCalled();
    });

    it.each([
      {
        name: 'targetId is blank',
        body: { targetId: '   ', targetType: 'user', reason: 'Spam' },
      },
      {
        name: 'reason is blank',
        body: { targetId: 'user-2', targetType: 'user', reason: '   ' },
      },
    ])('when $name => expected 400 w/ EMPTY_INPUT', async ({ body }) => {
      const app = createApp();

      const response = await request(app).post('/api/reports').send(body);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'EMPTY_INPUT',
          message: 'targetId and reason are required',
        },
      });
      expect(reportsService.submitReport).not.toHaveBeenCalled();
    });

    it('when target does not exist => expected 404 w/ NOT_FOUND', async () => {
      vi.mocked(reportsService.submitReport).mockRejectedValueOnce(new Error('Target not found'));

      const app = createApp();

      const response = await request(app).post('/api/reports').send({
        targetId: 'missing-activity',
        targetType: 'activity',
        reason: 'Spam',
      });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Target not found',
        },
      });
    });

    it('when user reports themselves => expected 400 w/ INVALID_INPUT', async () => {
      vi.mocked(reportsService.submitReport).mockRejectedValueOnce(
        new Error('cannot report yourself'),
      );

      const app = createApp();

      const response = await request(app).post('/api/reports').send({
        targetId: 'test-uid-1',
        targetType: 'user',
        reason: 'Spam',
      });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'cannot report yourself',
        },
      });
    });

    it('when service throws unknown error => expected 500 w/ INTERNAL_ERROR', async () => {
      vi.mocked(reportsService.submitReport).mockRejectedValueOnce(new Error('Unknown error'));

      const app = createApp();

      const response = await request(app).post('/api/reports').send({
        targetId: 'activity-1',
        targetType: 'activity',
        reason: 'Spam',
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
});

describe('triage routes (admin)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __setAdminPass(true);
  });

  it('GET /api/reports lists with status filter', async () => {
    const app = createApp();

    const response = await request(app).get('/api/reports?status=pending&limit=10');

    expect(response.status).toBe(200);
    expect(reportsService.listReports).toHaveBeenCalledWith({
      status: 'pending',
      limit: 10,
    });
  });

  it('GET /api/reports rejects a bad status', async () => {
    const app = createApp();

    const response = await request(app).get('/api/reports?status=archived');

    expect(response.status).toBe(400);
  });

  it('GET /api/reports returns 403 for non-admins', async () => {
    __setAdminPass(false);
    const app = createApp();

    const response = await request(app).get('/api/reports');

    expect(response.status).toBe(403);
    expect(reportsService.listReports).not.toHaveBeenCalled();
  });

  it('POST /api/reports/:id/resolve forwards note', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/api/reports/r-1/resolve')
      .send({ note: 'User warned' });

    expect(response.status).toBe(200);
    expect(reportsService.resolveReport).toHaveBeenCalledWith({
      reportId: 'r-1',
      adminUid: 'test-uid-1',
      note: 'User warned',
    });
  });

  it('POST /api/reports/:id/dismiss works without a note', async () => {
    const app = createApp();

    const response = await request(app).post('/api/reports/r-2/dismiss').send({});

    expect(response.status).toBe(200);
    expect(reportsService.dismissReport).toHaveBeenCalledWith({
      reportId: 'r-2',
      adminUid: 'test-uid-1',
    });
  });

  it('POST /api/reports/:id/resolve maps missing to 404', async () => {
    vi.mocked(reportsService.resolveReport).mockRejectedValueOnce(new Error('Report not found'));
    const app = createApp();

    const response = await request(app).post('/api/reports/r-9/resolve').send({});

    expect(response.status).toBe(404);
  });

  it('POST /api/reports/:id/resolve maps triaged to 409', async () => {
    vi.mocked(reportsService.resolveReport).mockRejectedValueOnce(
      new Error('Report is no longer pending'),
    );
    const app = createApp();

    const response = await request(app).post('/api/reports/r-9/resolve').send({});

    expect(response.status).toBe(409);
  });

  it('POST /api/reports/:id/dismiss returns 403 for non-admins', async () => {
    __setAdminPass(false);
    const app = createApp();

    const response = await request(app).post('/api/reports/r-2/dismiss').send({});

    expect(response.status).toBe(403);
    expect(reportsService.dismissReport).not.toHaveBeenCalled();
  });
});
