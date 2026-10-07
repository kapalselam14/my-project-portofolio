// Routes for typing.
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { getTypingHandler, setTypingHandler } from './typing.controller.js';

export const typingRouter = Router();

typingRouter.post('/', requireAuth, setTypingHandler);
typingRouter.get('/:activityId/:uid', requireAuth, getTypingHandler);
