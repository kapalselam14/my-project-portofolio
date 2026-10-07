/** Admin-only broadcast management and send endpoints. */
import { Router } from 'express';
import { requireAuth, requireAdmin } from '../../middleware/auth.middleware.js';
import {
  createBroadcastHandler,
  deleteBroadcastHandler,
  listBroadcastsHandler,
  sendBroadcastHandler,
  updateBroadcastHandler,
} from './broadcasts.controller.js';

export const adminBroadcastsRouter = Router();

adminBroadcastsRouter.get('/', requireAuth, requireAdmin, listBroadcastsHandler);
adminBroadcastsRouter.post('/', requireAuth, requireAdmin, createBroadcastHandler);
adminBroadcastsRouter.patch('/:id', requireAuth, requireAdmin, updateBroadcastHandler);
adminBroadcastsRouter.delete('/:id', requireAuth, requireAdmin, deleteBroadcastHandler);
adminBroadcastsRouter.post('/:id/send', requireAuth, requireAdmin, sendBroadcastHandler);
