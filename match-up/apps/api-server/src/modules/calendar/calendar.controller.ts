import type { Request, Response } from 'express';
import { listUpcoming, syncActivities } from './calendar.service.js';

const UPCOMING_DAYS_DEFAULT = 7;

export async function getUpcomingHandler(req: Request, res: Response) {
  try {
    const uid = req.auth?.uid;
    if (!uid) {
      return res.status(401).json({
        ok: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authenticated user is required',
        },
      });
    }
    // `days` pre-coerced by `validateQuery(upcomingQuerySchema)`.
    const rawDays = (req.query as { days?: unknown }).days;
    const days = rawDays === undefined ? UPCOMING_DAYS_DEFAULT : Number(rawDays);
    if (!Number.isInteger(days) || days < 1 || days > 90) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'days must be an integer between 1 and 90',
        },
      });
    }
    const entries = await listUpcoming(uid, days);
    return res.status(200).json({ ok: true, data: entries });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message },
    });
  }
}

export async function syncCalendarHandler(req: Request, res: Response) {
  try {
    const uid = req.auth?.uid;
    if (!uid) {
      return res.status(401).json({
        ok: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authenticated user is required',
        },
      });
    }
    // Shape enforced by `validateBody(syncCalendarSchema)`.
    const { activityIds } = req.body as { activityIds: string[] };
    const result = await syncActivities(uid, activityIds);
    return res.status(200).json({ ok: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message },
    });
  }
}
