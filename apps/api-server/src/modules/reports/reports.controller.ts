import type { Request, Response } from 'express';
import { firestore } from '../../database/firebase.js';
import { dismissReport, listReports, resolveReport, submitReport } from './reports.service.js';
import { createNotification, renderTemplate } from '../notifications/notifications.service.js';

export async function submitReportHandler(req: Request, res: Response) {
  try {
    const reporterId = req.auth?.uid;
    const { targetId, targetType, reason, details, evidenceUrls } = req.body as {
      targetId?: unknown;
      targetType?: unknown;
      reason?: unknown;
      details?: unknown;
      evidenceUrls?: unknown;
    };

    if (!reporterId) {
      return res.status(401).json({
        ok: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authenticated user is required',
        },
      });
    }

    if (
      typeof targetId !== 'string' ||
      typeof reason !== 'string' ||
      (details !== undefined && typeof details !== 'string')
    ) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'targetId and reason must be strings',
        },
      });
    }

    if (targetType !== 'user' && targetType !== 'activity') {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'targetType must be user or activity',
        },
      });
    }

    if (
      evidenceUrls !== undefined &&
      (!Array.isArray(evidenceUrls) || !evidenceUrls.every((url) => typeof url === 'string'))
    ) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'evidenceUrls must be an array of strings',
        },
      });
    }

    if (!targetId.trim() || !reason.trim()) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'EMPTY_INPUT',
          message: 'targetId and reason are required',
        },
      });
    }

    const result = await submitReport({
      reporterId,
      targetId,
      targetType: targetType as 'user' | 'activity',
      reason,
      ...(typeof details === 'string' && details.trim() ? { details } : {}),
      ...(Array.isArray(evidenceUrls) ? { evidenceUrls: evidenceUrls as string[] } : {}),
    });

    return res.status(201).json({
      ok: true,
      data: {
        reportId: result.reportId,
        autoHidden: result.autoHidden,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message === 'Target not found') {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message,
        },
      });
    }

    if (
      message === 'cannot report yourself' ||
      message.startsWith('reason must be') ||
      message.startsWith('details must be') ||
      message.startsWith('evidenceUrls must be') ||
      message.startsWith('evidence URL must be')
    ) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message,
        },
      });
    }

    return res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message,
      },
    });
  }
}

/**
 * `GET /api/reports?status=pending|resolved|dismissed&limit=` —
 * admin-only triage board listing, newest first.
 */
export async function listReportsHandler(req: Request, res: Response) {
  try {
    const { status, limit } = req.query as {
      status?: unknown;
      limit?: unknown;
    };

    if (
      status !== undefined &&
      status !== 'pending' &&
      status !== 'resolved' &&
      status !== 'dismissed'
    ) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'status must be pending, resolved, or dismissed',
        },
      });
    }

    const parsedLimit = typeof limit === 'string' && limit.trim() !== '' ? Number(limit) : 50;
    if (!Number.isInteger(parsedLimit) || parsedLimit <= 0) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'limit must be a positive integer',
        },
      });
    }

    const rows = await listReports({
      ...(status === 'pending' || status === 'resolved' || status === 'dismissed'
        ? { status }
        : {}),
      limit: parsedLimit,
    });

    return res.status(200).json({ ok: true, data: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.startsWith('status must be')) {
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

async function triageHandler(req: Request, res: Response, action: 'resolved' | 'dismissed') {
  try {
    const adminUid = req.auth?.uid;
    const reportId = req.params.id;
    const { note } = req.body as { note?: unknown };

    if (!adminUid) {
      return res.status(401).json({
        ok: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authenticated user is required',
        },
      });
    }
    if (typeof reportId !== 'string' || !reportId.trim()) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'report id is required',
        },
      });
    }
    if (note !== undefined && typeof note !== 'string') {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'note must be a string',
        },
      });
    }

    const input = {
      reportId,
      adminUid,
      ...(typeof note === 'string' && note.trim() ? { note } : {}),
    };
    if (action === 'resolved') {
      await resolveReport(input);
      // Reporter notice (best-effort, never fails triage).
      try {
        const snap = await firestore.collection('reports').doc(reportId).get();
        const reporterId = snap.exists ? snap.data()?.reporterId : undefined;
        if (typeof reporterId === 'string' && reporterId.length > 0) {
          const template = await renderTemplate('moderation.report_resolved', {});
          if (template) {
            await createNotification({
              recipientUid: reporterId,
              type: 'system',
              title: template.title,
              body: template.body,
            }).catch(() => undefined);
          }
        }
      } catch {
        // Best-effort.
      }
    } else {
      await dismissReport(input);
    }

    return res.status(200).json({ ok: true, data: { reportId } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'Report not found') {
      return res.status(404).json({
        ok: false,
        error: { code: 'NOT_FOUND', message },
      });
    }
    if (
      message === 'Report is no longer pending' ||
      message === 'reportId is required' ||
      message.startsWith('note must be')
    ) {
      const code = message === 'Report is no longer pending' ? 'CONFLICT' : 'INVALID_INPUT';
      const status = code === 'CONFLICT' ? 409 : 400;
      return res.status(status).json({
        ok: false,
        error: { code, message },
      });
    }
    return res.status(500).json({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message },
    });
  }
}

/** `POST /api/reports/:id/resolve {note?}` — admin only. */
export async function resolveReportHandler(req: Request, res: Response) {
  return triageHandler(req, res, 'resolved');
}

/** `POST /api/reports/:id/dismiss {note?}` — admin only. */
export async function dismissReportHandler(req: Request, res: Response) {
  return triageHandler(req, res, 'dismissed');
}
