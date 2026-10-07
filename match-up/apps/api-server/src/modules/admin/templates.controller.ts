// templates.controller (admin).
import type { Request, Response } from 'express';
import { listTemplates, updateTemplate } from './templates.service.js';

export async function listTemplatesHandler(_req: Request, res: Response) {
  try {
    const rows = await listTemplates();
    return res.status(200).json({ ok: true, data: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message },
    });
  }
}

export async function updateTemplateHandler(req: Request<{ id: string }>, res: Response) {
  try {
    const adminUid = req.auth?.uid ?? '';
    const adminEmail = typeof req.auth?.token.email === 'string' ? req.auth.token.email : null;
    const row = await updateTemplate(
      req.params.id,
      (req.body ?? {}) as { title?: unknown; body?: unknown; enabled?: unknown },
      adminUid,
      adminEmail,
    );
    return res.status(200).json({ ok: true, data: row });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message === 'templateId is required') {
      return res.status(400).json({
        ok: false,
        error: { code: 'EMPTY_INPUT', message },
      });
    }
    if (
      message === 'title is required' ||
      message === 'body is required' ||
      message === 'enabled must be a boolean' ||
      message === 'No updatable template fields provided'
    ) {
      return res.status(400).json({
        ok: false,
        error: { code: 'INVALID_INPUT', message },
      });
    }
    if (message === 'Template not found') {
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
