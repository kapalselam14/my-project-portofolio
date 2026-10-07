import { Router } from 'express';
import { z } from 'zod';
import {
  createPollHandler,
  getMessagesHandler,
  getPollsHandler,
  getReactionsHandler,
  listConversationsHandler,
  sendImageMessageHandler,
  sendLocationMessageHandler,
  sendMessageHandler,
  toggleReactionHandler,
  votePollHandler,
} from './chat.controller.js';
import {
  createPollSchema,
  sendImageMessageSchema,
  sendLocationMessageSchema,
  sendMessageSchema,
  toggleReactionSchema,
  votePollSchema,
} from './chat.schema.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { validateBody, validateParams } from '../../middleware/validate.js';

export const chatRouter = Router();

const chatActivityParamsSchema = z.object({
  activityId: z.string().trim().min(1, 'activityId is required'),
});

// Inbox first: single-segment path, no conflict with `/:activityId/*`.
// Validate message and poll bodies at the router boundary before controller code accesses typed fields.
chatRouter.get('/conversations', requireAuth, listConversationsHandler);

chatRouter.post('/messages', requireAuth, validateBody(sendMessageSchema), sendMessageHandler);
chatRouter.post(
  '/:activityId/messages/image',
  requireAuth,
  validateParams(chatActivityParamsSchema),
  validateBody(sendImageMessageSchema),
  sendImageMessageHandler,
);
chatRouter.post(
  '/:activityId/messages/location',
  requireAuth,
  validateParams(chatActivityParamsSchema),
  validateBody(sendLocationMessageSchema),
  sendLocationMessageHandler,
);
chatRouter.get(
  '/:activityId/messages',
  requireAuth,
  validateParams(chatActivityParamsSchema),
  getMessagesHandler,
);
chatRouter.post(
  '/:activityId/messages/:messageId/reactions',
  requireAuth,
  validateBody(toggleReactionSchema),
  toggleReactionHandler,
);
chatRouter.get('/:activityId/reactions', requireAuth, getReactionsHandler);
chatRouter.get('/:activityId/messages/:messageId/reactions', requireAuth, getReactionsHandler);
chatRouter.post(
  '/:activityId/polls',
  requireAuth,
  validateBody(createPollSchema),
  createPollHandler,
);
chatRouter.get('/:activityId/polls', requireAuth, getPollsHandler);
chatRouter.post(
  '/:activityId/polls/:pollId/votes',
  requireAuth,
  validateBody(votePollSchema),
  votePollHandler,
);
