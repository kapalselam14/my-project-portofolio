// Routes for activity checkin.
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { checkInHandler, getMyCheckInHandler } from './activity-checkin.controller.js';

export const activityCheckInRouter = Router();

// Both attendance writes and personal status reads are scoped to an authenticated caller.
activityCheckInRouter.post('/:activityId/check-in', requireAuth, checkInHandler);
activityCheckInRouter.get('/:activityId/check-in/me', requireAuth, getMyCheckInHandler);
