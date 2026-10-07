// Routes for swipes.
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import {
  getMySwipeDecisionHandler,
  listMySwipeDecisionsHandler,
  saveSwipeDecisionHandler,
} from './swipes.controller.js';

export const swipesRouter = Router();

swipesRouter.post('/', requireAuth, saveSwipeDecisionHandler);
swipesRouter.get('/me/:activityId', requireAuth, getMySwipeDecisionHandler);
swipesRouter.get('/me', requireAuth, listMySwipeDecisionsHandler);
