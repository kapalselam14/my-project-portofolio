/** Admin-only appeal review endpoints. */
import { Router } from 'express';
import { requireAuth, requireAdmin } from '../../middleware/auth.middleware.js';
import {
  approveAppealHandler,
  listAppealsHandler,
  rejectAppealHandler,
} from '../appeals/appeals.controller.js';

export const adminAppealsRouter = Router();

adminAppealsRouter.get('/', requireAuth, requireAdmin, listAppealsHandler);
adminAppealsRouter.post('/:id/approve', requireAuth, requireAdmin, approveAppealHandler);
adminAppealsRouter.post('/:id/reject', requireAuth, requireAdmin, rejectAppealHandler);
