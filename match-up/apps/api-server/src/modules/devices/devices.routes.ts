// Routes for devices.
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import {
  deleteMyDeviceHandler,
  listMyDevicesHandler,
  registerDeviceHandler,
} from './devices.controller.js';

export const devicesRouter = Router();

devicesRouter.post('/', requireAuth, registerDeviceHandler);
devicesRouter.get('/me', requireAuth, listMyDevicesHandler);
devicesRouter.delete('/me/:deviceId', requireAuth, deleteMyDeviceHandler);
