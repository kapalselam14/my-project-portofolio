// appeals.controller (appeals).
import type { Request, Response } from 'express';
import {
  decideAppeal,
  isAppealStatus,
  listAppeals,
  listMyAppeals,
  submitAppeal,
} from './appeals.service.js';

export async function submitAppealHandler(req: Request, res: Response) {
  try {
    // Tie the appeal to the authenticated account so a caller cannot submit for another user.
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
    const body = (req.body ?? {}) as {
      type?: unknown;
      statement?: unknown;
      relatedId?: unknown;
    };
    const row = await submitAppeal(uid, body);
    return res.status(201).json({ ok: true, data: row });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'uid is required' || message === 'statement is required') {
      return res.status(400).json({
        ok: false,
        error: { code: 'EMPTY_INPUT', message },
      });
    }
    if (message.startsWith('type must be') || message.startsWith('statement must be')) {
      return res.status(400).json({
        ok: false,
        error: { code: 'INVALID_INPUT', message },
      });
    }
    if (message === 'A pending appeal of this type already exists') {
      return res.status(409).json({
        ok: false,
        error: { code: 'CONFLICT', message },
      });
    }
    return res.status(500).json({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message },
    });
  }
}

export async function listMyAppealsHandler(req: Request, res: Response) {
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
    const rows = await listMyAppeals(uid);
    return res.status(200).json({ ok: true, data: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message },
    });
  }
}

export async function listAppealsHandler(req: Request, res: Response) {
  try {
    const rawStatus = req.query.status;
    const status = rawStatus === undefined ? 'pending' : String(rawStatus);
    if (!isAppealStatus(status)) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'status must be pending, approved, or rejected',
        },
      });
    }
    const rows = await listAppeals(status);
    return res.status(200).json({ ok: true, data: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message },
    });
  }
}

async function decideHandler(
  req: Request<{ id: string }>,
  res: Response,
  decision: 'approved' | 'rejected',
) {
  try {
    // Share validation and error mapping between the approve and reject endpoints.
    const adminUid = req.auth?.uid;
    if (!adminUid) {
      return res.status(401).json({
        ok: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authenticated user is required',
        },
      });
    }
    const body = (req.body ?? {}) as { note?: unknown };
    const row = await decideAppeal(req.params.id, decision, adminUid, body.note);
    return res.status(200).json({ ok: true, data: row });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'appealId is required') {
      return res.status(400).json({
        ok: false,
        error: { code: 'EMPTY_INPUT', message },
      });
    }
    if (message === 'Appeal not found') {
      return res.status(404).json({
        ok: false,
        error: { code: 'NOT_FOUND', message },
      });
    }
    if (message === 'Appeal already decided') {
      return res.status(409).json({
        ok: false,
        error: { code: 'CONFLICT', message },
      });
    }
    return res.status(500).json({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message },
    });
  }
}

export async function approveAppealHandler(req: Request<{ id: string }>, res: Response) {
  return decideHandler(req, res, 'approved');
}

export async function rejectAppealHandler(req: Request<{ id: string }>, res: Response) {
  return decideHandler(req, res, 'rejected');
}
