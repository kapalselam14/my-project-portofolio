/** Admin-only endpoints for listing and publishing sports configuration. */
import { Router } from 'express';
import { requireAuth, requireAdmin } from '../../middleware/auth.middleware.js';
import {
  listSportsHandler,
  replaceSportsHandler,
  updateSportHandler,
} from './sports.controller.js';

export const adminSportsRouter = Router();

adminSportsRouter.get('/', requireAuth, requireAdmin, listSportsHandler);
adminSportsRouter.put('/', requireAuth, requireAdmin, replaceSportsHandler);
adminSportsRouter.patch('/:id', requireAuth, requireAdmin, updateSportHandler);
