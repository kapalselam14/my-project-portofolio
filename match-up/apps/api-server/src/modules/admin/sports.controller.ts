// sports.controller (admin).
import type { Request, Response } from 'express';
import { listSports, replaceSports, updateSport } from './sports.service.js';

export async function listSportsHandler(_req: Request, res: Response) {
  try {
    const rows = await listSports();
    return res.status(200).json({ ok: true, data: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message },
    });
  }
}

export async function replaceSportsHandler(req: Request, res: Response) {
  try {
    const body = (req.body ?? {}) as { sports?: unknown };
    const adminUid = req.auth?.uid ?? '';
    const adminEmail = typeof req.auth?.token.email === 'string' ? req.auth.token.email : null;
    const rows = await replaceSports(body.sports, adminUid, adminEmail);
    return res.status(200).json({ ok: true, data: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.startsWith('sports') || message === 'sports must be a non-empty array') {
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

export async function updateSportHandler(req: Request<{ id: string }>, res: Response) {
  try {
    const adminUid = req.auth?.uid ?? '';
    const adminEmail = typeof req.auth?.token.email === 'string' ? req.auth.token.email : null;
    const row = await updateSport(
      req.params.id,
      (req.body ?? {}) as Record<string, unknown>,
      adminUid,
      adminEmail,
    );
    return res.status(200).json({ ok: true, data: row });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'sportId is required') {
      return res.status(400).json({
        ok: false,
        error: { code: 'EMPTY_INPUT', message },
      });
    }
    if (
      message === 'Invalid sport patch' ||
      message === 'No updatable sport flags provided' ||
      message.endsWith('must be a boolean')
    ) {
      return res.status(400).json({
        ok: false,
        error: { code: 'INVALID_INPUT', message },
      });
    }
    if (message === 'Sport not found') {
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
