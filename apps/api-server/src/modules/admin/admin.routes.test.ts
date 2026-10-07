import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Stub each service so these tests focus on endpoint routing, defaults, and HTTP error mapping.
vi.mock('./members.service.js', () => ({
  ADMIN_MEMBERS_PAGE_LIMIT_DEFAULT: 20,
  ADMIN_MEMBERS_PAGE_LIMIT_MAX: 1000,
  listMembers: vi.fn(),
  getMemberDetail: vi.fn(),
  setMemberStatus: vi.fn(),
  deleteMember: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./activities.service.js', () => ({
  ADMIN_ACTIVITIES_LIMIT_DEFAULT: 20,
  ADMIN_ACTIVITIES_LIMIT_MAX: 1000,
  listAdminActivities: vi.fn(),
  setAdminActivityStatus: vi.fn().mockResolvedValue(undefined),
  deleteAdminActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./broadcasts.service.js', () => ({
  listBroadcasts: vi.fn(),
  createBroadcast: vi.fn(),
  updateBroadcast: vi.fn(),
  deleteBroadcast: vi.fn().mockResolvedValue(undefined),
  sendBroadcast: vi.fn(),
}));

vi.mock('./sports.service.js', () => ({
  listSports: vi.fn(),
  replaceSports: vi.fn(),
  updateSport: vi.fn(),
}));

vi.mock('./templates.service.js', () => ({
  listTemplates: vi.fn(),
  updateTemplate: vi.fn(),
}));

vi.mock('./analytics.service.js', () => ({
  getAnalytics: vi.fn(),
  getDashboard: vi.fn(),
}));

vi.mock('./audit.service.js', () => ({
  listAuditLog: vi.fn(),
  isAuditCategory: (v: unknown) =>
    v === 'Members' ||
    v === 'Activities' ||
    v === 'Appeals' ||
    v === 'Reports' ||
    v === 'Broadcasts' ||
    v === 'Sports' ||
    v === 'Templates',
}));

vi.mock('../appeals/appeals.service.js', () => ({
  submitAppeal: vi.fn(),
  listMyAppeals: vi.fn(),
  listAppeals: vi.fn(),
  decideAppeal: vi.fn(),
  isAppealStatus: (v: unknown) => v === 'pending' || v === 'approved' || v === 'rejected',
}));

vi.mock('../../middleware/auth.middleware.js', () => ({
  requireAuth: vi.fn((req, _res, next) => {
    req.auth = { uid: 'admin-1', token: {} as never };
    next();
  }),
  requireAuthAllowSuspended: vi.fn((req, _res, next) => {
    req.auth = { uid: 'user-1', token: {} as never };
    next();
  }),
  requireAdmin: vi.fn((_req, _res, next) => {
    next();
  }),
}));

