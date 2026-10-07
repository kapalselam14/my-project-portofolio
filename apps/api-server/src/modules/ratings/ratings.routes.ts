// Routes for ratings.
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { getMyRatingHandler, submitActivityRatingHandler } from './ratings.controller.js';

export const ratingsRouter = Router();

ratingsRouter.post('/:activityId/ratings', requireAuth, submitActivityRatingHandler);
ratingsRouter.get('/:activityId/my-rating', requireAuth, getMyRatingHandler);
