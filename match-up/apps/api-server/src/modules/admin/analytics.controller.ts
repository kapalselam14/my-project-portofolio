import type { Request, Response } from 'express';
import { getAnalytics, getDashboard } from './analytics.service.js';

const RANGE_DAYS: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 };

export async function getAnalyticsHandler(req: Request, res: Response) {
  try {
    const rawRange = req.query.range;
    const rangeKey = rawRange === undefined ? '7d' : String(rawRange);
    const rangeDays = RANGE_DAYS[rangeKey];
    if (rangeDays === undefined) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'range must be 7d, 30d, or 90d',
        },
      });
    }
    const view = await getAnalytics(rangeDays);
    // Note stays in the JSON body only: header values must be ASCII and the
    // note contains em dashes, which crash Node's header validation (500).
    return res.status(200).json({ ok: true, data: view });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message },
    });
  }
}

export async function getDashboardHandler(_req: Request, res: Response) {
  try {
    const view = await getDashboard();
    return res.status(200).json({ ok: true, data: view });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message },
    });
  }
}
