import type { Request, Response } from 'express';
import { isAuditCategory, listAuditLog } from './audit.service.js';

/** `GET /api/admin/audit-log?category=&adminUid=&limit=` — newest first. */
export async function listAuditLogHandler(req: Request, res: Response) {
  try {
    const { category, adminUid, limit } = req.query as {
      category?: unknown;
      adminUid?: unknown;
      limit?: unknown;
    };

    if (category !== undefined && !isAuditCategory(category)) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message:
            'category must be one of Members, Activities, Appeals, Reports, Broadcasts, Sports, Templates',
        },
      });
    }

    const parsedLimit = typeof limit === 'string' && limit.trim() !== '' ? Number(limit) : 50;
    if (!Number.isInteger(parsedLimit) || parsedLimit <= 0) {
      return res.status(400).json({
        ok: false,
        error: { code: 'INVALID_INPUT', message: 'limit must be a positive integer' },
      });
    }

    const rows = await listAuditLog({
      ...(isAuditCategory(category) ? { category } : {}),
      ...(typeof adminUid === 'string' && adminUid.trim() !== '' ? { adminUid } : {}),
      limit: parsedLimit,
    });

    return res.status(200).json({ ok: true, data: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message },
    });
  }
}
