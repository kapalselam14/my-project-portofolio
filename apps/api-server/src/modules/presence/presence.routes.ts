// Routes for presence.
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { getPresenceHandler, setPresenceHandler } from './presence.controller.js';

export const presenceRouter = Router();

presenceRouter.post('/', requireAuth, setPresenceHandler);
presenceRouter.get('/:uid', requireAuth, getPresenceHandler);
