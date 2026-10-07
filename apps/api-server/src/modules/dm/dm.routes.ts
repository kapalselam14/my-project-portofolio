// Routes for dm.
import { Router } from 'express';
import {
  getThreadHandler,
  listConversationsHandler,
  listDmMessagesHandler,
  markThreadReadHandler,
  sendDmHandler,
} from './dm.controller.js';
import { requireAuth } from '../../middleware/auth.middleware.js';

export const dmRouter = Router();

dmRouter.get('/conversations', requireAuth, listConversationsHandler);
dmRouter.get('/:uid/thread', requireAuth, getThreadHandler);
dmRouter.get('/:uid/messages', requireAuth, listDmMessagesHandler);
dmRouter.post('/:uid/messages', requireAuth, sendDmHandler);
dmRouter.post('/:uid/read', requireAuth, markThreadReadHandler);
