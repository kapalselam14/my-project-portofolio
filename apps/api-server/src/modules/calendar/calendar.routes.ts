// Routes for calendar.
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { validateBody, validateQuery } from '../../middleware/validate.js';
import { getUpcomingHandler, syncCalendarHandler } from './calendar.controller.js';

export const calendarRouter = Router();

const upcomingQuerySchema = z
  .object({
    days: z.coerce
      .number()
      .int('days must be an integer between 1 and 90')
      .min(1, 'days must be an integer between 1 and 90')
      .max(90, 'days must be an integer between 1 and 90')
      .optional(),
  })
  .passthrough();

const syncCalendarSchema = z.object({
  activityIds: z
    .array(z.string().trim().min(1, 'activityIds must not contain blank ids'))
    .min(1, 'activityIds must contain at least one id')
    .max(100, 'activityIds must contain at most 100 ids'),
});

calendarRouter.get(
  '/upcoming',
  requireAuth,
  validateQuery(upcomingQuerySchema),
  getUpcomingHandler,
);
calendarRouter.post('/sync', requireAuth, validateBody(syncCalendarSchema), syncCalendarHandler);
