/** Admin-only member lookup, status, and offboarding endpoints. */
import { Router } from 'express';
import { requireAuth, requireAdmin } from '../../middleware/auth.middleware.js';
import {
  deleteMemberHandler,
  getMemberHandler,
  getMembersSummaryHandler,
  listMembersHandler,
  setMemberStatusHandler,
} from './members.controller.js';

export const adminMembersRouter = Router();

adminMembersRouter.get('/', requireAuth, requireAdmin, listMembersHandler);
// Static `/summary` before `/:uid` so "summary" never parses as a uid.
adminMembersRouter.get('/summary', requireAuth, requireAdmin, getMembersSummaryHandler);
adminMembersRouter.get('/:uid', requireAuth, requireAdmin, getMemberHandler);
adminMembersRouter.patch('/:uid/status', requireAuth, requireAdmin, setMemberStatusHandler);
adminMembersRouter.delete('/:uid', requireAuth, requireAdmin, deleteMemberHandler);