import { createApp } from '../../app/app.js';
import * as membersService from './members.service.js';
import * as activitiesService from './activities.service.js';
import * as broadcastsService from './broadcasts.service.js';
import * as sportsService from './sports.service.js';
import * as templatesService from './templates.service.js';
import * as analyticsService from './analytics.service.js';
import * as auditService from './audit.service.js';
import * as appealsService from '../appeals/appeals.service.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('admin routes', () => {
  it('GET /api/admin/me returns the admin identity', async () => {
    const response = await request(createApp()).get('/api/admin/me');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      data: { uid: 'admin-1', email: null, admin: true },
    });
  });

  it('GET /api/admin/members lists members', async () => {
    vi.mocked(membersService.listMembers).mockResolvedValue([]);
    const response = await request(createApp()).get('/api/admin/members');
    expect(response.status).toBe(200);
    expect(membersService.listMembers).toHaveBeenCalledWith(20);
  });

  it('GET /api/admin/members/:uid maps NOT_FOUND to 404', async () => {
    vi.mocked(membersService.getMemberDetail).mockRejectedValue(new Error('User not found'));
    const response = await request(createApp()).get('/api/admin/members/u-1');
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('PATCH /api/admin/members/:uid/status maps INVALID_INPUT to 400', async () => {
    vi.mocked(membersService.setMemberStatus).mockRejectedValue(
      new Error('status must be active or suspended'),
    );
    const response = await request(createApp())
      .patch('/api/admin/members/u-1/status')
      .send({ status: 'admin' });
    expect(response.status).toBe(400);
  });

  it('DELETE /api/admin/members/:uid returns 200', async () => {
    const response = await request(createApp()).delete('/api/admin/members/u-1');
    expect(response.status).toBe(200);
  });

  it('PATCH /api/admin/activities/:id/status maps bad enum to 400', async () => {
    vi.mocked(activitiesService.setAdminActivityStatus).mockRejectedValue(
      new Error('status must be open, cancelled, completed, or removed'),
    );
    const response = await request(createApp())
      .patch('/api/admin/activities/a-1/status')
      .send({ status: 'hidden' });
    expect(response.status).toBe(400);
  });

  it('POST /api/admin/broadcasts returns 201', async () => {
    vi.mocked(broadcastsService.createBroadcast).mockResolvedValue({
      id: 'b-1',
    } as never);
    const response = await request(createApp())
      .post('/api/admin/broadcasts')
      .send({ title: 'Hi', message: 'Hello', audience: 'All Users' });
    expect(response.status).toBe(201);
  });

  it('POST /api/admin/broadcasts/:id/send maps double-send to 409', async () => {
    vi.mocked(broadcastsService.sendBroadcast).mockRejectedValue(
      new Error('Broadcast already sent'),
    );
    const response = await request(createApp()).post('/api/admin/broadcasts/b-1/send');
    expect(response.status).toBe(409);
  });

  it('PUT /api/admin/sports publishes the whole config', async () => {
    vi.mocked(sportsService.replaceSports).mockResolvedValue([] as never);
    const response = await request(createApp()).put('/api/admin/sports').send({ sports: [] });
    expect(response.status).toBe(200);
    expect(sportsService.replaceSports).toHaveBeenCalledWith([], 'admin-1', null);
  });

  it('GET /api/public/sports returns enabled rows without counts', async () => {
    vi.mocked(sportsService.listSports).mockResolvedValue([
      {
        id: 'tennis',
        name: 'Tennis',
        emoji: '🎾',
        enabled: true,
        showInFilter: true,
        showInOnboarding: true,
        canHost: true,
        sortOrder: 1,
        activityCount: 7,
      },
      {
        id: 'cricket',
        name: 'Cricket',
        emoji: '🏏',
        enabled: false,
        showInFilter: false,
        showInOnboarding: false,
        canHost: false,
        sortOrder: 2,
        activityCount: 0,
      },
    ] as never);
    const response = await request(createApp()).get('/api/public/sports');
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toEqual({
      id: 'tennis',
      name: 'Tennis',
      emoji: '🎾',
      showInFilter: true,
      showInOnboarding: true,
      canHost: true,
      sortOrder: 1,
    });
  });

  it('PATCH /api/admin/sports/:id maps boolean violation to 400', async () => {
    vi.mocked(sportsService.updateSport).mockRejectedValue(new Error('enabled must be a boolean'));
    const response = await request(createApp())
      .patch('/api/admin/sports/golf')
      .send({ enabled: 'yes' });
    expect(response.status).toBe(400);
  });

  it('PATCH /api/admin/templates/:id maps missing to 404', async () => {
    vi.mocked(templatesService.updateTemplate).mockRejectedValue(new Error('Template not found'));
    const response = await request(createApp())
      .patch('/api/admin/templates/activity.joined')
      .send({ title: 'Hi' });
    expect(response.status).toBe(404);
  });

  it('GET /api/admin/analytics and /api/admin/dashboard return 200', async () => {
    vi.mocked(analyticsService.getAnalytics).mockResolvedValue({} as never);
    vi.mocked(analyticsService.getDashboard).mockResolvedValue({} as never);
    const app = createApp();
    expect((await request(app).get('/api/admin/analytics')).status).toBe(200);
    expect((await request(app).get('/api/admin/dashboard')).status).toBe(200);
  });

  it('GET /api/admin/analytics?range=bogus returns 400', async () => {
    vi.mocked(analyticsService.getAnalytics).mockResolvedValue({} as never);
    const response = await request(createApp()).get('/api/admin/analytics?range=bogus');
    // Handler rejects before reaching the service.
    expect(response.status).toBe(400);
    expect(analyticsService.getAnalytics).not.toHaveBeenCalled();
  });

  it('service throw maps to 500 INTERNAL_ERROR', async () => {
    vi.mocked(membersService.listMembers).mockRejectedValue(new Error('boom'));
    const response = await request(createApp()).get('/api/admin/members');
    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe('INTERNAL_ERROR');
  });

  it('GET /api/admin/appeals lists pending by default', async () => {
    vi.mocked(appealsService.listAppeals).mockResolvedValue([]);
    const response = await request(createApp()).get('/api/admin/appeals');
    expect(response.status).toBe(200);
    expect(appealsService.listAppeals).toHaveBeenCalledWith('pending');
  });

  it('POST /api/admin/appeals/:id/approve maps double-decision to 409', async () => {
    vi.mocked(appealsService.decideAppeal).mockRejectedValue(new Error('Appeal already decided'));
    const response = await request(createApp())
      .post('/api/admin/appeals/ap-1/approve')
      .send({ note: 'ok' });
    expect(response.status).toBe(409);
  });

  it('POST /api/admin/appeals/:id/reject forwards the admin and optional note', async () => {
    vi.mocked(appealsService.decideAppeal).mockResolvedValue({} as never);
    const response = await request(createApp())
      .post('/api/admin/appeals/ap-1/reject')
      .send({ note: 'Evidence was reviewed.' });

    expect(response.status).toBe(200);
    expect(appealsService.decideAppeal).toHaveBeenCalledWith(
      'ap-1',
      'rejected',
      'admin-1',
      'Evidence was reviewed.',
    );
  });

  it('POST /api/appeals lets users file (201)', async () => {
    vi.mocked(appealsService.submitAppeal).mockResolvedValue({} as never);
    const response = await request(createApp())
      .post('/api/appeals')
      .send({ type: 'suspension', statement: 'Please review.' });
    expect(response.status).toBe(201);
    expect(appealsService.submitAppeal).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ type: 'suspension' }),
    );
  });

  it('POST /api/appeals maps duplicate pending to 409', async () => {
    vi.mocked(appealsService.submitAppeal).mockRejectedValue(
      new Error('A pending appeal of this type already exists'),
    );
    const response = await request(createApp())
      .post('/api/appeals')
      .send({ type: 'suspension', statement: 'Again.' });
    expect(response.status).toBe(409);
  });

  it('GET /api/admin/audit-log lists entries with default limit', async () => {
    vi.mocked(auditService.listAuditLog).mockResolvedValue([]);
    const response = await request(createApp()).get('/api/admin/audit-log');
    expect(response.status).toBe(200);
    expect(auditService.listAuditLog).toHaveBeenCalledWith({ limit: 50 });
  });

  it('GET /api/admin/audit-log?category= filters by category', async () => {
    vi.mocked(auditService.listAuditLog).mockResolvedValue([]);
    const response = await request(createApp()).get(
      '/api/admin/audit-log?category=Sports&adminUid=admin-1&limit=10',
    );
    expect(response.status).toBe(200);
    expect(auditService.listAuditLog).toHaveBeenCalledWith({
      category: 'Sports',
      adminUid: 'admin-1',
      limit: 10,
    });
  });

  it('GET /api/admin/audit-log?category=bogus returns 400', async () => {
    const response = await request(createApp()).get('/api/admin/audit-log?category=bogus');
    expect(response.status).toBe(400);
    expect(auditService.listAuditLog).not.toHaveBeenCalled();
  });

  it('GET /api/admin/audit-log?limit=0 returns 400', async () => {
    const response = await request(createApp()).get('/api/admin/audit-log?limit=0');
    expect(response.status).toBe(400);
  });
});
