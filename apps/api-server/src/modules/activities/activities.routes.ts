import { Router } from 'express';
import { z } from 'zod';
import {
  createActivityHandler,
  getActivityHandler,
  listActivitiesHandler,
  searchActivitiesHandler,
  updateActivityCoverHandler,
  updateActivityHandler,
  updateActivityStatusHandler,
} from './activities.controller.js';
import { activityParticipantsRouter } from './activity-participants.routes.js';
import { activityCheckInRouter } from './activity-checkin.routes.js';
import { ratingsRouter } from '../ratings/ratings.routes.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { validateQuery } from '../../middleware/validate.js';

export const activitiesRouter = Router();

// URL query values are strings, so numeric filters are checked before the handler converts them.
const numericString = (message: string) =>
  z.string().refine((v) => v.trim() !== '' && Number.isFinite(Number(v)), { message });

const searchActivitiesQuerySchema = z
  .object({
    sport: z.string().trim().min(1, 'sport must be a non-blank string').optional(),
    skill: z.enum(['beginner', 'intermediate', 'advanced', 'any']).optional(),
    max_km: numericString('max_km must be a number').optional(),
    lat: numericString('lat must be a number').optional(),
    lng: numericString('lng must be a number').optional(),
  })
  .passthrough();

activitiesRouter.post('/', requireAuth, createActivityHandler);
activitiesRouter.get('/', requireAuth, listActivitiesHandler);
// Static `/search` before `/:activityId` so "search" never parses as an id.
activitiesRouter.get(
  '/search',
  requireAuth,
  validateQuery(searchActivitiesQuerySchema),
  searchActivitiesHandler,
);
activitiesRouter.patch('/:activityId/status', requireAuth, updateActivityStatusHandler);
activitiesRouter.patch('/:activityId/cover', requireAuth, updateActivityCoverHandler);
activitiesRouter.patch('/:activityId', requireAuth, updateActivityHandler);
activitiesRouter.get('/:activityId', requireAuth, getActivityHandler);
activitiesRouter.use('/', activityParticipantsRouter);
activitiesRouter.use('/', activityCheckInRouter);
activitiesRouter.use('/', ratingsRouter);
