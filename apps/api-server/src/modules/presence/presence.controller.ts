// presence.controller (presence).
import type { Request, Response } from 'express';
import { getPresence, setPresence } from './presence.service.js';

type GetPresenceParams = {
  uid: string;
};

export async function setPresenceHandler(req: Request, res: Response) {
  try {
    const uid = req.auth?.uid;
    const { state } = req.body as {
      state?: unknown;
    };

    if (!uid) {
      return res.status(401).json({
        ok: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authenticated user is required',
        },
      });
    }

    if (state !== 'online' && state !== 'offline') {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_STATE',
          message: 'state must be online or offline',
        },
      });
    }
    await setPresence(uid, state);

    return res.status(200).json({
      ok: true,
      data: {
        uid,
        state,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    return res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message,
      },
    });
  }
}

export async function getPresenceHandler(req: Request<GetPresenceParams>, res: Response) {
  try {
    const { uid } = req.params;

    if (!uid.trim()) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'EMPTY_INPUT',
          message: 'uid is required',
        },
      });
    }

    const presence = await getPresence(uid);

    if (!presence) {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'presence not found',
        },
      });
    }

    return res.status(200).json({
      ok: true,
      data: presence,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    return res.status(500).json({
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message,
      },
    });
  }
}
