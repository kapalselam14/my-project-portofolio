import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.middleware.js';
import {
  listMyNotificationsHandler,
  listUnreadNotificationsHandler,
  markAllNotificationsReadHandler,
  markMyNotificationReadHandler,
} from './notifications.controller.js';
import { validateParams } from '../../middleware/validate.js';

export const notificationsRouter = Router();

const notificationParamsSchema = z.object({
  notificationId: z.string().trim().min(1, 'notificationId is required'),
});

// Static paths first so `/unread` never parses as `:notificationId`.
notificationsRouter.get('/unread', requireAuth, listUnreadNotificationsHandler);
notificationsRouter.post('/read-all', requireAuth, markAllNotificationsReadHandler);
notificationsRouter.get('/me', requireAuth, listMyNotificationsHandler);
notificationsRouter.patch(
  '/me/:notificationId/read',
  requireAuth,
  validateParams(notificationParamsSchema),
  markMyNotificationReadHandler,
);
