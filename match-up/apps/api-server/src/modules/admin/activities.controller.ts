// activities.controller (admin).
import type { Request, Response } from 'express';
import {
  ADMIN_ACTIVITIES_LIMIT_DEFAULT,
  deleteAdminActivity,
  getActivitiesSummary,
  listAdminActivities,
  setAdminActivityStatus,
} from './activities.service.js';

export async function listAdminActivitiesHandler(req: Request, res: Response) {
  try {
    const rawLimit = req.query.limit;
    const limit = rawLimit === undefined ? ADMIN_ACTIVITIES_LIMIT_DEFAULT : Number(rawLimit);
    const rows = await listAdminActivities(limit);
    return res.status(200).json({ ok: true, data: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.startsWith('limit must be between')) {
      return res.status(400).json({
        ok: false,
        error: { code: 'INVALID_INPUT', message },
      });
    }
    return res.status(500).json({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message },
    });
  }
}

export async function setAdminActivityStatusHandler(req: Request<{ id: string }>, res: Response) {
  try {
    const body = req.body as { status?: unknown };
    const adminUid = req.auth?.uid ?? '';
    const adminEmail = typeof req.auth?.token.email === 'string' ? req.auth.token.email : null;
    await setAdminActivityStatus(req.params.id, body?.status, adminUid, adminEmail);
    return res.status(200).json({
      ok: true,
      data: { id: req.params.id, status: body?.status },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'activityId is required') {
      return res.status(400).json({
        ok: false,
        error: { code: 'EMPTY_INPUT', message },
      });
    }
    if (message.startsWith('status must be')) {
      return res.status(400).json({
        ok: false,
        error: { code: 'INVALID_INPUT', message },
      });
    }
    if (message === 'Activity not found') {
      return res.status(404).json({
        ok: false,
        error: { code: 'NOT_FOUND', message },
      });
    }
    return res.status(500).json({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message },
    });
  }
}

export async function getActivitiesSummaryHandler(_req: Request, res: Response) {
  try {
    const summary = await getActivitiesSummary();
    return res.status(200).json({ ok: true, data: summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message },
    });
  }
}

export async function deleteAdminActivityHandler(req: Request<{ id: string }>, res: Response) {
  try {
    const adminUid = req.auth?.uid ?? '';
    const adminEmail = typeof req.auth?.token.email === 'string' ? req.auth.token.email : null;
    await deleteAdminActivity(req.params.id, adminUid, adminEmail);
    return res.status(200).json({ ok: true, data: { id: req.params.id } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'activityId is required') {
      return res.status(400).json({
        ok: false,
        error: { code: 'EMPTY_INPUT', message },
      });
    }
    if (message === 'Activity not found') {
      return res.status(404).json({
        ok: false,
        error: { code: 'NOT_FOUND', message },
      });
    }
    return res.status(500).json({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message },
    });
  }
}
