/** Admin-only activity listing, status override, and removal endpoints. */
import { Router } from 'express';
import { requireAuth, requireAdmin } from '../../middleware/auth.middleware.js';
import {
  deleteAdminActivityHandler,
  getActivitiesSummaryHandler,
  listAdminActivitiesHandler,
  setAdminActivityStatusHandler,
} from './activities.controller.js';

export const adminActivitiesRouter = Router();

adminActivitiesRouter.get('/', requireAuth, requireAdmin, listAdminActivitiesHandler);
// Static `/summary` first so it never parses as an `:id`.
adminActivitiesRouter.get('/summary', requireAuth, requireAdmin, getActivitiesSummaryHandler);
adminActivitiesRouter.patch(
  '/:id/status',
  requireAuth,
  requireAdmin,
  setAdminActivityStatusHandler,
);
adminActivitiesRouter.delete('/:id', requireAuth, requireAdmin, deleteAdminActivityHandler);
