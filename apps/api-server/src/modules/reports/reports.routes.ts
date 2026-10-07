import { Router } from 'express';
import { z } from 'zod';
import {
  dismissReportHandler,
  listReportsHandler,
  resolveReportHandler,
  submitReportHandler,
} from './reports.controller.js';
import { requireAdmin, requireAuth } from '../../middleware/auth.middleware.js';
import { validateParams, validateQuery } from '../../middleware/validate.js';

export const reportsRouter = Router();

const listReportsQuerySchema = z
  .object({
    status: z.enum(['pending', 'resolved', 'dismissed']).optional(),
    limit: z.string().optional(),
  })
  .passthrough();

const reportParamsSchema = z.object({
  id: z.string().trim().min(1, 'report id is required'),
});

reportsRouter.post('/', requireAuth, submitReportHandler);

// Triage board — admin only (uid allowlist via ADMIN_UIDS).
reportsRouter.get(
  '/',
  requireAuth,
  requireAdmin,
  validateQuery(listReportsQuerySchema),
  listReportsHandler,
);
reportsRouter.post(
  '/:id/resolve',
  requireAuth,
  requireAdmin,
  validateParams(reportParamsSchema),
  resolveReportHandler,
);
reportsRouter.post(
  '/:id/dismiss',
  requireAuth,
  requireAdmin,
  validateParams(reportParamsSchema),
  dismissReportHandler,
);
