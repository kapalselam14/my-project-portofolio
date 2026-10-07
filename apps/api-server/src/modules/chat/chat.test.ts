import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Stub message storage and membership checks so this suite exercises the chat HTTP contract.
vi.mock('./chat.service.js', () => {
  return {
    listConversations: vi.fn().mockResolvedValue([]),
    sendMessage: vi.fn().mockResolvedValue({ messageId: 'msg-1' }),
    sendImageMessage: vi.fn().mockResolvedValue({ messageId: 'image-1' }),
    sendLocationMessage: vi.fn().mockResolvedValue({ messageId: 'location-1' }),
    getMessages: vi.fn(),
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

describe('chat routes', () => {
  describe('GET /api/chat/conversations', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('returns the signed-in user’s conversation previews', async () => {
      vi.mocked(chatService.listConversations).mockResolvedValueOnce([
        {
          activityId: 'activity-1',
          title: 'Sunday football',
          lastMessage: 'See you there',
          lastMessageAt: 1787000000000,
          unreadCount: 0,
        },
      ]);

      const response = await request(createApp()).get('/api/chat/conversations');

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual([
        {
          activityId: 'activity-1',
          title: 'Sunday football',
          lastMessage: 'See you there',
          lastMessageAt: 1787000000000,
          unreadCount: 0,
        },
      ]);
      expect(chatService.listConversations).toHaveBeenCalledWith('test-uid-1');
    });
  });

  describe('POST /api/chat/:activityId/messages/image', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('sends a valid image URL as an authenticated activity message', async () => {
      const response = await request(createApp())
        .post('/api/chat/activity-1/messages/image')
        .send({ imageUrl: 'https://example.com/photo.jpg' });

      expect(response.status).toBe(201);
      expect(response.body.data).toEqual({ messageId: 'image-1' });
      expect(chatService.sendImageMessage).toHaveBeenCalledWith(
        'activity-1',
        'test-uid-1',
        'https://example.com/photo.jpg',
      );
    });

    it('rejects non-HTTPS image URLs before calling the service', async () => {
      const response = await request(createApp())
        .post('/api/chat/activity-1/messages/image')
        .send({ imageUrl: 'http://example.com/photo.jpg' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_INPUT');
      expect(chatService.sendImageMessage).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/chat/:activityId/messages/location', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('sends a validated coordinate pair as an authenticated activity message', async () => {
      const response = await request(createApp())
        .post('/api/chat/activity-1/messages/location')
        .send({ latitude: -36.8485, longitude: 174.7633 });

      expect(response.status).toBe(201);
      expect(response.body.data).toEqual({ messageId: 'location-1' });
      expect(chatService.sendLocationMessage).toHaveBeenCalledWith(
        'activity-1',
        'test-uid-1',
        -36.8485,
        174.7633,
      );
    });

    it('rejects coordinates outside geographic bounds before calling the service', async () => {
      const response = await request(createApp())
        .post('/api/chat/activity-1/messages/location')
        .send({ latitude: 91, longitude: 174.7633 });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_INPUT');
      expect(chatService.sendLocationMessage).not.toHaveBeenCalled();
    });
  });

  /** Test section for chat POST route. */
  describe('POST /api/chat/messages', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('when request body is valid => expected 201', async () => {
      const app = createApp();

      const response = await request(app).post('/api/chat/messages').send({
        activityId: 'activity-1',
        text: 'Hello from chat',
        type: 'text',
      });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        ok: true,
        data: {
          messageId: 'msg-1',
        },
      });
      expect(activityParticipantsService.canAccessActivityChat).toHaveBeenCalledWith(
        'activity-1',
        'test-uid-1',
      );
    });

    it('when activityId is not a string => expected 400 w/ INVALID_INPUT', async () => {
      const app = createApp();

      const response = await request(app).post('/api/chat/messages').send({
        activityId: 123,
        text: 'Hello from chat',
        type: 'text',
      });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Invalid request body',
          details: { activityId: expect.any(Array) },
        },
      });
    });

    it('when text is not a string => expected 400 w/ INVALID_INPUT', async () => {
      const app = createApp();

      const response = await request(app).post('/api/chat/messages').send({
        activityId: 'activity-1',
        text: 123,
        type: 'text',
      });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Invalid request body',
          details: { text: expect.any(Array) },
        },
      });
    });

    it('when type is invalid => expected 400 w/ INVALID_INPUT', async () => {
      const app = createApp();

      const response = await request(app).post('/api/chat/messages').send({
        activityId: 'activity-1',
        text: 'Hello from chat',
        type: 'image',
      });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Invalid request body',
          details: { type: expect.any(Array) },
        },
      });
    });

    it.each([
      {
        name: 'activityId is blank',
        body: { activityId: '   ', text: 'Hello', type: 'text' },
      },
      {
        name: 'text is blank',
        body: { activityId: 'activity-1', text: '   ', type: 'text' },
      },
    ])('when $name => expected 400 w/ INVALID_INPUT', async ({ body }) => {
      const app = createApp();

      const response = await request(app).post('/api/chat/messages').send(body);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Invalid request body',
        },
      });
    });

    it('when text exceeds 2000 chars => expected 400 w/ INVALID_INPUT', async () => {
      const app = createApp();

      const response = await request(app)
        .post('/api/chat/messages')
        .send({
          activityId: 'activity-1',
          text: 'x'.repeat(2001),
          type: 'text',
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          details: { text: expect.any(Array) },
        },
      });
    });

    it('when service throws unknown error => expected 500 w/ INTERNAL_ERROR', async () => {
      vi.mocked(chatService.sendMessage).mockRejectedValueOnce(new Error('Unknown error'));

      const app = createApp();

      const response = await request(app).post('/api/chat/messages').send({
        activityId: 'activity-1',
        text: 'Hello from chat',
        type: 'text',
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

    it('when chat is archived => expected 403 w/ CHAT_ARCHIVED', async () => {
      vi.mocked(chatService.sendMessage).mockRejectedValueOnce(new Error('Chat is archived'));

      const response = await request(createApp()).post('/api/chat/messages').send({
        activityId: 'activity-1',
        text: 'Hello from chat',
      });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('CHAT_ARCHIVED');
    });

    it('when authenticated user is not host or participant => expected 403 w/ FORBIDDEN', async () => {
      vi.mocked(activityParticipantsService.canAccessActivityChat).mockResolvedValueOnce(false);

      const app = createApp();

      const response = await request(app).post('/api/chat/messages').send({
        activityId: 'activity-1',
        text: 'Hello from chat',
        type: 'text',
      });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only the activity host or participants can access this chat',
        },
      });
      expect(chatService.sendMessage).not.toHaveBeenCalled();
    });

    it('when activity is not found => expected 404 w/ NOT_FOUND', async () => {
      vi.mocked(activityParticipantsService.canAccessActivityChat).mockRejectedValueOnce(
        new Error('Activity not found'),
      );

      const app = createApp();

      const response = await request(app).post('/api/chat/messages').send({
        activityId: 'missing-activity',
        text: 'Hello from chat',
        type: 'text',
      });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Activity not found',
        },
      });
      expect(chatService.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/chat/:activityId/messages', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('when messages exist => expected 200', async () => {
      vi.mocked(chatService.getMessages).mockResolvedValueOnce([
        {
          messageId: 'msg-1',
          senderId: 'test-uid-1',
          text: 'Hello from chat',
          type: 'text',
          timestamp: 1787000000000,
        },
      ]);

      const app = createApp();

      const response = await request(app).get('/api/chat/activity-1/messages');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ok: true,
        data: [
          {
            messageId: 'msg-1',
            senderId: 'test-uid-1',
            text: 'Hello from chat',
            type: 'text',
            timestamp: 1787000000000,
          },
        ],
      });
      expect(activityParticipantsService.canAccessActivityChat).toHaveBeenCalledWith(
        'activity-1',
        'test-uid-1',
      );
    });

    it('when activityId is blank => expected 400 w/ INVALID_INPUT', async () => {
      // Blank path params are now rejected by `validateParams` with the unified INVALID_INPUT envelope.
      const app = createApp();

      const response = await request(app).get('/api/chat/%20%20/messages');

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Invalid path parameters',
          details: { activityId: expect.any(Array) },
        },
      });
    });

    it('when no messages exist => expected 200', async () => {
      vi.mocked(chatService.getMessages).mockResolvedValueOnce([]);

      const app = createApp();

      const response = await request(app).get('/api/chat/activity-empty/messages');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ok: true,
        data: [],
      });
    });

    it('when service throws unknown error => expected 500 w/ INTERNAL_ERROR', async () => {
      vi.mocked(chatService.getMessages).mockRejectedValueOnce(new Error('Unknown error'));

      const app = createApp();

      const response = await request(app).get('/api/chat/activity-1/messages');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Unknown error',
        },
      });
    });

    it('when authenticated user is not host or participant => expected 403 w/ FORBIDDEN', async () => {
      vi.mocked(activityParticipantsService.canAccessActivityChat).mockResolvedValueOnce(false);

      const app = createApp();

      const response = await request(app).get('/api/chat/activity-1/messages');

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Only the activity host or participants can access this chat',
        },
      });
      expect(chatService.getMessages).not.toHaveBeenCalled();
    });

    it('when activity is not found => expected 404 w/ NOT_FOUND', async () => {
      vi.mocked(activityParticipantsService.canAccessActivityChat).mockRejectedValueOnce(
        new Error('Activity not found'),
      );

      const app = createApp();

      const response = await request(app).get('/api/chat/missing-activity/messages');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Activity not found',
        },
      });
      expect(chatService.getMessages).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/chat/:activityId/messages/:messageId/reactions', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('when emoji is supported => expected 200 with reacted flag', async () => {
      vi.mocked(chatService.toggleReaction).mockResolvedValueOnce({ reacted: true });

      const app = createApp();

      const response = await request(app)
        .post('/api/chat/activity-1/messages/msg-1/reactions')
        .send({ emoji: '🔥' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ok: true,
        data: { reacted: true },
      });
      expect(chatService.toggleReaction).toHaveBeenCalledWith(
        'activity-1',
        'msg-1',
        'test-uid-1',
        '🔥',
      );
    });

    it('when emoji is not in the allowlist => expected 400 w/ INVALID_INPUT', async () => {
      const app = createApp();

      const response = await request(app)
        .post('/api/chat/activity-1/messages/msg-1/reactions')
        .send({ emoji: 'not-an-emoji' });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          details: { emoji: expect.any(Array) },
        },
      });
      expect(chatService.toggleReaction).not.toHaveBeenCalled();
    });

    it('when message does not exist => expected 404 w/ NOT_FOUND', async () => {
      vi.mocked(chatService.toggleReaction).mockRejectedValueOnce(new Error('Message not found'));

      const app = createApp();

      const response = await request(app)
        .post('/api/chat/activity-1/messages/missing/reactions')
        .send({ emoji: '👍' });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Message not found',
        },
      });
    });

    it('when authenticated user is not host or participant => expected 403 w/ FORBIDDEN', async () => {
      vi.mocked(activityParticipantsService.canAccessActivityChat).mockResolvedValueOnce(false);

      const app = createApp();

      const response = await request(app)
        .post('/api/chat/activity-1/messages/msg-1/reactions')
        .send({ emoji: '👍' });

      expect(response.status).toBe(403);
      expect(chatService.toggleReaction).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/chat/:activityId/reactions', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('when reactions exist => expected 200', async () => {
      vi.mocked(chatService.getReactions).mockResolvedValueOnce({
        'msg-1': { '🔥': ['test-uid-1', 'uid-2'] },
      });

      const app = createApp();

      const response = await request(app).get('/api/chat/activity-1/reactions');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ok: true,
        data: { 'msg-1': { '🔥': ['test-uid-1', 'uid-2'] } },
      });
    });

    it('when messageId is given => expected 200 with that message reactions', async () => {
      vi.mocked(chatService.getMessageReactions).mockResolvedValueOnce({
        '👍': ['test-uid-1'],
      });

      const app = createApp();

      const response = await request(app).get('/api/chat/activity-1/messages/msg-1/reactions');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ok: true,
        data: { '👍': ['test-uid-1'] },
      });
      expect(chatService.getMessageReactions).toHaveBeenCalledWith('activity-1', 'msg-1');
      expect(chatService.getReactions).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/chat/:activityId/polls', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('when question + options are valid => expected 201', async () => {
      vi.mocked(chatService.createPoll).mockResolvedValueOnce({ pollId: 'poll-1' });

      const app = createApp();

      const response = await request(app)
        .post('/api/chat/activity-1/polls')
        .send({ question: 'What time shall we play?', options: ['4 PM', '5 PM'] });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        ok: true,
        data: { pollId: 'poll-1' },
      });
      expect(chatService.createPoll).toHaveBeenCalledWith(
        'activity-1',
        'test-uid-1',
        'What time shall we play?',
        ['4 PM', '5 PM'],
      );
    });

    it.each([
      {
        name: 'fewer than 2 options',
        body: { question: 'Q?', options: ['Only one'] },
      },
      {
        name: 'blank question',
        body: { question: '   ', options: ['A', 'B'] },
      },
      {
        name: 'more than 6 options',
        body: { question: 'Q?', options: ['1', '2', '3', '4', '5', '6', '7'] },
      },
    ])('when $name => expected 400 w/ INVALID_INPUT', async ({ body }) => {
      const app = createApp();

      const response = await request(app).post('/api/chat/activity-1/polls').send(body);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        ok: false,
        error: { code: 'INVALID_INPUT' },
      });
      expect(chatService.createPoll).not.toHaveBeenCalled();
    });

    it('when authenticated user is not host or participant => expected 403 w/ FORBIDDEN', async () => {
      vi.mocked(activityParticipantsService.canAccessActivityChat).mockResolvedValueOnce(false);

      const app = createApp();

      const response = await request(app)
        .post('/api/chat/activity-1/polls')
        .send({ question: 'Q?', options: ['A', 'B'] });

      expect(response.status).toBe(403);
      expect(chatService.createPoll).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/chat/:activityId/polls', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('when polls exist => expected 200', async () => {
      vi.mocked(chatService.getPolls).mockResolvedValueOnce([
        {
          pollId: 'poll-1',
          question: 'What time shall we play?',
          options: ['4 PM', '5 PM'],
          createdBy: 'test-uid-1',
          createdAt: 1787000000000,
          votes: { '0': ['test-uid-1'] },
        },
      ]);

      const app = createApp();

      const response = await request(app).get('/api/chat/activity-1/polls');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ok: true,
        data: [
          {
            pollId: 'poll-1',
            question: 'What time shall we play?',
            options: ['4 PM', '5 PM'],
            createdBy: 'test-uid-1',
            createdAt: 1787000000000,
            votes: { '0': ['test-uid-1'] },
          },
        ],
      });
    });
  });

  describe('POST /api/chat/:activityId/polls/:pollId/votes', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('when optionIndex is valid => expected 200 with voted flag', async () => {
      vi.mocked(chatService.votePoll).mockResolvedValueOnce({ voted: true });

      const app = createApp();

      const response = await request(app)
        .post('/api/chat/activity-1/polls/poll-1/votes')
        .send({ optionIndex: 1 });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        ok: true,
        data: { voted: true },
      });
      expect(chatService.votePoll).toHaveBeenCalledWith('activity-1', 'poll-1', 'test-uid-1', 1);
    });

    it('when optionIndex is out of range => expected 400', async () => {
      vi.mocked(chatService.votePoll).mockRejectedValueOnce(
        new Error('optionIndex is out of range'),
      );

      const app = createApp();

      const response = await request(app)
        .post('/api/chat/activity-1/polls/poll-1/votes')
        .send({ optionIndex: 9 });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'optionIndex is out of range',
        },
      });
    });

    it('when poll does not exist => expected 404 w/ NOT_FOUND', async () => {
      vi.mocked(chatService.votePoll).mockRejectedValueOnce(new Error('Poll not found'));

      const app = createApp();

      const response = await request(app)
        .post('/api/chat/activity-1/polls/missing/votes')
        .send({ optionIndex: 0 });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Poll not found',
        },
      });
    });
  });
});
