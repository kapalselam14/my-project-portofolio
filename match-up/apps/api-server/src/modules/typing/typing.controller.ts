// typing.controller (typing).
import type { Request, Response } from 'express';
import { getTyping, setTyping } from './typing.service.js';

type GetTypingParams = {
  activityId: string;
  uid: string;
};

export async function setTypingHandler(req: Request, res: Response) {
  try {
    const uid = req.auth?.uid;
    const { activityId, isTyping } = req.body as {
      activityId?: unknown;
      isTyping?: unknown;
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

    if (typeof activityId !== 'string') {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'activityId must be a string',
        },
      });
    }

    if (typeof isTyping !== 'boolean') {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'isTyping must be a boolean',
        },
      });
    }

    if (!activityId.trim()) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'EMPTY_INPUT',
          message: 'activityId is required',
        },
      });
    }

    await setTyping(activityId, uid, isTyping);

    return res.status(200).json({
      ok: true,
      data: {
        activityId: activityId.trim(),
        uid,
        isTyping,
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

export async function getTypingHandler(req: Request<GetTypingParams>, res: Response) {
  try {
    const { activityId, uid } = req.params;

    if (!uid.trim()) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'EMPTY_INPUT',
          message: 'uid is required',
        },
      });
    }

    if (!activityId.trim()) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'EMPTY_INPUT',
          message: 'activityId is required',
        },
      });
    }

    const typing = await getTyping(activityId, uid);

    if (!typing) {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Typing status not found',
        },
      });
    }

    return res.status(200).json({
      ok: true,
      data: typing,
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
