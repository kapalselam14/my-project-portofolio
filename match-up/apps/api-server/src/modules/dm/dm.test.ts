// Tests for dm.
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./dm.service.js', () => ({
  resolveThread: vi.fn().mockResolvedValue({ conversationId: 'a_b' }),
  listDmMessages: vi.fn().mockResolvedValue([]),
  sendDmMessage: vi.fn().mockResolvedValue({ messageId: 'm-1', conversationId: 'a_b' }),
  listDmConversations: vi.fn().mockResolvedValue([]),
  markDmThreadRead: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../middleware/auth.middleware.js', () => ({
  requireAuth: vi.fn((req, _res, next) => {
    req.auth = { uid: 'test-uid-1', token: {} as never };
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
}));

import { createApp } from '../../app/app.js';
import * as dmService from './dm.service.js';

describe('dm routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /api/dm/:uid/thread resolves the pair', async () => {
    const app = createApp();
    const response = await request(app).get('/api/dm/peer-9/thread');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      data: { conversationId: 'a_b' },
    });
    expect(dmService.resolveThread).toHaveBeenCalledWith('test-uid-1', 'peer-9');
  });

  it('GET /api/dm/:uid/messages lists history', async () => {
    const app = createApp();
    const response = await request(app).get('/api/dm/peer-9/messages?limit=10');

    expect(response.status).toBe(200);
    expect(dmService.listDmMessages).toHaveBeenCalledWith('test-uid-1', 'peer-9', 10);
  });

  it('POST /api/dm/:uid/messages sends', async () => {
    const app = createApp();
    const response = await request(app).post('/api/dm/peer-9/messages').send({ text: 'hey' });

    expect(response.status).toBe(201);
    expect(dmService.sendDmMessage).toHaveBeenCalledWith('test-uid-1', 'peer-9', 'hey');
  });

  it('POST rejects blank text', async () => {
    const app = createApp();
    const response = await request(app).post('/api/dm/peer-9/messages').send({ text: '   ' });

    expect(response.status).toBe(400);
  });

  it('maps unknown peer to 404', async () => {
    vi.mocked(dmService.resolveThread).mockRejectedValueOnce(new Error('User not found'));
    const app = createApp();
    const response = await request(app).get('/api/dm/ghost/thread');

    expect(response.status).toBe(404);
  });
});

describe('dm inbox routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /api/dm/conversations lists the inbox', async () => {
    vi.mocked(dmService.listDmConversations).mockResolvedValue([
      {
        peerUid: 'peer-1',
        displayName: 'Peer One',
        lastText: 'hey',
        lastTimestamp: 123,
        lastSenderId: 'peer-1',
        unreadCount: 2,
      },
    ]);
    const app = createApp();
    const response = await request(app).get('/api/dm/conversations');

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(dmService.listDmConversations).toHaveBeenCalledWith('test-uid-1');
  });

  it('POST /api/dm/:uid/read clears the badge', async () => {
    vi.mocked(dmService.markDmThreadRead).mockResolvedValue(undefined);
    const app = createApp();
    const response = await request(app).post('/api/dm/peer-1/read').send({});

    expect(response.status).toBe(200);
    expect(dmService.markDmThreadRead).toHaveBeenCalledWith('test-uid-1', 'peer-1');
  });
});
