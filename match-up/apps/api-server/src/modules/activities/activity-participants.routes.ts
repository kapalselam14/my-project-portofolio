// Routes for activity participants.
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import {
  approveJoinRequestHandler,
  declineJoinRequestHandler,
  joinActivityHandler,
  leaveActivityHandler,
  getParticipantsHandler,
  listJoinRequestsHandler,
  listMyJoinRequestsHandler,
  requestJoinActivityHandler,
} from './activity-participants.controller.js';

export const activityParticipantsRouter = Router();

// Authentication is enforced here; action-specific joining and moderation rules live in handlers/services.
activityParticipantsRouter.get('/join-requests/me', requireAuth, listMyJoinRequestsHandler);
activityParticipantsRouter.post('/:activityId/participants', requireAuth, joinActivityHandler);
activityParticipantsRouter.get('/:activityId/participants', requireAuth, getParticipantsHandler);
activityParticipantsRouter.delete(
  '/:activityId/participants/:uid',
  requireAuth,
  leaveActivityHandler,
);
activityParticipantsRouter.post(
  '/:activityId/join-requests',
  requireAuth,
  requestJoinActivityHandler,
);
activityParticipantsRouter.get('/:activityId/join-requests', requireAuth, listJoinRequestsHandler);
activityParticipantsRouter.post(
  '/:activityId/join-requests/:uid/approve',
  requireAuth,
  approveJoinRequestHandler,
);
activityParticipantsRouter.post(
  '/:activityId/join-requests/:uid/decline',
  requireAuth,
  declineJoinRequestHandler,
);
