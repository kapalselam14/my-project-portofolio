/** Admin-only notification-template listing and copy updates. */
import { Router } from 'express';
import { requireAuth, requireAdmin } from '../../middleware/auth.middleware.js';
import { listTemplatesHandler, updateTemplateHandler } from './templates.controller.js';

export const adminTemplatesRouter = Router();

adminTemplatesRouter.get('/', requireAuth, requireAdmin, listTemplatesHandler);
adminTemplatesRouter.patch('/:id', requireAuth, requireAdmin, updateTemplateHandler);
