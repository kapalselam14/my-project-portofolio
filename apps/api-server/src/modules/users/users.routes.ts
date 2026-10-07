import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.middleware.js';
import {
  bootstrapUserHandler,
  getCustomTokenHandler,
  getPublicUserProfileHandler,
  getMyUserHandler,
  getUserHostedActivitiesHandler,
  getUserJoinedActivitiesHandler,
  getUserPastActivitiesHandler,
  updateMyUserPhotoHandler,
  updateMyUserProfileHandler,
} from './users.controller.js';
import { validateParams, validateQuery } from '../../middleware/validate.js';

export const usersRouter = Router();

const userActivitiesParamsSchema = z.object({
  uid: z.string().trim().min(1, 'uid is required'),
});

const userActivitiesQuerySchema = z
  .object({
    limit: z.string().optional(),
    offset: z.string().optional(),
  })
  .passthrough();

usersRouter.post('/me', requireAuth, bootstrapUserHandler);
usersRouter.post('/custom-token', requireAuth, getCustomTokenHandler);
usersRouter.get('/me', requireAuth, getMyUserHandler);
usersRouter.patch('/me/photo', requireAuth, updateMyUserPhotoHandler);
usersRouter.patch('/me', requireAuth, updateMyUserProfileHandler);
// Legacy contract aliases (thin wrappers over the activities service).
usersRouter.get(
  '/:uid/joined-activities',
  requireAuth,
  validateParams(userActivitiesParamsSchema),
  validateQuery(userActivitiesQuerySchema),
  getUserJoinedActivitiesHandler,
);
usersRouter.get(
  '/:uid/hosted-activities',
  requireAuth,
  validateParams(userActivitiesParamsSchema),
  validateQuery(userActivitiesQuerySchema),
  getUserHostedActivitiesHandler,
);
usersRouter.get(
  '/:uid/past-activities',
  requireAuth,
  validateParams(userActivitiesParamsSchema),
  validateQuery(userActivitiesQuerySchema),
  getUserPastActivitiesHandler,
);
usersRouter.get('/:uid/profile', requireAuth, getPublicUserProfileHandler);
