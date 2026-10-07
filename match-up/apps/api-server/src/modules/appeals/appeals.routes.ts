import { Router } from 'express';
import { requireAuthAllowSuspended } from '../../middleware/auth.middleware.js';
import { validateBody } from '../../middleware/validate.js';
import { listMyAppealsHandler, submitAppealHandler } from './appeals.controller.js';
import { submitAppealSchema } from './appeals.schema.js';

/** User-facing appeals. Suspended users keep access here — otherwise a suspension could never be appealed. */
export const appealsRouter = Router();

appealsRouter.post(
  '/',
  requireAuthAllowSuspended,
  validateBody(submitAppealSchema),
  submitAppealHandler,
);
appealsRouter.get('/me', requireAuthAllowSuspended, listMyAppealsHandler);
