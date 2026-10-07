/** Admin-only audit history endpoint. */
import { Router } from 'express';
import { requireAuth, requireAdmin } from '../../middleware/auth.middleware.js';
import { listAuditLogHandler } from './audit.controller.js';

export const adminAuditLogRouter = Router();

adminAuditLogRouter.get('/', requireAuth, requireAdmin, listAuditLogHandler);
