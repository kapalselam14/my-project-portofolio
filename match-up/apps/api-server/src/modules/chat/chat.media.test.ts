// Tests for chat.media.
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./chat.service.js', () => {
  return {
    sendMessage: vi.fn().mockResolvedValue({ messageId: 'msg-1' }),
    sendImageMessage: vi.fn().mockResolvedValue({ messageId: 'msg-img-1' }),
    sendLocationMessage: vi.fn().mockResolvedValue({ messageId: 'msg-loc-1' }),
    getMessages: vi.fn().mockResolvedValue([]),
    listConversations: vi.fn(),
    toggleReaction: vi.fn().mockResolvedValue({ reacted: true }),
    getReactions: vi.fn().mockResolvedValue({}),
    getMessageReactions: vi.fn().mockResolvedValue({}),
    createPoll: vi.fn().mockResolvedValue({ pollId: 'poll-1' }),
    getPolls: vi.fn().mockResolvedValue([]),
    votePoll: vi.fn().mockResolvedValue({ voted: true }),
  };
});

vi.mock('../activities/activity-participants.service.js', () => {
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
import * as chatService from './chat.service.js';
import * as activityParticipantsService from '../activities/activity-participants.service.js';

describe('chat media + conversations routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/chat/:activityId/messages/image', () => {
    it('when imageUrl is a valid https URL => expected 201', async () => {
      const app = createApp();

      const response = await request(app)
        .post('/api/chat/activity-1/messages/image')
        .send({ imageUrl: 'https://storage.googleapis.com/bucket/photo.jpg' });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        ok: true,
        data: { messageId: 'msg-img-1' },
      });
      expect(chatService.sendImageMessage).toHaveBeenCalledWith(
        'activity-1',
        'test-uid-1',
        'https://storage.googleapis.com/bucket/photo.jpg',
      );
    });

    it('when imageUrl is http => expected 400 w/ INVALID_INPUT', async () => {
      const app = createApp();

      const response = await request(app)
        .post('/api/chat/activity-1/messages/image')
        .send({ imageUrl: 'http://example.com/photo.jpg' });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        ok: false,
        error: { code: 'INVALID_INPUT' },
      });
      expect(chatService.sendImageMessage).not.toHaveBeenCalled();
    });

    it('when user is not a member => expected 403 w/ FORBIDDEN', async () => {
      vi.mocked(activityParticipantsService.canAccessActivityChat).mockResolvedValueOnce(false);

      const app = createApp();

      const response = await request(app)
        .post('/api/chat/activity-1/messages/image')
        .send({ imageUrl: 'https://example.com/photo.jpg' });

      expect(response.status).toBe(403);
      expect(chatService.sendImageMessage).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/chat/:activityId/messages/location', () => {
    it('when coordinates are valid => expected 201', async () => {
      const app = createApp();

      const response = await request(app)
        .post('/api/chat/activity-1/messages/location')
        .send({ latitude: -36.8585, longitude: 174.775 });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        ok: true,
        data: { messageId: 'msg-loc-1' },
      });
      expect(chatService.sendLocationMessage).toHaveBeenCalledWith(
        'activity-1',
        'test-uid-1',
        -36.8585,
        174.775,
      );
    });

    it.each([
      { name: 'latitude out of range', body: { latitude: 91, longitude: 0 } },
      { name: 'longitude out of range', body: { latitude: 0, longitude: 181 } },
      { name: 'non-numeric latitude', body: { latitude: 'north', longitude: 0 } },
    ])('when $name => expected 400 w/ INVALID_INPUT', async ({ body }) => {
      const app = createApp();

      const response = await request(app).post('/api/chat/activity-1/messages/location').send(body);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        ok: false,
        error: { code: 'INVALID_INPUT' },
      });
      expect(chatService.sendLocationMessage).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/chat/conversations', () => {
    it('when user has group chats => expected 200 with previews', async () => {
      vi.mocked(chatService.listConversations).mockResolvedValueOnce([
        {
          activityId: 'a-1',
          title: 'Evening Futsal',
          lastMessage: 'See you at 6!',
          lastMessageAt: 1787000000000,
          unreadCount: 0,
        },
        {
          activityId: 'a-2',
          title: 'Morning Run',
          lastMessage: null,
          lastMessageAt: null,
          unreadCount: 0,
        },
      ]);

      const app = createApp();
      const response = await request(app).get('/api/chat/conversations');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ok: true,
        data: [
          {
            activityId: 'a-1',
            title: 'Evening Futsal',
            lastMessage: 'See you at 6!',
            lastMessageAt: 1787000000000,
            unreadCount: 0,
          },
          {
            activityId: 'a-2',
            title: 'Morning Run',
            lastMessage: null,
            lastMessageAt: null,
            unreadCount: 0,
          },
        ],
      });
      expect(chatService.listConversations).toHaveBeenCalledWith('test-uid-1');
    });

    it('when service throws => expected 500 w/ INTERNAL_ERROR', async () => {
      vi.mocked(chatService.listConversations).mockRejectedValueOnce(new Error('Unknown error'));

      const app = createApp();
      const response = await request(app).get('/api/chat/conversations');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        ok: false,
        error: { code: 'INTERNAL_ERROR', message: 'Unknown error' },
      });
    });
  });
});
