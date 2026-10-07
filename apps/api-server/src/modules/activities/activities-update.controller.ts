import type { Request, Response } from 'express';
import {
  getActivityById,
  updateActivity,
  updateActivityCover,
  updateActivityStatus,
} from './activities.service.js';
import { getParticipants } from './activity-participants.service.js';
import {
  createNotification,
  displayNameOf,
  renderTemplate,
} from '../notifications/notifications.service.js';

// Activity mutation: edits, status transitions, cover changes.

type UpdateActivityStatusParams = {
  activityId: string;
};

type UpdateActivityParams = {
  activityId: string;
};

type UpdateActivityCoverParams = {
  activityId: string;
};

export async function updateActivityHandler(req: Request<UpdateActivityParams>, res: Response) {
  try {
    // Use the authenticated uid as the host identity; the body contains only editable fields.
    const hostId = req.auth?.uid;
    const { activityId } = req.params;
    const {
      title,
      sportType,
      description,
      locationName,
      address,
      latitude,
      longitude,
      geohash,
      startTime,
      endTime,
      skillLevel,
      capacity,
      coverImageUrl,
      joinPolicy,
      isPaid,
      fee,
      feeMode,
      totalCost,
      minPlayers,
      weatherTemp,
      weatherCode,
      weatherDesc,
      weatherRain,
    } = req.body as {
      title?: unknown;
      sportType?: unknown;
      description?: unknown;
      locationName?: unknown;
      address?: unknown;
      latitude?: unknown;
      longitude?: unknown;
      geohash?: unknown;
      startTime?: unknown;
      endTime?: unknown;
      skillLevel?: unknown;
      capacity?: unknown;
      coverImageUrl?: unknown;
      joinPolicy?: unknown;
      isPaid?: unknown;
      fee?: unknown;
      feeMode?: unknown;
      totalCost?: unknown;
      minPlayers?: unknown;
      weatherTemp?: unknown;
      weatherCode?: unknown;
      weatherDesc?: unknown;
      weatherRain?: unknown;
    };

    if (!hostId) {
      return res.status(401).json({
        ok: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authenticated user is required',
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

    const stringFields = {
      title,
      sportType,
      description,
      locationName,
      address,
      geohash,
      startTime,
      endTime,
    };

    if (
      Object.values(stringFields).some((value) => value !== undefined && typeof value !== 'string')
    ) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'updated string fields must be strings',
        },
      });
    }

    if (
      skillLevel !== undefined &&
      skillLevel !== 'beginner' &&
      skillLevel !== 'intermediate' &&
      skillLevel !== 'advanced' &&
      skillLevel !== 'any'
    ) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'skillLevel must be beginner, intermediate, advanced, or any',
        },
      });
    }

    if (joinPolicy !== undefined && joinPolicy !== 'open' && joinPolicy !== 'approval') {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'joinPolicy must be open or approval',
        },
      });
    }

    if (isPaid !== undefined && typeof isPaid !== 'boolean') {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'isPaid must be a boolean',
        },
      });
    }

    if (fee !== undefined && (typeof fee !== 'number' || !Number.isFinite(fee) || fee <= 0)) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'fee must be a positive number for paid activities',
        },
      });
    }

    if (feeMode !== undefined && feeMode !== 'fixed' && feeMode !== 'split') {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'feeMode must be fixed or split',
        },
      });
    }

    if (
      totalCost !== undefined &&
      (typeof totalCost !== 'number' || !Number.isFinite(totalCost) || totalCost <= 0)
    ) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'totalCost must be a positive number for split mode',
        },
      });
    }

    if (
      minPlayers !== undefined &&
      (typeof minPlayers !== 'number' || !Number.isInteger(minPlayers) || minPlayers < 2)
    ) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'minPlayers must be an integer >= 2',
        },
      });
    }

    if (
      capacity !== undefined &&
      (typeof capacity !== 'number' || !Number.isInteger(capacity) || capacity <= 0)
    ) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'capacity must be a positive integer',
        },
      });
    }

    if (
      latitude !== undefined &&
      (typeof latitude !== 'number' || latitude < -90 || latitude > 90)
    ) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'latitude must be a number between -90 and 90',
        },
      });
    }

    if (
      longitude !== undefined &&
      (typeof longitude !== 'number' || longitude < -180 || longitude > 180)
    ) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'longitude must be a number between -180 and 180',
        },
      });
    }

    await updateActivity({
      activityId,
      hostId,
      ...(typeof title === 'string' ? { title } : {}),
      ...(typeof sportType === 'string' ? { sportType } : {}),
      ...(typeof description === 'string' ? { description } : {}),
      ...(typeof locationName === 'string' ? { locationName } : {}),
      ...(typeof address === 'string' ? { address } : {}),
      ...(typeof latitude === 'number' ? { latitude } : {}),
      ...(typeof longitude === 'number' ? { longitude } : {}),
      ...(typeof geohash === 'string' ? { geohash } : {}),
      ...(typeof startTime === 'string' ? { startTime } : {}),
      ...(typeof endTime === 'string' ? { endTime } : {}),
      ...(typeof skillLevel === 'string' ? { skillLevel } : {}),
      ...(typeof capacity === 'number' ? { capacity } : {}),
      ...(typeof coverImageUrl === 'string' ? { coverImageUrl } : {}),
      ...(joinPolicy === 'open' || joinPolicy === 'approval' ? { joinPolicy } : {}),
      ...(typeof isPaid === 'boolean' ? { isPaid } : {}),
      ...(typeof fee === 'number' ? { fee } : {}),
      ...(feeMode === 'fixed' || feeMode === 'split' ? { feeMode } : {}),
      ...(typeof totalCost === 'number' ? { totalCost } : {}),
      ...(typeof minPlayers === 'number' ? { minPlayers } : {}),
      ...(typeof weatherTemp === 'number' ? { weatherTemp } : {}),
      ...(typeof weatherCode === 'number' ? { weatherCode } : {}),
      ...(typeof weatherDesc === 'string' ? { weatherDesc } : {}),
      ...(typeof weatherRain === 'number' ? { weatherRain } : {}),
    });

    return res.status(200).json({
      ok: true,
      data: {
        activityId,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message === 'Activity not found') {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message,
        },
      });
    }

    if (message === 'Only the activity host can update this activity') {
      return res.status(403).json({
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message,
        },
      });
    }

    if (message === 'updated string fields cannot be blank') {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'EMPTY_INPUT',
          message,
        },
      });
    }

    if (
      message === 'isPaid must be a boolean' ||
      message === 'fee must be a positive number for paid activities' ||
      message === 'feeMode must be fixed or split' ||
      message === 'totalCost must be a positive number for split mode' ||
      message === 'minPlayers must be an integer >= 2' ||
      message === 'minPlayers must be an integer between 2 and capacity'
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

export async function updateActivityStatusHandler(
  req: Request<UpdateActivityStatusParams>,
  res: Response,
) {
  try {
    // Restrict lifecycle changes to the supported host actions before calling the service.
    const hostId = req.auth?.uid;
    const { activityId } = req.params;
    const { status } = req.body as {
      status?: unknown;
    };

    if (!hostId) {
      return res.status(401).json({
        ok: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authenticated user is required',
        },
      });
    }

    if (typeof status !== 'string') {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'status must be a string',
        },
      });
    }

    if (!activityId.trim() || !status.trim()) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'EMPTY_INPUT',
          message: 'activityId and status are required',
        },
      });
    }

    if (
      status !== 'open' &&
      status !== 'cancelled' &&
      status !== 'completed' &&
      status !== 'removed'
    ) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'status must be open, cancelled, completed, or removed',
        },
      });
    }

    const previous = await getActivityById(activityId);

    await updateActivityStatus({
      activityId,
      hostId,
      status,
    });

    // Members must hear about cancellations (UAT): fan out an `activity_cancelled` push to every participant except.
    if (status === 'cancelled' && previous?.status !== 'cancelled') {
      notifyCancelledMembers(activityId, hostId).catch(() => undefined);
    }

    return res.status(200).json({
      ok: true,
      data: {
        activityId,
        status,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message === 'Activity not found') {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message,
        },
      });
    }

    if (message === 'Only the activity host can update this activity') {
      return res.status(403).json({
        ok: false,
        error: {
          code: 'FORBIDDEN',
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

/** Fans an `activity_cancelled` notification out to every participant except the acting host. */
async function notifyCancelledMembers(activityId: string, hostId: string): Promise<void> {
  try {
    const [activity, participants] = await Promise.all([
      getActivityById(activityId),
      getParticipants(activityId).catch(() => []),
    ]);
    if (!activity) return;
    const recipients = participants
      .map((p) => p.uid)
      .filter((uid) => typeof uid === 'string' && uid && uid !== hostId);
    if (recipients.length === 0) return;
    const template = await renderTemplate('activity.cancelled', {
      activityName: activity.title,
      activityDate: activity.startTime,
      hostName: (await displayNameOf(hostId)) || 'The host',
    });
    const title = template?.title ?? 'Activity cancelled';
    const body = template?.body ?? `${activity.title} has been cancelled by the host.`;
    await Promise.all(
      recipients.map((recipientUid) =>
        createNotification({
          recipientUid,
          type: 'activity_cancelled',
          title,
          body,
          activityId,
          senderUid: hostId,
        }).catch(() => undefined),
      ),
    );
  } catch {
    // Swallowed by design — the status update already succeeded.
  }
}

export async function updateActivityCoverHandler(
  req: Request<UpdateActivityCoverParams>,
  res: Response,
) {
  try {
    // The service verifies that the cover asset belongs to this activity and its host.
    const hostId = req.auth?.uid;
    const { activityId } = req.params;
    const { coverImagePath, coverImageUrl } = req.body as {
      coverImagePath?: unknown;
      coverImageUrl?: unknown;
    };

    if (!hostId) {
      return res.status(401).json({
        ok: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authenticated user is required',
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

    if (typeof coverImagePath !== 'string' || typeof coverImageUrl !== 'string') {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'coverImagePath and coverImageUrl must be strings',
        },
      });
    }

    if (!coverImagePath.trim() || !coverImageUrl.trim()) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'EMPTY_INPUT',
          message: 'coverImagePath and coverImageUrl are required',
        },
      });
    }

    if (!coverImagePath.trim().startsWith(`activities/${activityId}/cover/`)) {
      return res.status(403).json({
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'coverImagePath must belong to the activity',
        },
      });
    }

    await updateActivityCover({
      activityId,
      hostId,
      coverImagePath,
      coverImageUrl,
    });

    return res.status(200).json({
      ok: true,
      data: {
        activityId,
        coverImagePath,
        coverImageUrl,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message === 'Activity not found') {
      return res.status(404).json({
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message,
        },
      });
    }

    if (message === 'Only the activity host can update this activity') {
      return res.status(403).json({
        ok: false,
        error: {
          code: 'FORBIDDEN',
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
