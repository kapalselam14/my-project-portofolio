// activity checkin.controller (activities).
import type { Request, Response } from 'express';
import { canAccessActivityChat } from './activity-participants.service.js';
import { checkIn, getCheckInStatus } from './activity-checkin.service.js';

type ActivityParams = {
  activityId: string;
};

const FORBIDDEN_MESSAGE = 'Only the activity host or participants can access this chat';

async function guardActivityAccess(
  activityId: string,
  uid: string,
): Promise<{ allowed: boolean; notFound: boolean }> {
  try {
    const allowed = await canAccessActivityChat(activityId, uid);
    return { allowed, notFound: false };
  } catch (error) {
    if (error instanceof Error && error.message === 'Activity not found') {
      return { allowed: false, notFound: true };
    }
    throw error;
  }
}

export async function checkInHandler(req: Request<ActivityParams>, res: Response) {
  try {
    // Bind check-in to the verified caller instead of accepting a uid from the request body.
    const uid = req.auth?.uid;
    const { activityId } = req.params;
    const { latitude, longitude } = (req.body ?? {}) as {
      latitude?: unknown;
      longitude?: unknown;
    };

    if (!uid) {
      return res.status(401).json({
        ok: false,
        error: { code: 'UNAUTHORIZED', message: 'Authenticated user is required' },
      });
    }

    if (typeof activityId !== 'string' || !activityId.trim()) {
      return res.status(400).json({
        ok: false,
        error: { code: 'EMPTY_INPUT', message: 'activityId is required' },
      });
    }

    if (
      (latitude !== undefined && typeof latitude !== 'number') ||
      (longitude !== undefined && typeof longitude !== 'number')
    ) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'latitude and longitude must be numbers when provided',
        },
      });
    }

    const guard = await guardActivityAccess(activityId, uid);
    if (guard.notFound) {
      return res.status(404).json({
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Activity not found' },
      });
    }
    if (!guard.allowed) {
      return res.status(403).json({
        ok: false,
        error: { code: 'FORBIDDEN', message: FORBIDDEN_MESSAGE },
      });
    }

    const checkedInAt = await checkIn({
      activityId,
      uid,
      latitude,
      longitude,
    });

    return res.status(201).json({ ok: true, data: { checkedInAt } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message === 'Activity not found') {
      return res.status(404).json({
        ok: false,
        error: { code: 'NOT_FOUND', message },
      });
    }

    if (message === 'Activity is not open for check-in') {
      return res.status(409).json({
        ok: false,
        error: { code: 'CONFLICT', message },
      });
    }

    if (
      message === 'latitude must be a number between -90 and 90' ||
      message === 'longitude must be a number between -180 and 180'
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

export async function getMyCheckInHandler(req: Request<ActivityParams>, res: Response) {
  try {
    // Return only the signed-in user's attendance status for the requested activity.
    const uid = req.auth?.uid;
    const { activityId } = req.params;

    if (!uid) {
      return res.status(401).json({
        ok: false,
        error: { code: 'UNAUTHORIZED', message: 'Authenticated user is required' },
      });
    }

    if (typeof activityId !== 'string' || !activityId.trim()) {
      return res.status(400).json({
        ok: false,
        error: { code: 'EMPTY_INPUT', message: 'activityId is required' },
      });
    }

    const guard = await guardActivityAccess(activityId, uid);
    if (guard.notFound) {
      return res.status(404).json({
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Activity not found' },
      });
    }
    if (!guard.allowed) {
      return res.status(403).json({
        ok: false,
        error: { code: 'FORBIDDEN', message: FORBIDDEN_MESSAGE },
      });
    }

    const status = await getCheckInStatus(activityId, uid);
    return res.status(200).json({ ok: true, data: status });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message === 'Activity not found') {
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
