import type { Request, Response } from 'express';
import {
  listNotifications,
  listUnread,
  markAllRead,
  markNotificationRead,
} from './notifications.service.js';

type MarkMyNotificationReadParams = {
  notificationId: string;
};

export async function listMyNotificationsHandler(req: Request, res: Response) {
  try {
    const authUid = req.auth?.uid;

    if (!authUid) {
      return res.status(401).json({
        ok: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authenticated user is required',
        },
      });
    }

    const notifications = await listNotifications(authUid);

    return res.status(200).json({
      ok: true,
      data: notifications,
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

/** `GET /api/notifications/unread` returns the signed-in user's unread inbox entries. */
export async function listUnreadNotificationsHandler(req: Request, res: Response) {
  try {
    const authUid = req.auth?.uid;
    if (!authUid) {
      return res.status(401).json({
        ok: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authenticated user is required',
        },
      });
    }
    const notifications = await listUnread(authUid);
    return res.status(200).json({ ok: true, data: notifications });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message },
    });
  }
}

/** `POST /api/notifications/read-all` — clears the badge. */
export async function markAllNotificationsReadHandler(req: Request, res: Response) {
  try {
    const authUid = req.auth?.uid;
    if (!authUid) {
      return res.status(401).json({
        ok: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authenticated user is required',
        },
      });
    }
    const result = await markAllRead(authUid);
    return res.status(200).json({ ok: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message },
    });
  }
}

export async function markMyNotificationReadHandler(
  req: Request<MarkMyNotificationReadParams>,
  res: Response,
) {
  try {
    const authUid = req.auth?.uid;
    const { notificationId } = req.params;

    if (!authUid) {
      return res.status(401).json({
        ok: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authenticated user is required',
        },
      });
    }

    if (!notificationId.trim()) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'EMPTY_INPUT',
          message: 'notificationId is required',
        },
      });
    }

    await markNotificationRead(authUid, notificationId);

    return res.status(200).json({
      ok: true,
      data: {
        uid: authUid,
        notificationId,
        isRead: true,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message === 'Notification not found') {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'NOT_FOUND',
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
