/** Admin-only analytics endpoint. */
import { Router } from 'express';
import { requireAuth, requireAdmin } from '../../middleware/auth.middleware.js';
import { getAnalyticsHandler } from './analytics.controller.js';

export const adminAnalyticsRouter = Router();

adminAnalyticsRouter.get('/', requireAuth, requireAdmin, getAnalyticsHandler);
