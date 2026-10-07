// broadcasts.controller (admin).
import type { Request, Response } from 'express';
import {
  createBroadcast,
  deleteBroadcast,
  listBroadcasts,
  sendBroadcast,
  updateBroadcast,
} from './broadcasts.service.js';

export async function listBroadcastsHandler(_req: Request, res: Response) {
  try {
    const rows = await listBroadcasts();
    return res.status(200).json({ ok: true, data: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message },
    });
  }
}

export async function createBroadcastHandler(req: Request, res: Response) {
  try {
    const body = (req.body ?? {}) as {
      title?: unknown;
      message?: unknown;
      audience?: unknown;
      scheduledAt?: unknown;
    };
    const row = await createBroadcast(body, req.auth?.uid ?? '');
    return res.status(201).json({ ok: true, data: row });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (
      message === 'title is required' ||
      message === 'message is required' ||
      message.startsWith('audience must be') ||
      message.startsWith('scheduledAt must be')
    ) {
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

export async function updateBroadcastHandler(req: Request<{ id: string }>, res: Response) {
  try {
    const body = (req.body ?? {}) as {
      title?: unknown;
      message?: unknown;
      audience?: unknown;
      scheduledAt?: unknown;
    };
    const adminUid = req.auth?.uid ?? '';
    const adminEmail = typeof req.auth?.token.email === 'string' ? req.auth.token.email : null;
    const row = await updateBroadcast(req.params.id, body, adminUid, adminEmail);
    return res.status(200).json({ ok: true, data: row });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'broadcastId is required') {
      return res.status(400).json({
        ok: false,
        error: { code: 'EMPTY_INPUT', message },
      });
    }
    if (
      message === 'title is required' ||
      message === 'message is required' ||
      message.startsWith('audience must be') ||
      message.startsWith('scheduledAt must be')
    ) {
      return res.status(400).json({
        ok: false,
        error: { code: 'INVALID_INPUT', message },
      });
    }
    if (message === 'Broadcast not found') {
      return res.status(404).json({
        ok: false,
        error: { code: 'NOT_FOUND', message },
      });
    }
    if (message === 'Sent broadcasts cannot be edited') {
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

export async function deleteBroadcastHandler(req: Request<{ id: string }>, res: Response) {
  try {
    const adminUid = req.auth?.uid ?? '';
    const adminEmail = typeof req.auth?.token.email === 'string' ? req.auth.token.email : null;
    await deleteBroadcast(req.params.id, adminUid, adminEmail);
    return res.status(200).json({ ok: true, data: { id: req.params.id } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'broadcastId is required') {
      return res.status(400).json({
        ok: false,
        error: { code: 'EMPTY_INPUT', message },
      });
    }
    if (message === 'Broadcast not found') {
      return res.status(404).json({
        ok: false,
        error: { code: 'NOT_FOUND', message },
      });
    }
    if (message === 'Sent broadcasts cannot be deleted') {
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

export async function sendBroadcastHandler(req: Request<{ id: string }>, res: Response) {
  try {
    const adminUid = req.auth?.uid ?? '';
    const adminEmail = typeof req.auth?.token.email === 'string' ? req.auth.token.email : null;
    const row = await sendBroadcast(req.params.id, adminUid, adminEmail);
    return res.status(200).json({ ok: true, data: row });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'broadcastId is required') {
      return res.status(400).json({
        ok: false,
        error: { code: 'EMPTY_INPUT', message },
      });
    }
    if (message === 'Broadcast not found') {
      return res.status(404).json({
        ok: false,
        error: { code: 'NOT_FOUND', message },
      });
    }
    if (message === 'Broadcast already sent') {
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
